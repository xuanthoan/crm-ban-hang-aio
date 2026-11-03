/**
 * Purchase-order API — Sprint NCC-2 (đơn nhập hàng).
 *
 * Mirrors the sales-order module (routes/orders.ts) with the stock
 * direction reversed:
 *  §1  Every line MUST reference a SKU (variantId), never the parent
 *      product. Lines carry snapshots (sku / product name / variant
 *      name / unit cost) taken at receipt time; later renames never
 *      change old purchase orders. Inactive SKU, inactive parent
 *      product, or inactive supplier blocks draft creation AND confirm
 *      (rechecked at confirm, in case the SKU/supplier went inactive
 *      after the draft was made). Return stays allowed even if the
 *      SKU/supplier became inactive after receipt.
 *  §2  Physical stock changes ONLY through src/lib/inventory.ts.
 *      Draft POs change NO stock (unlike sales drafts, a purchase
 *      draft holds nothing — the goods do not exist yet). Confirm adds
 *      stock (purchase_received) exactly once; cancel of a confirmed
 *      PO removes only the not-yet-returned quantity
 *      (purchase_cancelled) exactly once; partial returns use
 *      purchase_return. Any operation that would drive a SKU negative
 *      is blocked and rolled back entirely.
 *  §3  Money is recomputed by the backend, in integer VND. NCC-2 has
 *      no payments yet, so paid_total is always 0 and
 *      debt_total = grand_total. Sprint NCC-3 recomputes paid/debt/
 *      status from active supplier payments — frontend values for
 *      grandTotal / paidTotal / debtTotal / paymentStatus are never
 *      read as input.
 *  §5  No hard delete of purchase orders in NCC-2: removal is cancel
 *      via the normal cancel flow. (Supplier hard delete is guarded
 *      separately in routes/suppliers.ts: a supplier with ANY purchase
 *      order cannot be hard-deleted.)
 *  §6  Backend permission + data-scope checks on every route.
 *
 * Deliberately NOT in this sprint (design 13 §7):
 *  - Partial receipt (§7.1): confirm receives ALL lines in full.
 *    To receive part of a delivery, edit the draft first so it matches
 *    what actually arrived, then confirm.
 *  - Auto-update of a variant's importPrice on receipt (§7.2): the PO
 *    line keeps its own unitCost snapshot only.
 *  - Per-line discount, order discount, shipping fee, tax (§7.5).
 *  - Supplier payments / supplier debt page (Sprint NCC-3).
 *  - Changing the supplier of a draft (cancel and recreate instead,
 *    same rule as changing the customer of a sales draft).
 *  - Multi-warehouse: warehouseCode stays "MAIN".
 */

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { applyInventoryChange, isInventoryError } from "../lib/inventory";
import {
  assertPurchaseTransition,
  computePurchaseTotals,
  generatePurchaseOrderCode,
  isPurchaseError,
  PurchaseError,
  recomputeTotalsAfterReturn,
} from "../lib/purchases";
import { recalculatePurchasePaymentTotals, serializeSupplierPayment } from "../lib/supplierPayments";
import { getPrisma } from "../lib/prisma";

const router = Router();
router.use(authenticate);

type AnyTx = any;
type AnyReq = import("express").Request;
type AnyRes = import("express").Response;

function dbUnavailable(res: AnyRes, err: unknown) {
  console.error("[purchases] database error:", err);
  res.status(503).json({
    status: "error",
    message: "Chưa kết nối được database. Hãy chạy PostgreSQL (docker compose up -d postgres) rồi thử lại.",
  });
}

function isPrismaUniqueError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

