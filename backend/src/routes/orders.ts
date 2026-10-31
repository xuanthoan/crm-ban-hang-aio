/**
 * Order API — Sprint Đơn hàng.
 *
 * Locked rules applied here (§1, §2, §3, §5, §6):
 *  §1  Every line MUST reference a SKU (productVariantId), never the
 *      parent product. Lines carry snapshots (sku / product name /
 *      variant name / unit price) taken at sale time; later renames
 *      never change old orders. Inactive SKU or inactive parent
 *      product cannot be sold.
 *  §2  Physical stock changes ONLY through src/lib/inventory.ts.
 *      Draft holds are tracked separately in
 *      InventoryItem.reservedQuantity (see src/lib/orders.ts) and are
 *      NOT inventory transactions. Confirm converts a hold into a
 *      real deduction (order_confirmed) exactly once; cancel of a
 *      confirmed order restores only the not-yet-returned quantity
 *      (order_cancelled) exactly once; partial returns use "return".
 *  §3  Money is recomputed by the backend. This sprint has no payments
 *      yet, so paid_total is always 0 and debt_total = grand_total.
 *      The Payment sprint recomputes paid/debt/status from active
 *      payments — frontend values are never trusted as input.
 *  §5  No hard delete of orders with transactions: DELETE defaults to
 *      cancelling via the normal cancel flow; hard delete is Admin
 *      only, draft only, no payments, no inventory transactions.
 *  §6  Backend permission + data-scope checks on every route.
 *
 * Owner decisions for this sprint (2026-10-29):
 *  - MVP statuses are ONLY draft / confirmed / completed / cancelled.
 *    The schema enum was narrowed to those four; there is no packing /
 *    shipping / returned status. A fully returned order keeps its
 *    status and sets fullyReturned = true.
 *  - Draft orders HOLD stock via reservedQuantity.
 *    available = quantity - reservedQuantity.
 *  - Partial returns are implemented in this sprint (not deferred).
 *
 * Deliberately NOT in this sprint:
 *  - Payments / collecting money (paid_total stays 0; over-payment and
 *    refund handling for returns after payment belong to Payment).
 *  - Changing the customer of a draft (cancel and recreate instead).
 *  - Multi-warehouse: warehouseCode stays "MAIN".
 */

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { applyInventoryChange, deductForOrder, isInventoryError } from "../lib/inventory";
import {
  aggregateLines,
  assertTransition,
  computeOrderTotals,
  generateOrderCode,
  isOrderError,
  OrderError,
  recomputeTotalsAfterReturn,
  releaseReservation,
  reserveStock,
  roundMoney,
  type OrderStatus,
} from "../lib/orders";
import { recalculateOrderPaymentTotals } from "../lib/payments";
import { getPrisma } from "../lib/prisma";

const router = Router();
router.use(authenticate);

type AnyTx = any;
type AnyReq = import("express").Request;
type AnyRes = import("express").Response;

function dbUnavailable(res: AnyRes, err: unknown) {
  console.error("[orders] database error:", err);
  res.status(503).json({
    status: "error",
    message: "Chưa kết nối được database. Hãy chạy PostgreSQL (docker compose up -d postgres) rồi thử lại.",
  });
}

function isPrismaUniqueError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

function handleError(res: AnyRes, err: unknown): void {
  if (isOrderError(err)) {
    res.status(err.status).json({ status: "error", message: err.message });
    return;
  }
  if (isInventoryError(err)) {
    res.status(err.status).json({ status: "error", message: err.message, variantId: err.variantId ?? null, sku: err.sku ?? null });
    return;
  }
  dbUnavailable(res, err);
}

function parsePagination(req: AnyReq): { page: number; pageSize: number } {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
  return { page, pageSize };
}

function canViewAll(req: AnyReq): boolean {
  return req.user!.permissions.includes("order.view_all");
}

function canView(req: AnyReq): boolean {
  return canViewAll(req) || req.user!.permissions.includes("order.view_own");
}

function scopeWhere(req: AnyReq): Record<string, unknown> {
  if (canViewAll(req)) return {};
  return { createdById: req.user!.id };
}

function inScope(order: { createdById: string | null }, req: AnyReq): boolean {
  if (canViewAll(req)) return true;
  return order.createdById === req.user!.id;
}