function handleError(res: AnyRes, err: unknown): void {
  if (isPurchaseError(err)) {
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
  return req.user!.permissions.includes("purchase.view_all");
}

function canView(req: AnyReq): boolean {
  return canViewAll(req) || req.user!.permissions.includes("purchase.view_own");
}

/**
 * Who may receive per-line unit costs in PO payloads. Mirrors how
 * products.ts treats importPrice (omitted without product.view_cost),
 * with one deliberate exception: purchase.create holders MUST round-trip
 * line costs through the draft-edit form — they enter costs when
 * creating a PO, so stripping would break draft editing (the form would
 * load empty costs and fail save validation). Pure viewers without
 * view_cost (Warehouse confirm-only, Accountant view-only) get costs
 * stripped. The detail table itself is gated on product.view_cost alone
 * in the frontend, so even create holders do not SEE the column unless
 * they may see costs.
 */
function canSeeCosts(req: AnyReq): boolean {
  return req.user!.permissions.includes("product.view_cost") || req.user!.permissions.includes("purchase.create");
}

function scopeWhere(req: AnyReq): Record<string, unknown> {
  if (canViewAll(req)) return {};
  return { createdById: req.user!.id };
}

function inScope(po: { createdById: string | null }, req: AnyReq): boolean {
  if (canViewAll(req)) return true;
  return po.createdById === req.user!.id;
}

/** A SKU can be received only when both it and its parent are active. */
function isReceivable(variant: any): boolean {
  return (
    variant &&
    !variant.deletedAt &&
    variant.status === "active" &&
    variant.product &&
    !variant.product.deletedAt &&
    variant.product.status === "active"
  );
}

/** Human-readable label for a SKU in user-facing errors — never a raw id. */
function skuLabel(variant: any, fallbackId?: string): string {
  if (variant) return `${variant.sku} (${variant.product?.name ?? ""} / ${variant.variantName})`;
  return fallbackId ? `SKU ${fallbackId}` : "SKU này";
}

function serializeItem(item: any, canCost: boolean) {
  const out: Record<string, unknown> = {
    id: item.id,
    purchaseOrderId: item.purchaseOrderId,
    variantId: item.variantId,
    sku: item.variant?.sku ?? item.skuSnapshot,
    skuSnapshot: item.skuSnapshot,
    productNameSnapshot: item.productNameSnapshot,
    variantNameSnapshot: item.variantNameSnapshot,
    productName: item.variant?.product?.name ?? item.productNameSnapshot,
    variantName: item.variant?.variantName ?? item.variantNameSnapshot,
    quantity: item.quantity,
    returnedQuantity: item.returnedQuantity ?? 0,
    remainingQuantity: item.quantity - (item.returnedQuantity ?? 0),
    lineTotal: item.lineTotal,
  };
  // unitCost is omitted entirely (not null) for viewers who must not see
  // costs, mirroring the importPrice rule in products.ts.
  if (canCost) out.unitCost = item.unitCost;
  return out;
}

function serializePO(po: any, includeItems: boolean, canCost: boolean) {
  const base: Record<string, unknown> = {
    id: po.id,
    code: po.code,
    supplierId: po.supplierId,
    supplierName: po.supplier?.name ?? null,
    supplierTaxCode: po.supplier?.taxCode ?? null,
    supplierStatus: po.supplier?.status ?? null,
    status: po.status,
    paymentStatus: po.paymentStatus,
    grandTotal: po.grandTotal,
    paidTotal: po.paidTotal,
    debtTotal: po.debtTotal,
    received: po.received,
    receivedAt: po.receivedAt,
    restored: po.restored,
    restoredAt: po.restoredAt,
    fullyReturned: po.fullyReturned ?? false,
    createdById: po.createdById ?? null,
    note: po.note ?? null,
    createdAt: po.createdAt,
    updatedAt: po.updatedAt,
  };
  if (includeItems) {
    base.items = (po.items ?? []).map((it: any) => serializeItem(it, canCost));
    // Payments are included only when the query fetched them (every
    // detail-returning route below does). List responses omit the key.
    if (po.payments !== undefined) {
      base.payments = (po.payments ?? []).map(serializeSupplierPayment);
    }
  } else {
    base.itemsCount = po._count?.items ?? (po.items ? po.items.length : 0);
  }
  return base;
}

interface ValidatedLine {
  variantId: string;
  quantity: number;
  unitCost: number;
  variant: any;
}

/**
 * Validate PO line shapes (no database except the duplicate-SKU naming
 * lookup, which the caller performs). Returns lines plus, when the same
 * SKU appears twice, the duplicated variant id so the caller can report
 * it with its SKU code. Throws PurchaseError on any shape problem.
 * Deliberately does NOT read grandTotal / paidTotal / debtTotal /
 * paymentStatus from the body — totals are always recomputed.
 */
function validateLines(body: unknown): { raw: Omit<ValidatedLine, "variant">[]; duplicateVariantId?: string; error?: string } {
  if (!body || typeof body !== "object" || !Array.isArray((body as { items?: unknown }).items)) {
    return { raw: [], error: "Đơn nhập phải có danh sách dòng hàng items (mỗi dòng bắt buộc có variantId là SKU)." };
  }
  const items = (body as { items: unknown[] }).items;
  if (items.length === 0) {
    return { raw: [], error: "Đơn nhập phải có ít nhất một dòng hàng." };
  }
  const seen = new Set<string>();
  const raw: Omit<ValidatedLine, "variant">[] = [];
  for (const entry of items) {
    if (!entry || typeof entry !== "object") {
      return { raw: [], error: "Mỗi dòng đơn nhập phải là một đối tượng." };
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.productId === "string" && typeof e.variantId !== "string") {
      return { raw: [], error: "Đơn nhập chỉ nhận theo SKU (variantId), không được tạo dòng chỉ bằng sản phẩm cha (productId)." };
    }
    if (typeof e.variantId !== "string" || !e.variantId.trim()) {
      return { raw: [], error: "Mỗi dòng đơn nhập bắt buộc phải có variantId (SKU)." };
    }
    const variantId = String(e.variantId).trim();
    if (seen.has(variantId)) {
      return { raw: [], duplicateVariantId: variantId };
    }
    seen.add(variantId);
    if (!Number.isInteger(e.quantity) || (e.quantity as number) <= 0) {
      return { raw: [], error: "Số lượng mỗi dòng đơn nhập phải là số nguyên lớn hơn 0." };
    }
    if (e.unitCost === undefined || e.unitCost === null || typeof e.unitCost !== "number" || !Number.isInteger(e.unitCost) || (e.unitCost as number) < 0) {
      return { raw: [], error: "Đơn giá nhập mỗi dòng phải là số nguyên (đồng) không âm." };
    }
    raw.push({ variantId, quantity: e.quantity as number, unitCost: e.unitCost as number });
  }
  return { raw };
}

/** Resolve live SKUs for validated lines, enforcing the receivable rule. */
async function resolveLines(tx: AnyTx, raw: Omit<ValidatedLine, "variant">[], opts: { allowInactive: boolean }): Promise<ValidatedLine[]> {
  const lines: ValidatedLine[] = [];
  for (const line of raw) {
    const variant = await tx.productVariant.findUnique({
      where: { id: line.variantId },
      include: { product: true },
    });
    if (!variant || variant.deletedAt) {
      // No raw id in the message: the caller supplied an internal
      // variant id, and the user-facing label must be a SKU code.
      throw new PurchaseError("Không tìm thấy SKU cho một dòng trong đơn nhập. Hãy chọn lại SKU từ danh sách gợi ý.", 404);
    }
    if (!opts.allowInactive && !isReceivable(variant)) {
      throw new PurchaseError(
        `SKU ${skuLabel(variant)} đang ngừng bán (biến thể hoặc sản phẩm cha không còn active) nên không được nhập.`,
        400,
      );
    }
    lines.push({ ...line, variant });
  }
  return lines;
}

async function loadPOForWrite(tx: AnyTx, id: string): Promise<any> {
  const po = await tx.purchaseOrder.findUnique({
    where: { id },
    include: { items: { include: { variant: { include: { product: true } } } }, payments: { include: { createdBy: { select: { fullName: true } }, cancelledBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } }, supplier: true },
  });
  if (!po) {
    throw new PurchaseError("Không tìm thấy đơn nhập.", 404);
  }
  return po;
}

/**
 * Precheck that removing `changes` (variantId -> qty to remove) from
 * physical stock never goes negative. Names the offending SKU in the
 * error; the Prisma transaction rollback is the second, authoritative
 * guarantee (applyInventoryChange also refuses negative results).
 */
async function assertStockSufficient(tx: AnyTx, changes: { variantId: string; quantity: number }[], actionLabel: string): Promise<void> {
  const problems: string[] = [];
  for (const change of changes) {
    if (change.quantity <= 0) continue;
    const stock = await tx.inventoryItem.findUnique({ where: { variantId: change.variantId } });
    const physical = stock ? stock.quantity : 0;
    if (physical < change.quantity) {
      const variant = await tx.productVariant.findUnique({ where: { id: change.variantId }, include: { product: true } });
      problems.push(`${skuLabel(variant, change.variantId)}: tồn vật lý ${physical}, cần ${actionLabel} ${change.quantity}`);
    }
  }
  if (problems.length > 0) {
    throw new PurchaseError(
      `Không đủ tồn kho để thực hiện thao tác (${problems.join("; ")}). Toàn bộ thao tác đã bị hủy, không trừ một phần.`,
      400,
    );
  }
}

/** Shared cancel logic for POST /cancel. */
async function performCancel(tx: AnyTx, po: any, actorId: string | null): Promise<any> {
  if (po.status === "draft") {
    assertPurchaseTransition("draft", "cancelled");
    // A draft never touched physical stock, so cancelling it removes
    // nothing.
    return tx.purchaseOrder.update({ where: { id: po.id }, data: { status: "cancelled" } });
  }
  if (po.status === "confirmed") {
    assertPurchaseTransition("confirmed", "cancelled");
    if (po.restored) {
      throw new PurchaseError(`Đơn nhập ${po.code} đã hoàn kho rồi, không được hủy/hoàn kho lần nữa.`, 409);
    }
    // Restore ONLY the not-yet-returned quantity (mirror: cancel of a
    // sales order after a partial return).
    const remaining = po.items
      .map((item: any) => ({ variantId: item.variantId, quantity: item.quantity - (item.returnedQuantity ?? 0) }))
      .filter((l: { quantity: number }) => l.quantity > 0);
    await assertStockSufficient(tx, remaining, "hoàn");
    for (const line of remaining) {
      await applyInventoryChange(tx, {
        variantId: line.variantId,
        type: "purchase_cancelled",
        quantityChanged: -line.quantity,
        reason: `Hoàn kho khi hủy đơn nhập ${po.code}`,
        referenceType: "purchase_order",
        referenceId: po.id,
        actorId,
      });
    }
    return tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "cancelled", restored: true, restoredAt: new Date() },
    });
  }
  // completed / cancelled: assertTransition throws the invalid-transition error.
  assertPurchaseTransition(po.status, "cancelled");
  throw new PurchaseError("Không thể hủy đơn nhập ở trạng thái này.", 400);
}

/* ------------------------------------------------------------------ */
/* GET /api/purchase-orders — list                                     */
/* ------------------------------------------------------------------ */

router.get("/purchase-orders", async (req, res) => {
  try {
    if (!canView(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem đơn nhập." });
      return;
    }
    const prisma = getPrisma();
    const { page, pageSize } = parsePagination(req);
    const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : null;
    const where: Record<string, unknown> = { ...scopeWhere(req) };
    if (q) {
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
      ];
    }
    if (typeof req.query.status === "string" && req.query.status) {
      const status = req.query.status as string;
      if (!["draft", "confirmed", "completed", "cancelled"].includes(status)) {
        res.status(400).json({ status: "error", message: `Trạng thái đơn nhập không hợp lệ: ${status}. MVP chỉ có draft / confirmed / completed / cancelled.` });
        return;
      }
      where.status = status;
    }
    if (typeof req.query.supplierId === "string" && req.query.supplierId) {
      where.supplierId = req.query.supplierId;
    }
    const [total, rows] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { supplier: { select: { name: true, taxCode: true, status: true } }, _count: { select: { items: true } } },
      }),
    ]);
    res.json({ status: "ok", data: rows.map((o: any) => serializePO(o, false, canSeeCosts(req))), page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/purchase-orders/:id — detail                               */
/* ------------------------------------------------------------------ */

router.get("/purchase-orders/:id", async (req, res) => {
  try {
    if (!canView(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem đơn nhập." });
      return;
    }
    const prisma = getPrisma();
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: {
        supplier: true,
        items: { include: { variant: { include: { product: true } } }, orderBy: { createdAt: "asc" } }, payments: { include: { createdBy: { select: { fullName: true } }, cancelledBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!po) {
      res.status(404).json({ status: "error", message: "Không tìm thấy đơn nhập." });
      return;
    }
    if (!inScope(po, req)) {
      res.status(403).json({ status: "error", message: "Đơn nhập này không thuộc phạm vi của bạn." });
      return;
    }
    res.json({ status: "ok", data: serializePO(po, true, canSeeCosts(req)) });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/purchase-orders — create draft (no stock change)          */
/* ------------------------------------------------------------------ */

router.post("/purchase-orders", authorize("purchase.create"), async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { raw, duplicateVariantId, error: lineError } = validateLines(body);
    if (lineError) {
      res.status(400).json({ status: "error", message: lineError });
      return;
    }
    if (duplicateVariantId) {
      // Name the duplicated SKU instead of showing a raw variant id.
      const prisma = getPrisma();
      const variant = await prisma.productVariant.findUnique({ where: { id: duplicateVariantId }, include: { product: true } });
      res.status(400).json({
        status: "error",
        message: `SKU ${skuLabel(variant, duplicateVariantId)} xuất hiện nhiều hơn một dòng trong cùng một đơn nhập. Hãy gộp thành một dòng duy nhất.`,
      });
      return;
    }
    if (typeof body.supplierId !== "string" || !body.supplierId.trim()) {
      res.status(400).json({ status: "error", message: "Đơn nhập bắt buộc phải có nhà cung cấp." });
      return;
    }
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    const prisma = getPrisma();
    const actorId = req.user!.id;

    // PO code is unique; on a rare collision, regenerate and retry the
    // whole transaction (validation runs again, so nothing partial can
    // leak through a retry).
    let created: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generatePurchaseOrderCode();
      try {
        created = await prisma.$transaction(async (tx: AnyTx) => {
          const supplier = await tx.supplier.findUnique({ where: { id: String(body.supplierId).trim() } });
          if (!supplier) {
            throw new PurchaseError("Không tìm thấy nhà cung cấp.", 404);
          }
          if (supplier.status !== "active") {
            throw new PurchaseError("Nhà cung cấp đang ngừng hợp tác nên không được tạo đơn nhập.", 400);
          }
          const lines = await resolveLines(tx, raw, { allowInactive: false });
          const totals = computePurchaseTotals(
            lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost })),
            0,
          );
          const po = await tx.purchaseOrder.create({
            data: {
              code,
              supplierId: supplier.id,
              status: "draft",
              paymentStatus: totals.paymentStatus,
              grandTotal: totals.grandTotal,
              paidTotal: 0,
              debtTotal: totals.grandTotal,
              note,
              createdById: actorId,
              items: {
                create: lines.map((l, idx) => ({
                  variantId: l.variantId,
                  skuSnapshot: l.variant.sku,
                  productNameSnapshot: l.variant.product.name,
                  variantNameSnapshot: l.variant.variantName,
                  quantity: l.quantity,
                  unitCost: totals.lines[idx].unitCost,
                  lineTotal: totals.lines[idx].lineTotal,
                })),
              },
            },
            include: { supplier: { select: { name: true, taxCode: true, status: true } }, items: { include: { variant: { include: { product: true } } } }, payments: { include: { createdBy: { select: { fullName: true } }, cancelledBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } } },
          });
          // Draft POs deliberately change NO stock: the goods do not
          // exist yet, so there is nothing to hold or reserve.
          await writeAudit(tx, {
            actorId,
            action: "purchase_order.create",
            entityType: "purchase_order",
            entityId: po.id,
            newValue: { code, supplierId: supplier.id, grandTotal: totals.grandTotal, items: lines.map((l) => ({ sku: l.variant.sku, quantity: l.quantity, unitCost: l.unitCost })) },
            ipAddress: req.ip ?? null,
          });
          return po;
        });
        break;
      } catch (err) {
        if (isPrismaUniqueError(err) && attempt < 4) continue;
        throw err;
      }
    }
    if (!created) {
      res.status(500).json({ status: "error", message: "Không tạo được mã đơn nhập sau nhiều lần thử. Vui lòng thử lại." });
      return;
    }
    res.status(201).json({ status: "ok", data: serializePO(created, true, canSeeCosts(req)) });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /api/purchase-orders/:id — draft only                         */
/* ------------------------------------------------------------------ */

router.patch("/purchase-orders/:id", authorize("purchase.create"), async (req, res) => {
  // NCC-2 defines no separate purchase.update permission: creating and
  // editing a draft belong to the same drafting lifecycle, so draft
  // edits are authorized by purchase.create (documented here so a
  // future purchase.update split does not silently widen access).
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const hasItems = body.items !== undefined;
    let raw: Omit<ValidatedLine, "variant">[] = [];
    if (hasItems) {
      const v = validateLines(body);
      if (v.error) {
        res.status(400).json({ status: "error", message: v.error });
        return;
      }
      if (v.duplicateVariantId) {
        const prisma = getPrisma();
        const variant = await prisma.productVariant.findUnique({ where: { id: v.duplicateVariantId }, include: { product: true } });
        res.status(400).json({
          status: "error",
          message: `SKU ${skuLabel(variant, v.duplicateVariantId)} xuất hiện nhiều hơn một dòng trong cùng một đơn nhập. Hãy gộp thành một dòng duy nhất.`,
        });
        return;
      }
      raw = v.raw;
    }
    const note = typeof body.note === "string" ? (body.note.trim() ? body.note.trim() : null) : undefined;
    const prisma = getPrisma();
    const actorId = req.user!.id;
    const updated = await prisma.$transaction(async (tx: AnyTx) => {
      const po = await loadPOForWrite(tx, req.params.id);
      if (!inScope(po, req)) {
        throw new PurchaseError("Đơn nhập này không thuộc phạm vi của bạn.", 403);
      }
      if (typeof body.supplierId === "string" && body.supplierId.trim() && body.supplierId.trim() !== po.supplierId) {
        // Changing the supplier is deliberately not supported on a
        // draft: cancel and recreate instead (keeps scope simple, same
        // rule as changing the customer of a sales draft). Sending the
        // same supplier back is a no-op and is allowed.
        throw new PurchaseError("Không đổi nhà cung cấp của đơn nhập nháp. Hãy hủy đơn và tạo đơn mới cho nhà cung cấp khác.", 400);
      }
      if (po.status !== "draft") {
        throw new PurchaseError(`Chỉ sửa được đơn nhập nháp. Đơn đang ở trạng thái "${po.status}" nên không sửa dòng/tổng tiền được nữa.`, 400);
      }
      let lines: ValidatedLine[];
      if (hasItems) {
        lines = await resolveLines(tx, raw, { allowInactive: false });
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: po.id } });
      } else {
        lines = po.items.map((i: any) => ({
          variantId: i.variantId,
          quantity: i.quantity,
          unitCost: i.unitCost,
          variant: i.variant,
        }));
      }
      const totals = computePurchaseTotals(
        lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost })),
        0,
      );
      const data: Record<string, unknown> = {
        grandTotal: totals.grandTotal,
        paidTotal: 0,
        debtTotal: totals.grandTotal,
        paymentStatus: totals.paymentStatus,
      };
      if (note !== undefined) data.note = note;
      if (hasItems) {
        data.items = {
          create: lines.map((l, idx) => ({
            variantId: l.variantId,
            skuSnapshot: l.variant.sku,
            productNameSnapshot: l.variant.product.name,
            variantNameSnapshot: l.variant.variantName,
            quantity: l.quantity,
            unitCost: totals.lines[idx].unitCost,
            lineTotal: totals.lines[idx].lineTotal,
          })),
        };
      }
      const saved = await tx.purchaseOrder.update({
        where: { id: po.id },
        data,
        include: { supplier: { select: { name: true, taxCode: true, status: true } }, items: { include: { variant: { include: { product: true } } } }, payments: { include: { createdBy: { select: { fullName: true } }, cancelledBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } } },
      });
      await writeAudit(tx, {
        actorId,
        action: "purchase_order.update_draft",
        entityType: "purchase_order",
        entityId: po.id,
        oldValue: { status: po.status, grandTotal: po.grandTotal },
        newValue: { grandTotal: totals.grandTotal },
        ipAddress: req.ip ?? null,
      });
      return saved;
    });
    res.json({ status: "ok", data: serializePO(updated, true, canSeeCosts(req)) });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/purchase-orders/:id/confirm — draft -> confirmed (receive) */
/* ------------------------------------------------------------------ */

router.post("/purchase-orders/:id/confirm", authorize("purchase.confirm"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const actorId = req.user!.id;
    const updated = await prisma.$transaction(async (tx: AnyTx) => {
      const po = await loadPOForWrite(tx, req.params.id);
      if (!inScope(po, req)) {
        throw new PurchaseError("Đơn nhập này không thuộc phạm vi của bạn.", 403);
      }
      assertPurchaseTransition(po.status, "confirmed");
      if (po.received) {
        throw new PurchaseError(`Đơn nhập ${po.code} đã nhận hàng rồi, không được nhận hàng lần nữa.`, 409);
      }
      if (!po.items || po.items.length === 0) {
        throw new PurchaseError("Đơn nhập không có dòng hàng nào để nhận.", 400);
      }
      // Recheck at confirm time: the supplier or a SKU may have gone
      // inactive after the draft was created.
      if (po.supplier?.status !== "active") {
        throw new PurchaseError("Nhà cung cấp đang ngừng hợp tác nên không được xác nhận nhận hàng.", 400);
      }
      for (const item of po.items) {
        const variant = item.variant ?? (await tx.productVariant.findUnique({ where: { id: item.variantId }, include: { product: true } }));
        if (!isReceivable(variant)) {
          throw new PurchaseError(
            `SKU ${skuLabel(variant, item.variantId)} đang ngừng bán (biến thể hoặc sản phẩm cha không còn active) nên không được nhận hàng.`,
            400,
          );
        }
      }
      // Receive ALL lines in full (no partial receipt in v1), in the
      // same transaction as the status change — any failure rolls
      // back the whole receipt, no partial stock increase.
      for (const item of po.items) {
        await applyInventoryChange(tx, {
          variantId: item.variantId,
          type: "purchase_received",
          quantityChanged: item.quantity,
          reason: `Nhập hàng theo đơn ${po.code}`,
          referenceType: "purchase_order",
          referenceId: po.id,
          actorId,
        });
      }
      const saved = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: "confirmed", received: true, receivedAt: new Date() },
        include: { supplier: { select: { name: true, taxCode: true, status: true } }, items: { include: { variant: { include: { product: true } } } }, payments: { include: { createdBy: { select: { fullName: true } }, cancelledBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } } },
      });
      await writeAudit(tx, {
        actorId,
        action: "purchase_order.confirm",
        entityType: "purchase_order",
        entityId: po.id,
        oldValue: { status: "draft" },
        newValue: { status: "confirmed", received: true },
        ipAddress: req.ip ?? null,
      });
      return saved;
    });
    res.json({ status: "ok", data: serializePO(updated, true, canSeeCosts(req)) });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/purchase-orders/:id/complete — confirmed -> completed     */