function dec(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function isSellable(variant: any): boolean {
  return (
    variant &&
    !variant.deletedAt &&
    variant.status === "active" &&
    variant.product &&
    !variant.product.deletedAt &&
    variant.product.status === "active"
  );
}

function serializeItem(item: any) {
  return {
    id: item.id,
    orderId: item.orderId,
    productVariantId: item.productVariantId,
    sku: item.variant?.sku ?? item.skuSnapshot,
    skuSnapshot: item.skuSnapshot,
    productNameSnapshot: item.productNameSnapshot,
    variantNameSnapshot: item.variantNameSnapshot,
    productName: item.variant?.product?.name ?? item.productNameSnapshot,
    variantName: item.variant?.variantName ?? item.variantNameSnapshot,
    unitPrice: dec(item.unitPrice),
    discountAmount: dec(item.discountAmount),
    quantity: item.quantity,
    returnedQuantity: item.returnedQuantity ?? 0,
    remainingQuantity: item.quantity - (item.returnedQuantity ?? 0),
    lineTotal: dec(item.lineTotal),
  };
}

function serializeOrder(order: any, includeItems: boolean) {
  const base: Record<string, unknown> = {
    id: order.id,
    orderCode: order.orderCode,
    customerId: order.customerId,
    customerName: order.customer?.fullName ?? null,
    status: order.status,
    paymentStatus: order.paymentStatus,
    subtotal: dec(order.subtotal),
    discountTotal: dec(order.discountTotal),
    shippingFee: dec(order.shippingFee),
    grandTotal: dec(order.grandTotal),
    paidTotal: dec(order.paidTotal),
    debtTotal: dec(order.debtTotal),
    inventoryDeducted: order.inventoryDeducted,
    inventoryDeductedAt: order.inventoryDeductedAt,
    inventoryRestored: order.inventoryRestored,
    inventoryRestoredAt: order.inventoryRestoredAt,
    fullyReturned: order.fullyReturned ?? false,
    createdById: order.createdById ?? null,
    note: order.note ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
  if (includeItems) {
    base.items = (order.items ?? []).map(serializeItem);
  } else {
    base.itemsCount = order._count?.items ?? (order.items ? order.items.length : 0);
  }
  return base;
}

interface ValidatedLine {
  productVariantId: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  variant: any;
}

/**
 * Validate order lines against live SKUs. Returns lines with resolved
 * unit prices (caller-supplied or the SKU's current selling price) and
 * snapshots. Throws OrderError on any problem — the caller's
 * transaction rolls back, so no partial order is ever created.
 */
function validateLines(body: unknown): { raw: ValidatedLine[]; error?: string } {
  if (!body || typeof body !== "object" || !Array.isArray((body as { items?: unknown }).items)) {
    return { raw: [], error: "Đơn hàng phải có danh sách dòng hàng items (mỗi dòng bắt buộc có productVariantId là SKU)." };
  }
  const items = (body as { items: unknown[] }).items;
  if (items.length === 0) {
    return { raw: [], error: "Đơn hàng phải có ít nhất một dòng hàng." };
  }
  const seen = new Set<string>();
  const raw: ValidatedLine[] = [];
  for (const entry of items) {
    if (!entry || typeof entry !== "object") {
      return { raw: [], error: "Mỗi dòng đơn phải là một đối tượng." };
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.productId === "string" && typeof e.productVariantId !== "string") {
      return { raw: [], error: "Đơn hàng chỉ bán theo SKU (productVariantId), không được tạo dòng chỉ bằng sản phẩm cha (productId)." };
    }
    if (typeof e.productVariantId !== "string" || !e.productVariantId.trim()) {
      return { raw: [], error: "Mỗi dòng đơn bắt buộc phải có productVariantId (SKU)." };
    }
    const variantId = String(e.productVariantId).trim();
    if (seen.has(variantId)) {
      return { raw: [], error: "Một SKU xuất hiện nhiều hơn một dòng trong cùng một đơn. Hãy gộp thành một dòng duy nhất." };
    }
    seen.add(variantId);
    if (!Number.isInteger(e.quantity) || (e.quantity as number) <= 0) {
      return { raw: [], error: "Số lượng mỗi dòng đơn phải là số nguyên lớn hơn 0." };
    }
    let unitPrice: number | null = null;
    if (e.unitPrice !== undefined && e.unitPrice !== null) {
      if (typeof e.unitPrice !== "number" || Number.isNaN(e.unitPrice) || e.unitPrice < 0) {
        return { raw: [], error: "Đơn giá mỗi dòng phải là số không âm." };
      }
      unitPrice = Math.round(e.unitPrice * 100) / 100;
    }
    let discountAmount = 0;
    if (e.discountAmount !== undefined && e.discountAmount !== null) {
      if (typeof e.discountAmount !== "number" || Number.isNaN(e.discountAmount) || e.discountAmount < 0) {
        return { raw: [], error: "Giảm giá mỗi dòng phải là số không âm." };
      }
      discountAmount = Math.round(e.discountAmount * 100) / 100;
    }
    raw.push({
      productVariantId: variantId,
      quantity: e.quantity as number,
      unitPrice: unitPrice as number, // resolved against the live SKU below
      discountAmount,
      variant: null,
    });
  }
  return { raw };
}

function parseMoneyField(body: Record<string, unknown>, key: string, label: string): { value: number; error?: string } {
  const v = body[key];
  if (v === undefined || v === null) return { value: 0 };
  if (typeof v !== "number" || Number.isNaN(v) || v < 0) {
    return { value: 0, error: `${label} phải là số không âm.` };
  }
  return { value: Math.round(v * 100) / 100 };
}

async function loadOrderForWrite(tx: AnyTx, id: string): Promise<any> {
  const order = await tx.order.findUnique({
    where: { id },
    include: { items: { include: { variant: { include: { product: true } } } }, customer: true },
  });
  if (!order || order.deletedAt) {
    throw new OrderError("Không tìm thấy đơn hàng.", 404);
  }
  return order;
}

/** Shared cancel logic for POST /cancel and DELETE (soft path). */
async function performCancel(tx: AnyTx, order: any, actorId: string | null): Promise<any> {
  if (order.status === "draft") {
    assertTransition("draft", "cancelled");
    await releaseReservation(
      tx,
      order.items.map((i: any) => ({ variantId: i.productVariantId, quantity: i.quantity })),
    );
    return tx.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
  }
  if (order.status === "confirmed") {
    assertTransition("confirmed", "cancelled");
    if (order.inventoryRestored) {
      throw new OrderError(`Đơn ${order.orderCode} đã hoàn kho rồi, không được hủy/hoàn kho lần nữa.`, 409);
    }
    // Restore ONLY the not-yet-returned quantity. restoreForOrder()
    // restores the full original quantity, which would double-restore
    // any part already returned via the return endpoint — so cancel
    // after a partial return goes through the same inventory service
    // (applyInventoryChange, type order_cancelled) with remaining qty.
    for (const item of order.items) {
      const remaining = item.quantity - (item.returnedQuantity ?? 0);
      if (remaining <= 0) continue;
      await applyInventoryChange(tx, {
        variantId: item.productVariantId,
        type: "order_cancelled",
        quantityChanged: remaining,
        reason: `Hoàn kho khi hủy đơn ${order.orderCode}`,
        referenceType: "order",
        referenceId: order.id,
        actorId,
      });
    }
    return tx.order.update({
      where: { id: order.id },
      data: { status: "cancelled", inventoryRestored: true, inventoryRestoredAt: new Date() },
    });
  }
  // completed / cancelled: assertTransition throws the invalid-transition error.
  assertTransition(order.status, "cancelled");
  throw new OrderError("Không thể hủy đơn ở trạng thái này.", 400);
}

/* ------------------------------------------------------------------ */
/* GET /api/orders — list                                              */
/* ------------------------------------------------------------------ */

router.get("/orders", async (req, res) => {
  try {
    if (!canView(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem đơn hàng." });
      return;
    }
    const prisma = getPrisma();
    const { page, pageSize } = parsePagination(req);
    const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : null;
    const where: Record<string, unknown> = { ...scopeWhere(req), deletedAt: null };
    if (q) {
      where.OR = [
        { orderCode: { contains: q, mode: "insensitive" } },
        { customer: { fullName: { contains: q, mode: "insensitive" } } },
      ];
    }
    if (typeof req.query.status === "string" && req.query.status) {
      const status = req.query.status as string;
      if (!["draft", "confirmed", "completed", "cancelled"].includes(status)) {
        res.status(400).json({ status: "error", message: `Trạng thái đơn không hợp lệ: ${status}. MVP chỉ có draft / confirmed / completed / cancelled.` });
        return;
      }
      where.status = status;
    }
    if (typeof req.query.customerId === "string" && req.query.customerId) {
      where.customerId = req.query.customerId;
    }
    if (typeof req.query.dateFrom === "string" && req.query.dateFrom) {
      (where.createdAt as Record<string, unknown>) = { ...(where.createdAt as Record<string, unknown>), gte: new Date(req.query.dateFrom) };
    }
    if (typeof req.query.dateTo === "string" && req.query.dateTo) {
      (where.createdAt as Record<string, unknown>) = { ...(where.createdAt as Record<string, unknown>), lte: new Date(req.query.dateTo) };
    }
    if (typeof req.query.minTotal === "string" && req.query.minTotal !== "") {
      (where.grandTotal as Record<string, unknown>) = { ...(where.grandTotal as Record<string, unknown>), gte: Number(req.query.minTotal) };
    }
    if (typeof req.query.maxTotal === "string" && req.query.maxTotal !== "") {
      (where.grandTotal as Record<string, unknown>) = { ...(where.grandTotal as Record<string, unknown>), lte: Number(req.query.maxTotal) };
    }
    const [total, rows] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: { select: { fullName: true } }, _count: { select: { items: true } } },
      }),
    ]);
    res.json({ status: "ok", data: rows.map((o: any) => serializeOrder(o, false)), page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/orders/:id — detail                                        */
/* ------------------------------------------------------------------ */

router.get("/orders/:id", async (req, res) => {
  try {
    if (!canView(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem đơn hàng." });
      return;
    }
    const prisma = getPrisma();
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        items: { include: { variant: { include: { product: true } } }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!order || order.deletedAt) {
      res.status(404).json({ status: "error", message: "Không tìm thấy đơn hàng." });
      return;
    }
    if (!inScope(order, req)) {
      res.status(403).json({ status: "error", message: "Đơn hàng này không thuộc phạm vi của bạn." });
      return;
    }
    res.json({ status: "ok", data: serializeOrder(order, true) });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/orders — create draft + reserve stock                     */
/* ------------------------------------------------------------------ */

router.post("/orders", authorize("order.create"), async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { raw, error: lineError } = validateLines(body);
    if (lineError) {
      res.status(400).json({ status: "error", message: lineError });
      return;
    }
    if (typeof body.customerId !== "string" || !body.customerId.trim()) {
      res.status(400).json({ status: "error", message: "Đơn hàng bắt buộc phải có khách hàng." });
      return;
    }
    const discount = parseMoneyField(body, "discountTotal", "Chiết khấu cấp đơn");
    if (discount.error) {
      res.status(400).json({ status: "error", message: discount.error });
      return;
    }
    const shipping = parseMoneyField(body, "shippingFee", "Phí giao hàng");
    if (shipping.error) {
      res.status(400).json({ status: "error", message: shipping.error });
      return;
    }
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    const prisma = getPrisma();
    const actorId = req.user!.id;

    // Order code is unique; on a rare collision, regenerate and retry
    // the whole transaction (validation runs again, so nothing partial
    // can leak through a retry).
    let created: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const orderCode = generateOrderCode();
      try {
        created = await prisma.$transaction(async (tx: AnyTx) => {
          const customer = await tx.customer.findUnique({ where: { id: String(body.customerId).trim() } });
          if (!customer || customer.deletedAt) {
            throw new OrderError("Không tìm thấy khách hàng.", 404);
          }
          if (customer.status !== "active") {
            throw new OrderError("Khách hàng đang ngừng hoạt động nên không được tạo đơn.", 400);
          }
          const lines: ValidatedLine[] = [];
          for (const line of raw) {
            const variant = await tx.productVariant.findUnique({
              where: { id: line.productVariantId },
              include: { product: true },
            });
            if (!variant || variant.deletedAt) {
              throw new OrderError(`Không tìm thấy SKU với id ${line.productVariantId}.`, 404);
            }
            if (!isSellable(variant)) {
              throw new OrderError(
                `SKU ${variant.sku} đang ngừng bán (biến thể hoặc sản phẩm cha không còn active) nên không được bán.`,
                400,
              );
            }
            // validateLines leaves unitPrice null when the caller
            // omitted it; resolve it here from the SKU's current
            // selling price (the snapshot for this order).
            const sent = (body as { items: Record<string, unknown>[] }).items.find(
              (i) => String(i.productVariantId).trim() === line.productVariantId,
            );
            const finalPrice = sent?.unitPrice === undefined || sent?.unitPrice === null
              ? dec(variant.sellingPrice)
              : roundMoney(sent.unitPrice as number);
            lines.push({ ...line, unitPrice: finalPrice, variant });
          }
          const totals = computeOrderTotals(
            lines.map((l) => ({ productVariantId: l.productVariantId, quantity: l.quantity, unitPrice: l.unitPrice, discountAmount: l.discountAmount })),
            discount.value,
            shipping.value,
            0,
          );
          const order = await tx.order.create({
            data: {
              orderCode,
              customerId: customer.id,
              status: "draft",
              paymentStatus: totals.paymentStatus,
              subtotal: totals.subtotal,
              discountTotal: totals.discountTotal,
              shippingFee: totals.shippingFee,
              grandTotal: totals.grandTotal,
              paidTotal: 0,
              debtTotal: totals.grandTotal,
              note,
              createdById: actorId,
              items: {
                create: lines.map((l, idx) => ({
                  productVariantId: l.productVariantId,
                  skuSnapshot: l.variant.sku,
                  productNameSnapshot: l.variant.product.name,
                  variantNameSnapshot: l.variant.variantName,
                  unitPrice: totals.lines[idx].unitPrice,
                  discountAmount: totals.lines[idx].discountAmount,
                  quantity: l.quantity,
                  lineTotal: totals.lines[idx].lineTotal,
                })),
              },
            },
            include: { customer: { select: { fullName: true } }, items: { include: { variant: { include: { product: true } } } } },
          });
          // Draft HOLD: reserve after the order exists, inside the same
          // transaction — a shortfall rolls back the order creation too.
          await reserveStock(
            tx,
            lines.map((l) => ({ variantId: l.productVariantId, quantity: l.quantity })),
          );
          await writeAudit(tx, {
            actorId,
            action: "order.create",
            entityType: "order",
            entityId: order.id,
            newValue: { orderCode, customerId: customer.id, grandTotal: totals.grandTotal, items: lines.map((l) => ({ sku: l.variant.sku, quantity: l.quantity })) },
            ipAddress: req.ip ?? null,
          });
          return order;
        });
        break;
      } catch (err) {
        if (isPrismaUniqueError(err) && attempt < 4) continue;
        throw err;
      }
    }
    if (!created) {
      res.status(500).json({ status: "error", message: "Không tạo được mã đơn sau nhiều lần thử. Vui lòng thử lại." });
      return;
    }
    res.status(201).json({ status: "ok", data: serializeOrder(created, true) });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /api/orders/:id — draft only                                  */
/* ------------------------------------------------------------------ */

router.patch("/orders/:id", authorize("order.update_draft"), async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.customerId === "string" && body.customerId.trim()) {
      // Changing the customer is deliberately not supported on a draft:
      // cancel and recreate instead (keeps scope + reservation simple).
      res.status(400).json({ status: "error", message: "Không đổi khách hàng của đơn nháp. Hãy hủy đơn và tạo đơn mới cho khách khác." });
      return;
    }
    const hasItems = body.items !== undefined;
    let raw: ValidatedLine[] = [];
    if (hasItems) {
      const v = validateLines(body);
      if (v.error) {
        res.status(400).json({ status: "error", message: v.error });
        return;
      }
      raw = v.raw;
    }
    const discount = body.discountTotal !== undefined ? parseMoneyField(body, "discountTotal", "Chiết khấu cấp đơn") : null;
    if (discount?.error) {
      res.status(400).json({ status: "error", message: discount.error });
      return;
    }
    const shipping = body.shippingFee !== undefined ? parseMoneyField(body, "shippingFee", "Phí giao hàng") : null;
    if (shipping?.error) {
      res.status(400).json({ status: "error", message: shipping.error });
      return;
    }
    const note = typeof body.note === "string" ? (body.note.trim() ? body.note.trim() : null) : undefined;
    const prisma = getPrisma();
    const actorId = req.user!.id;
    const updated = await prisma.$transaction(async (tx: AnyTx) => {
      const order = await loadOrderForWrite(tx, req.params.id);
      if (!inScope(order, req)) {
        throw new OrderError("Đơn hàng này không thuộc phạm vi của bạn.", 403);
      }
      if (order.status !== "draft") {
        throw new OrderError(`Chỉ sửa được đơn nháp. Đơn đang ở trạng thái "${order.status}" nên không sửa dòng/tổng tiền được nữa.`, 400);
      }
      let lines: ValidatedLine[];
      if (hasItems) {
        // Release the OLD hold first, inside the same transaction: the
        // new lines are then validated against the freed availability,
        // and any failure rolls the release back too.
        await releaseReservation(
          tx,
          order.items.map((i: any) => ({ variantId: i.productVariantId, quantity: i.quantity })),
        );
        lines = [];
        for (const line of raw) {
          const variant = await tx.productVariant.findUnique({
            where: { id: line.productVariantId },
            include: { product: true },
          });
          if (!variant || variant.deletedAt) {
            throw new OrderError(`Không tìm thấy SKU với id ${line.productVariantId}.`, 404);
          }
          if (!isSellable(variant)) {
            throw new OrderError(`SKU ${variant.sku} đang ngừng bán nên không được bán.`, 400);
          }
          const sent = (body.items as Record<string, unknown>[]).find((i) => String(i.productVariantId).trim() === line.productVariantId);
          const finalPrice = sent?.unitPrice === undefined || sent?.unitPrice === null ? dec(variant.sellingPrice) : roundMoney(sent.unitPrice as number);
          lines.push({ ...line, unitPrice: finalPrice, variant });
        }
        await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      } else {
        lines = order.items.map((i: any) => ({
          productVariantId: i.productVariantId,
          quantity: i.quantity,
          unitPrice: dec(i.unitPrice),
          discountAmount: dec(i.discountAmount),
          variant: i.variant,
        }));
      }
      const totals = computeOrderTotals(
        lines.map((l) => ({ productVariantId: l.productVariantId, quantity: l.quantity, unitPrice: l.unitPrice, discountAmount: l.discountAmount })),
        discount ? discount.value : dec(order.discountTotal),
        shipping ? shipping.value : dec(order.shippingFee),
        0,
      );
      const data: Record<string, unknown> = {
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        shippingFee: totals.shippingFee,
        grandTotal: totals.grandTotal,
        paidTotal: 0,
        debtTotal: totals.grandTotal,
        paymentStatus: totals.paymentStatus,
      };
      if (note !== undefined) data.note = note;
      if (hasItems) {
        data.items = {
          create: lines.map((l, idx) => ({
            productVariantId: l.productVariantId,
            skuSnapshot: l.variant.sku,
            productNameSnapshot: l.variant.product.name,
            variantNameSnapshot: l.variant.variantName,
            unitPrice: totals.lines[idx].unitPrice,
            discountAmount: totals.lines[idx].discountAmount,
            quantity: l.quantity,
            lineTotal: totals.lines[idx].lineTotal,
          })),
        };
      }
      const saved = await tx.order.update({
        where: { id: order.id },
        data,
        include: { customer: { select: { fullName: true } }, items: { include: { variant: { include: { product: true } } } } },
      });
      if (hasItems) {
        await reserveStock(
          tx,
          lines.map((l) => ({ variantId: l.productVariantId, quantity: l.quantity })),
        );
      }
      await writeAudit(tx, {
        actorId,
        action: "order.update_draft",
        entityType: "order",
        entityId: order.id,
        oldValue: { status: order.status, grandTotal: dec(order.grandTotal) },
        newValue: { grandTotal: totals.grandTotal },
        ipAddress: req.ip ?? null,
      });
      return saved;
    });
    res.json({ status: "ok", data: serializeOrder(updated, true) });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/orders/:id/confirm — draft -> confirmed (deduct once)     */
/* ------------------------------------------------------------------ */

router.post("/orders/:id/confirm", authorize("order.confirm"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const actorId = req.user!.id;
    const updated = await prisma.$transaction(async (tx: AnyTx) => {
      const order = await loadOrderForWrite(tx, req.params.id);
      if (!inScope(order, req)) {
        throw new OrderError("Đơn hàng này không thuộc phạm vi của bạn.", 403);
      }
      assertTransition(order.status, "confirmed");
      if (order.inventoryDeducted) {
        throw new OrderError(`Đơn ${order.orderCode} đã trừ kho rồi, không được xác nhận/trừ kho lần nữa.`, 409);
      }
      // Manual stock adjustments may have reduced physical stock below
      // the held quantity since the draft was created: refuse the
      // confirm (draft + hold stay intact via rollback) instead of
      // letting the inventory service go negative.
      // Same rule as the draft reserve check: report every short line at
      // once instead of only the first one.
      const shortfalls: string[] = [];
      for (const item of order.items) {
        const stock = await tx.inventoryItem.findUnique({ where: { variantId: item.productVariantId } });
        const physical = stock ? stock.quantity : 0;
        if (physical < item.quantity) {
          shortfalls.push(`SKU ${item.variant?.sku ?? item.productVariantId}: tồn vật lý ${physical}, cần ${item.quantity}`);
        }
      }
      if (shortfalls.length > 0) {
        throw new OrderError(
          `Không đủ tồn vật lý để xác nhận đơn (${shortfalls.join("; ")}). Đơn vẫn giữ trạng thái nháp và đặt giữ.`,
          400,
        );
      }
      // Convert hold -> real deduction, in the same transaction.
      await releaseReservation(
        tx,
        order.items.map((i: any) => ({ variantId: i.productVariantId, quantity: i.quantity })),
      );
      await deductForOrder(
        tx,
        {
          id: order.id,
          orderCode: order.orderCode,
          inventoryDeducted: false,
          inventoryRestored: order.inventoryRestored,
          items: order.items.map((i: any) => ({ productVariantId: i.productVariantId, quantity: i.quantity })),
        },
        actorId,
      );
      const saved = await tx.order.update({
        where: { id: order.id },
        data: { status: "confirmed" },
        include: { customer: { select: { fullName: true } }, items: { include: { variant: { include: { product: true } } } } },
      });
      await writeAudit(tx, {
        actorId,
        action: "order.confirm",
        entityType: "order",
        entityId: order.id,
        oldValue: { status: "draft" },
        newValue: { status: "confirmed", inventoryDeducted: true },
        ipAddress: req.ip ?? null,
      });
      return saved;
    });
    res.json({ status: "ok", data: serializeOrder(updated, true) });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/orders/:id/complete — confirmed -> completed              */
/* ------------------------------------------------------------------ */

router.post("/orders/:id/complete", authorize("order.complete"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const actorId = req.user!.id;
    const updated = await prisma.$transaction(async (tx: AnyTx) => {
      const order = await loadOrderForWrite(tx, req.params.id);
      if (!inScope(order, req)) {
        throw new OrderError("Đơn hàng này không thuộc phạm vi của bạn.", 403);
      }
      assertTransition(order.status, "completed");
      const saved = await tx.order.update({
        where: { id: order.id },
        data: { status: "completed" },
        include: { customer: { select: { fullName: true } }, items: { include: { variant: { include: { product: true } } } } },
      });
      await writeAudit(tx, {
        actorId,
        action: "order.complete",
        entityType: "order",
        entityId: order.id,
        oldValue: { status: "confirmed" },
        newValue: { status: "completed" },
        ipAddress: req.ip ?? null,
      });
      return saved;
    });
    res.json({ status: "ok", data: serializeOrder(updated, true) });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/orders/:id/cancel — draft / confirmed only                */
/* ------------------------------------------------------------------ */

router.post("/orders/:id/cancel", authorize("order.cancel"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const actorId = req.user!.id;
    const updated = await prisma.$transaction(async (tx: AnyTx) => {
      const order = await loadOrderForWrite(tx, req.params.id);
      if (!inScope(order, req)) {
        throw new OrderError("Đơn hàng này không thuộc phạm vi của bạn.", 403);
      }
      const oldStatus = order.status;
      const saved = await performCancel(tx, order, actorId);
      await writeAudit(tx, {
        actorId,
        action: "order.cancel",
        entityType: "order",
        entityId: order.id,
        oldValue: { status: oldStatus },
        newValue: { status: "cancelled" },
        ipAddress: req.ip ?? null,
      });
      return saved;
    });
    const full = await getPrisma().order.findUnique({
      where: { id: (updated as any).id },
      include: { customer: { select: { fullName: true } }, items: { include: { variant: { include: { product: true } } } } },
    });
    res.json({ status: "ok", data: serializeOrder(full, true) });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/orders/:id/return — partial return, confirmed/completed   */
/* ------------------------------------------------------------------ */

router.post("/orders/:id/return", authorize("order.return"), async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ status: "error", message: "Trả hàng phải có danh sách dòng hàng (items) với số lượng và lý do." });
      return;
    }
    const commonReason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
    const prisma = getPrisma();
    const actorId = req.user!.id;
    const updated = await prisma.$transaction(async (tx: AnyTx) => {
      const order = await loadOrderForWrite(tx, req.params.id);
      if (!inScope(order, req)) {
        throw new OrderError("Đơn hàng này không thuộc phạm vi của bạn.", 403);
      }
      if (order.status !== "confirmed" && order.status !== "completed") {
        throw new OrderError(
          `Chỉ trả hàng cho đơn đã xác nhận hoặc đã hoàn thành. Đơn đang ở trạng thái "${order.status}" nên không trả hàng được.`,
          400,
        );
      }
      if (order.inventoryRestored) {
        throw new OrderError(`Đơn ${order.orderCode} đã hoàn kho toàn bộ rồi nên không trả hàng thêm được.`, 409);
      }
      // Aggregate duplicate lines for the same order item first, then
      // validate every line before applying anything (all-or-nothing).
      const byItem = new Map<string, { item: any; quantity: number; reason: string }>();
      for (const entry of body.items as unknown[]) {
        if (!entry || typeof entry !== "object") {
          throw new OrderError("Mỗi dòng trả hàng phải là một đối tượng.", 400);
        }
        const e = entry as Record<string, unknown>;
        const reason = (typeof e.reason === "string" && e.reason.trim() ? e.reason.trim() : commonReason) ?? "";
        if (!reason) {
          throw new OrderError("Trả hàng bắt buộc phải có lý do (lý do chung hoặc lý do từng dòng).", 400);
        }
        if (!Number.isInteger(e.quantity) || (e.quantity as number) <= 0) {
          throw new OrderError("Số lượng trả mỗi dòng phải là số nguyên lớn hơn 0.", 400);
        }
        let item: any = null;
        if (typeof e.orderItemId === "string") {
          item = order.items.find((i: any) => i.id === e.orderItemId);
          if (!item) throw new OrderError(`Không tìm thấy dòng đơn với id ${e.orderItemId} trong đơn này.`, 404);
        } else if (typeof e.productVariantId === "string") {
          item = order.items.find((i: any) => i.productVariantId === e.productVariantId);
          if (!item) {
            // Same rule as elsewhere: show the SKU code, never a raw id.
            const variant = await tx.productVariant.findUnique({ where: { id: e.productVariantId }, include: { product: true } });
            const label = variant ? `${variant.sku} (${variant.product?.name ?? ""} / ${variant.variantName})` : "yêu cầu";
            throw new OrderError(`Đơn này không có dòng SKU ${label}.`, 404);
          }
        } else {
          throw new OrderError("Mỗi dòng trả hàng phải có orderItemId hoặc productVariantId.", 400);
        }
        const prev = byItem.get(item.id);
        if (prev) {
          prev.quantity += e.quantity as number;
        } else {
          byItem.set(item.id, { item, quantity: e.quantity as number, reason });
        }
      }
      for (const { item, quantity } of byItem.values()) {
        const remaining = item.quantity - (item.returnedQuantity ?? 0);
        if (quantity > remaining) {
          throw new OrderError(
            `Số lượng trả vượt số còn trả được của dòng ${item.skuSnapshot} (còn trả được ${remaining}, yêu cầu ${quantity}). Toàn bộ lần trả đã bị hủy, không hoàn một phần.`,
            400,
          );
        }
      }
      // Apply: return stock first, then update returned quantities.
      for (const { item, quantity, reason } of byItem.values()) {
        await applyInventoryChange(tx, {
          variantId: item.productVariantId,
          type: "return",
          quantityChanged: quantity,
          reason: `Trả hàng đơn ${order.orderCode}: ${reason}`,
          referenceType: "order",
          referenceId: order.id,
          actorId,
        });
        await tx.orderItem.update({
          where: { id: item.id },
          data: { returnedQuantity: (item.returnedQuantity ?? 0) + quantity },
        });
        item.returnedQuantity = (item.returnedQuantity ?? 0) + quantity;
      }
      const remainingLines = order.items.map((i: any) => ({
        quantity: i.quantity - (i.returnedQuantity ?? 0),
        unitPrice: dec(i.unitPrice),
        discountAmount: dec(i.discountAmount),
      }));
      const totals = recomputeTotalsAfterReturn(remainingLines, dec(order.discountTotal), dec(order.shippingFee));
      const fullyReturned = order.items.every((i: any) => (i.returnedQuantity ?? 0) >= i.quantity);
      // Sprint Thanh toán: grand_total changes here, so paid/debt/
      // status must be recomputed from ACTIVE payments — never set
      // debt = grand (that was only correct while paid_total was 0).
      // If grand drops below paid, debt goes negative = customer
      // credit (overpaid), status stays "paid"; no refund is issued
      // in this sprint (see src/lib/payments.ts).
      await tx.order.update({
        where: { id: order.id },
        data: {
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          grandTotal: totals.grandTotal,
          fullyReturned,
        },
      });
      const { totals: paymentTotals } = await recalculateOrderPaymentTotals(tx, order.id);
      const saved = await tx.order.findUnique({
        where: { id: order.id },
        include: { customer: { select: { fullName: true } }, items: { include: { variant: { include: { product: true } } } } },
      });
      await writeAudit(tx, {
        actorId,
        action: "order.return",
        entityType: "order",
        entityId: order.id,
        oldValue: { grandTotal: dec(order.grandTotal), paidTotal: dec(order.paidTotal), debtTotal: dec(order.debtTotal) },
        newValue: {
          grandTotal: totals.grandTotal,
          paidTotal: paymentTotals.paidTotal,
          debtTotal: paymentTotals.debtTotal,
          paymentStatus: paymentTotals.paymentStatus,
          fullyReturned,
          returned: Array.from(byItem.values()).map(({ item, quantity, reason }) => ({ sku: item.skuSnapshot, quantity, reason })),
        },
        ipAddress: req.ip ?? null,
      });
      return saved;
    });
    res.json({ status: "ok", data: serializeOrder(updated, true) });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* DELETE /api/orders/:id — cancel by default; hard delete Admin-only  */
/* ------------------------------------------------------------------ */

router.delete("/orders/:id", async (req, res) => {
  try {
    const prisma = getPrisma();
    const actorId = req.user!.id;
    const hard = req.query.hard === "true";
    if (hard) {
      if (!req.user!.permissions.includes("order.hard_delete")) {
        res.status(403).json({ status: "error", message: "Chỉ Admin mới được xóa cứng đơn hàng." });
        return;
      }
      const deleted = await prisma.$transaction(async (tx: AnyTx) => {
        const order = await loadOrderForWrite(tx, req.params.id);
        if (!inScope(order, req)) {
          throw new OrderError("Đơn hàng này không thuộc phạm vi của bạn.", 403);
        }
        if (order.status !== "draft") {
          throw new OrderError("Chỉ xóa cứng được đơn nháp. Đơn đã xác nhận/hoàn thành/hủy thì dùng hủy đơn hoặc trả hàng, không xóa cứng.", 400);
        }
        if (order.inventoryDeducted) {
          throw new OrderError("Đơn đã từng trừ kho nên không được xóa cứng.", 400);
        }
        const paymentCount = await tx.payment.count({ where: { orderId: order.id } });
        if (paymentCount > 0) {
          throw new OrderError("Đơn đã có payment nên không được xóa cứng.", 400);
        }
        const txCount = await tx.inventoryTransaction.count({ where: { referenceId: order.id } });
        if (txCount > 0) {
          throw new OrderError("Đơn đã có lịch sử kho nên không được xóa cứng.", 400);
        }
        // A draft normally holds a reservation; releasing it as part of
        // the delete keeps reservedQuantity consistent (the order no
        // longer exists to hold anything). This is the documented
        // interpretation of "chưa từng giữ tồn" — never deducted, no
        // payments, no inventory transactions — not "never reserved",
        // which would make hard-deleting any draft impossible.
        await releaseReservation(
          tx,
          order.items.map((i: any) => ({ variantId: i.productVariantId, quantity: i.quantity })),
        );
        await tx.orderItem.deleteMany({ where: { orderId: order.id } });
        await tx.order.delete({ where: { id: order.id } });
        await writeAudit(tx, {
          actorId,
          action: "order.hard_delete",
          entityType: "order",
          entityId: order.id,
          oldValue: { orderCode: order.orderCode, status: order.status },
          ipAddress: req.ip ?? null,
        });
        return { orderCode: order.orderCode };
      });
      res.json({ status: "ok", data: { deleted: true, orderCode: deleted.orderCode } });
      return;
    }
    // Default DELETE = cancel via the normal flow (draft releases the
    // hold, confirmed restores the remaining stock).
    if (!req.user!.permissions.includes("order.cancel")) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền hủy đơn." });
      return;
    }
    const updated = await prisma.$transaction(async (tx: AnyTx) => {
      const order = await loadOrderForWrite(tx, req.params.id);
      if (!inScope(order, req)) {
        throw new OrderError("Đơn hàng này không thuộc phạm vi của bạn.", 403);
      }
      const oldStatus = order.status;
      const saved = await performCancel(tx, order, actorId);
      await writeAudit(tx, {
        actorId,
        action: "order.cancel",
        entityType: "order",
        entityId: order.id,
        oldValue: { status: oldStatus },
        newValue: { status: "cancelled" },
        ipAddress: req.ip ?? null,
      });
      return saved;
    });
    const full = await prisma.order.findUnique({
      where: { id: (updated as any).id },
      include: { customer: { select: { fullName: true } }, items: { include: { variant: { include: { product: true } } } } },
    });
    res.json({ status: "ok", data: serializeOrder(full, true) });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