/* ------------------------------------------------------------------ */

router.post("/purchase-orders/:id/complete", authorize("purchase.complete"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const actorId = req.user!.id;
    const updated = await prisma.$transaction(async (tx: AnyTx) => {
      const po = await loadPOForWrite(tx, req.params.id);
      if (!inScope(po, req)) {
        throw new PurchaseError("Đơn nhập này không thuộc phạm vi của bạn.", 403);
      }
      assertPurchaseTransition(po.status, "completed");
      const saved = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: "completed" },
        include: { supplier: { select: { name: true, taxCode: true, status: true } }, items: { include: { variant: { include: { product: true } } } }, payments: { include: { createdBy: { select: { fullName: true } }, cancelledBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } } },
      });
      await writeAudit(tx, {
        actorId,
        action: "purchase_order.complete",
        entityType: "purchase_order",
        entityId: po.id,
        oldValue: { status: "confirmed" },
        newValue: { status: "completed" },
        ipAddress: req.ip ?? null,
      });
      return saved;
    });
    res.json({ status: "ok", data: serializePO(updated, true, canSeeCosts(req)) });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/purchase-orders/:id/cancel — draft / confirmed only       */
/* ------------------------------------------------------------------ */

router.post("/purchase-orders/:id/cancel", authorize("purchase.cancel"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const actorId = req.user!.id;
    const updated = await prisma.$transaction(async (tx: AnyTx) => {
      const po = await loadPOForWrite(tx, req.params.id);
      if (!inScope(po, req)) {
        throw new PurchaseError("Đơn nhập này không thuộc phạm vi của bạn.", 403);
      }
      const oldStatus = po.status;
      const saved = await performCancel(tx, po, actorId);
      await writeAudit(tx, {
        actorId,
        action: "purchase_order.cancel",
        entityType: "purchase_order",
        entityId: po.id,
        oldValue: { status: oldStatus },
        newValue: { status: "cancelled" },
        ipAddress: req.ip ?? null,
      });
      return saved;
    });
    const full = await getPrisma().purchaseOrder.findUnique({
      where: { id: (updated as any).id },
      include: { supplier: { select: { name: true, taxCode: true, status: true } }, items: { include: { variant: { include: { product: true } } } }, payments: { include: { createdBy: { select: { fullName: true } }, cancelledBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } } },
    });
    res.json({ status: "ok", data: serializePO(full, true, canSeeCosts(req)) });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/purchase-orders/:id/return — partial return,              */
/* confirmed/completed only                                           */
/* ------------------------------------------------------------------ */

router.post("/purchase-orders/:id/return", authorize("purchase.return"), async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ status: "error", message: "Trả hàng phải có danh sách dòng hàng (items) với số lượng." });
      return;
    }
    const commonReason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
    const prisma = getPrisma();
    const actorId = req.user!.id;
    const updated = await prisma.$transaction(async (tx: AnyTx) => {
      const po = await loadPOForWrite(tx, req.params.id);
      if (!inScope(po, req)) {
        throw new PurchaseError("Đơn nhập này không thuộc phạm vi của bạn.", 403);
      }
      if (po.status !== "confirmed" && po.status !== "completed") {
        throw new PurchaseError(
          `Chỉ trả hàng cho đơn nhập đã xác nhận hoặc đã hoàn thành. Đơn đang ở trạng thái "${po.status}" nên không trả hàng được.`,
          400,
        );
      }
      if (po.restored) {
        throw new PurchaseError(`Đơn nhập ${po.code} đã hoàn kho toàn bộ rồi nên không trả hàng thêm được.`, 409);
      }
      // Aggregate duplicate lines for the same PO item first, then
      // validate every line before applying anything (all-or-nothing).
      const byItem = new Map<string, { item: any; quantity: number; reason: string }>();
      for (const entry of body.items as unknown[]) {
        if (!entry || typeof entry !== "object") {
          throw new PurchaseError("Mỗi dòng trả hàng phải là một đối tượng.", 400);
        }
        const e = entry as Record<string, unknown>;
        const reason = (typeof e.reason === "string" && e.reason.trim() ? e.reason.trim() : commonReason) ?? `Trả hàng đơn ${po.code}`;
        if (!Number.isInteger(e.quantity) || (e.quantity as number) <= 0) {
          throw new PurchaseError("Số lượng trả mỗi dòng phải là số nguyên lớn hơn 0.", 400);
        }
        let item: any = null;
        if (typeof e.purchaseOrderItemId === "string") {
          item = po.items.find((i: any) => i.id === e.purchaseOrderItemId);
          if (!item) throw new PurchaseError("Không tìm thấy dòng đơn nhập yêu cầu trong đơn này. Hãy tải lại chi tiết đơn và chọn lại dòng cần trả.", 404);
        } else if (typeof e.variantId === "string") {
          item = po.items.find((i: any) => i.variantId === e.variantId);
          if (!item) {
            const variant = await tx.productVariant.findUnique({ where: { id: e.variantId }, include: { product: true } });
            throw new PurchaseError(`Đơn nhập này không có dòng SKU ${skuLabel(variant, e.variantId)}.`, 404);
          }
        } else {
          throw new PurchaseError("Mỗi dòng trả hàng phải có purchaseOrderItemId hoặc variantId.", 400);
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
          throw new PurchaseError(
            `Số lượng trả vượt số còn trả được của dòng ${item.skuSnapshot} (còn trả được ${remaining}, yêu cầu ${quantity}). Toàn bộ lần trả đã bị hủy, không trừ một phần.`,
            400,
          );
        }
      }
      // Stock precheck first (SKU-named errors), then apply: decrease
      // stock, then update returned quantities. Return stays allowed
      // even if the SKU/supplier became inactive after receipt — the
      // stock decrease itself never checks active status.
      await assertStockSufficient(
        tx,
        Array.from(byItem.values()).map(({ item, quantity }) => ({ variantId: item.variantId, quantity })),
        "trả",
      );
      for (const { item, quantity, reason } of byItem.values()) {
        await applyInventoryChange(tx, {
          variantId: item.variantId,
          type: "purchase_return",
          quantityChanged: -quantity,
          reason: `Trả hàng đơn ${po.code}: ${reason}`,
          referenceType: "purchase_order",
          referenceId: po.id,
          actorId,
        });
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { returnedQuantity: (item.returnedQuantity ?? 0) + quantity },
        });
        item.returnedQuantity = (item.returnedQuantity ?? 0) + quantity;
      }
      const remainingLines = po.items.map((i: any) => ({
        quantity: i.quantity - (i.returnedQuantity ?? 0),
        unitCost: i.unitCost,
      }));
      const totals = recomputeTotalsAfterReturn(remainingLines, po.paidTotal ?? 0);
      const fullyReturned = po.items.every((i: any) => (i.returnedQuantity ?? 0) >= i.quantity);
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          grandTotal: totals.grandTotal,
          debtTotal: totals.debtTotal,
          paymentStatus: totals.paymentStatus,
          fullyReturned,
        },
      });
      // Sprint NCC-3: a return changes grand_total, so the money
      // totals must be recomputed from ACTIVE supplier payments in the
      // SAME transaction. This is what makes over-return credit real:
      // grand_total below paid_total yields negative debt with status
      // "paid", never stale totals from before the return.
      const recalc = await recalculatePurchasePaymentTotals(tx, po.id);
      const saved = await tx.purchaseOrder.findUnique({
        where: { id: po.id },
        include: { supplier: { select: { name: true, taxCode: true, status: true } }, items: { include: { variant: { include: { product: true } } } }, payments: { include: { createdBy: { select: { fullName: true } }, cancelledBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } } },
      });
      await writeAudit(tx, {
        actorId,
        action: "purchase_order.return",
        entityType: "purchase_order",
        entityId: po.id,
        oldValue: { grandTotal: po.grandTotal, paidTotal: po.paidTotal, debtTotal: po.debtTotal },
        newValue: {
          grandTotal: totals.grandTotal,
          paidTotal: recalc.totals.paidTotal,
          debtTotal: recalc.totals.debtTotal,
          paymentStatus: recalc.totals.paymentStatus,
          fullyReturned,
          returned: Array.from(byItem.values()).map(({ item, quantity, reason }) => ({ sku: item.skuSnapshot, quantity, reason })),
        },
        ipAddress: req.ip ?? null,
      });
      return saved;
    });
    res.json({ status: "ok", data: serializePO(updated, true, canSeeCosts(req)) });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
