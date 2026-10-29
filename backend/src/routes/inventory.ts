/**
 * Inventory API — Sprint Kho.
 *
 * Locked rules applied here (§2, §6):
 *  §2.1 Every stock change goes through src/lib/inventory.ts inside a
 *      Prisma $transaction. No route in this file (or anywhere else)
 *      writes InventoryItem.quantity directly.
 *  §2.4 No negative stock in MVP, bulk operations are all-or-nothing,
 *      and every manual operation requires a reason (initial may omit
 *      it and gets the default reason "Nhập tồn ban đầu").
 *  §2.2 Transaction types are exactly the schema enum; history rows are
 *      immutable — there is deliberately NO route to edit or delete a
 *      transaction.
 *  §6  Backend permission checks on every route. Warehouse does stock
 *      operations; sales/manager viewing is read-only by default.
 *
 * Inactive-SKU policy (this sprint, see DEVELOPMENT_PLAN.md):
 *  initial / import / export are blocked for inactive variants or
 *  inactive parent products; adjust is allowed for inactive SKUs
 *  (stocktaking / write-off) with a mandatory reason, flagged as a
 *  warning in the response. The Order sprint's deductForOrder blocks
 *  inactive SKUs outright.
 *
 * Deliberately NOT in this sprint:
 *  - Orders / payments (deductForOrder / restoreForOrder exist in the
 *    service for the Order sprint to call; no order route uses them yet).
 *  - A low-stock threshold column: the schema has no such field, so
 *    GET /inventory supports ?maxQuantity=N as a caller-supplied filter
 *    instead of inventing a column (recorded as backlog).
 *  - Multi-warehouse: InventoryItem.warehouseCode stays "MAIN" in MVP.
 */

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import {
  bulkAdjust,
  bulkStock,
  isInventoryError,
  type BulkResult,
  type StockLine,
} from "../lib/inventory";
import { getPrisma } from "../lib/prisma";

const router = Router();
router.use(authenticate);

type AnyTx = any;
type AnyReq = import("express").Request;
type AnyRes = import("express").Response;

function dbUnavailable(res: AnyRes, err: unknown) {
  console.error("[inventory] database error:", err);
  res.status(503).json({
    status: "error",
    message: "Chưa kết nối được database. Hãy chạy PostgreSQL (docker compose up -d postgres) rồi thử lại.",
  });
}

function handleError(res: AnyRes, err: unknown): void {
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

function serializeItem(row: any) {
  const v = row.variant;
  return {
    variantId: row.variantId,
    warehouseCode: row.warehouseCode,
    quantity: row.quantity,
    updatedAt: row.updatedAt,
    sku: v?.sku ?? null,
    variantName: v?.variantName ?? null,
    variantStatus: v?.status ?? null,
    productId: v?.productId ?? null,
    productName: v?.product?.name ?? null,
    productStatus: v?.product?.status ?? null,
    categoryId: v?.product?.categoryId ?? null,
    categoryName: v?.product?.category?.name ?? null,
    isSellable: v && v.status === "active" && v.product && v.product.status === "active",
  };
}

function serializeTransaction(t: any) {
  return {
    id: t.id,
    variantId: t.productVariantId,
    sku: t.variant?.sku ?? null,
    variantName: t.variant?.variantName ?? null,
    productName: t.variant?.product?.name ?? null,
    transactionType: t.transactionType,
    quantityBefore: t.quantityBefore,
    quantityChanged: t.quantityChanged,
    quantityAfter: t.quantityAfter,
    reason: t.reason,
    referenceType: t.referenceType,
    referenceId: t.referenceId,
    createdById: t.createdById,
    createdAt: t.createdAt,
  };
}

/**
 * Normalise a request body into stock lines. Accepts either a single
 * line ({variantId, quantity, ...}) or a bulk body ({items: [...]}).
 * A common reason in the body is used as the fallback for lines that
 * do not carry their own reason.
 */
function parseLines(body: any): { lines: StockLine[]; commonReason: string | null } {
  const commonReason = typeof body?.reason === "string" ? body.reason : null;
  if (Array.isArray(body?.items)) {
    return {
      lines: body.items.map((it: any) => ({
        variantId: it?.variantId,
        quantity: it?.quantity,
        setTo: it?.setTo,
        mode: it?.mode,
        reason: typeof it?.reason === "string" ? it.reason : undefined,
      })),
      commonReason,
    };
  }
  return {
    lines: [{
      variantId: body?.variantId,
      quantity: body?.quantity,
      setTo: body?.setTo,
      mode: body?.mode,
      reason: undefined,
    }],
    commonReason,
  };
}

function validateLineIds(lines: StockLine[]): void {
  for (const line of lines) {
    if (typeof line.variantId !== "string" || !line.variantId.trim()) {
      throw new Error("Mỗi dòng kho phải có variantId (id của SKU).");
    }
  }
}

async function auditResults(
  tx: AnyTx,
  actorId: string | null,
  action: string,
  results: BulkResult[],
  ip: string | null,
): Promise<void> {
  for (const r of results) {
    await writeAudit(tx, {
      actorId,
      action,
      entityType: "inventory",
      entityId: r.variantId,
      oldValue: { quantityBefore: r.quantityBefore, sku: r.sku },
      newValue: {
        quantityAfter: r.quantityAfter,
        quantityChanged: r.quantityChanged,
        transactionId: r.transactionId,
        skipped: r.skipped ?? false,
        inactiveWarning: r.inactiveWarning ?? false,
      },
      ipAddress: ip,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Read: stock list, one SKU, history                                  */
/* ------------------------------------------------------------------ */

/** GET /api/inventory — stock per SKU, paginated, filterable. */
router.get("/inventory", authorize("inventory.view"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const { page, pageSize } = parsePagination(req);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : "";
    const variantStatus = typeof req.query.variantStatus === "string" ? req.query.variantStatus : "";
    const maxQuantity = req.query.maxQuantity !== undefined ? Number(req.query.maxQuantity) : NaN;
    const sort = typeof req.query.sort === "string" ? req.query.sort : "";

    const variantWhere: Record<string, unknown> = {};
    if (variantStatus) {
      if (variantStatus !== "active" && variantStatus !== "inactive") {
        res.status(400).json({ status: "error", message: "Trạng thái SKU chỉ nhận active/inactive." });
        return;
      }
      variantWhere.status = variantStatus;
    }
    if (categoryId) variantWhere.product = { categoryId };
    if (q) {
      const upperQ = q.trim().toUpperCase();
      variantWhere.OR = [
        { sku: { contains: upperQ, mode: "insensitive" } },
        { variantName: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
        { product: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const where: Record<string, unknown> = {};
    if (Object.keys(variantWhere).length > 0) where.variant = variantWhere;
    if (!Number.isNaN(maxQuantity)) {
      if (!Number.isInteger(maxQuantity) || maxQuantity < 0) {
        res.status(400).json({ status: "error", message: "maxQuantity phải là số nguyên không âm." });
        return;
      }
      where.quantity = { lte: maxQuantity };
    }

    const orderBy: any =
      sort === "low_stock" ? { quantity: "asc" }
      : sort === "high_stock" ? { quantity: "desc" }
      : { variant: { sku: "asc" } };

    const [total, rows] = await Promise.all([
      prisma.inventoryItem.count({ where }),
      prisma.inventoryItem.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { variant: { include: { product: { include: { category: true } } } } },
      }),
    ]);
    res.json({
      status: "ok",
      page, pageSize, total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      items: rows.map((r: any) => serializeItem(r)),
      lowStockNote: "Chưa có cột ngưỡng tồn thấp trong schema, nên lọc tồn thấp dùng ?maxQuantity=N do người dùng nhập (xem DEVELOPMENT_PLAN.md).",
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** GET /api/inventory/:variantId — current stock of one SKU. */
router.get("/inventory/:variantId", authorize("inventory.view"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const variant = await prisma.productVariant.findUnique({
      where: { id: req.params.variantId },
      include: { product: { include: { category: true } } },
    });
    if (!variant || variant.deletedAt) {
      res.status(404).json({ status: "error", message: "Không tìm thấy SKU." });
      return;
    }
    const item = await prisma.inventoryItem.findUnique({ where: { variantId: variant.id } });
    const transactionCount = await prisma.inventoryTransaction.count({ where: { productVariantId: variant.id } });
    res.json({
      status: "ok",
      item: item
        ? serializeItem({ ...item, variant })
        : {
            variantId: variant.id,
            warehouseCode: "MAIN",
            quantity: 0,
            updatedAt: null,
            sku: variant.sku,
            variantName: variant.variantName,
            variantStatus: variant.status,
            productId: variant.productId,
            productName: variant.product?.name ?? null,
            productStatus: variant.product?.status ?? null,
            categoryId: variant.product?.categoryId ?? null,
            categoryName: variant.product?.category?.name ?? null,
            isSellable: variant.status === "active" && variant.product?.status === "active",
            note: "SKU chưa có dòng tồn — tồn đang là 0 và chưa có transaction nào.",
          },
      transactionCount,
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** GET /api/inventory/:variantId/transactions — immutable history of one SKU. */
router.get("/inventory/:variantId/transactions", authorize("inventory.view_transactions"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const { page, pageSize } = parsePagination(req);
    const variant = await prisma.productVariant.findUnique({ where: { id: req.params.variantId } });
    if (!variant || variant.deletedAt) {
      res.status(404).json({ status: "error", message: "Không tìm thấy SKU." });
      return;
    }
    const type = typeof req.query.type === "string" ? req.query.type : "";
    const from = typeof req.query.from === "string" ? new Date(req.query.from) : null;
    const to = typeof req.query.to === "string" ? new Date(req.query.to) : null;
    const where: Record<string, unknown> = { productVariantId: variant.id };
    if (type) where.transactionType = type;
    if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
      where.createdAt = {
        ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
        ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
      };
    }
    const [total, rows] = await Promise.all([
      prisma.inventoryTransaction.count({ where }),
      prisma.inventoryTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { variant: { include: { product: true } } },
      }),
    ]);
    res.json({
      status: "ok",
      page, pageSize, total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      transactions: rows.map((t: any) => serializeTransaction(t)),
      note: "Lịch sử kho là bất biến — không có API sửa/xóa transaction.",
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* Manual operations — all inside one $transaction per request         */
/* ------------------------------------------------------------------ */

/** POST /api/inventory/initial — first stock only; a second initial is 409. */
router.post("/inventory/initial", authorize("inventory.import_stock"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const { lines, commonReason } = parseLines(req.body ?? {});
    validateLineIds(lines);
    const results = await prisma.$transaction(async (tx: AnyTx) => {
      const out = await bulkStock(tx, "initial", lines, commonReason, req.user!.id);
      await auditResults(tx, req.user!.id, "inventory.initial", out, req.ip ?? null);
      return out;
    });
    res.json({ status: "ok", results });
  } catch (err) {
    handleError(res, err);
  }
});

/** POST /api/inventory/import — increase stock, reason required. */
router.post("/inventory/import", authorize("inventory.import_stock"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const { lines, commonReason } = parseLines(req.body ?? {});
    validateLineIds(lines);
    const results = await prisma.$transaction(async (tx: AnyTx) => {
      const out = await bulkStock(tx, "import", lines, commonReason, req.user!.id);
      await auditResults(tx, req.user!.id, "inventory.import", out, req.ip ?? null);
      return out;
    });
    res.json({ status: "ok", results });
  } catch (err) {
    handleError(res, err);
  }
});

/** POST /api/inventory/export — decrease stock, reason required, all-or-nothing. */
router.post("/inventory/export", authorize("inventory.export"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const { lines, commonReason } = parseLines(req.body ?? {});
    validateLineIds(lines);
    const results = await prisma.$transaction(async (tx: AnyTx) => {
      const out = await bulkStock(tx, "export", lines, commonReason, req.user!.id);
      await auditResults(tx, req.user!.id, "inventory.export", out, req.ip ?? null);
      return out;
    });
    res.json({ status: "ok", results });
  } catch (err) {
    handleError(res, err);
  }
});

/** POST /api/inventory/adjust — increase / decrease / set, reason required. */
router.post("/inventory/adjust", authorize("inventory.adjust"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const { lines, commonReason } = parseLines(req.body ?? {});
    validateLineIds(lines);
    const adjustLines = lines.map((l) => {
      if (l.mode !== "increase" && l.mode !== "decrease" && l.mode !== "set") {
        throw new Error("Mỗi dòng điều chỉnh phải có mode là increase / decrease / set.");
      }
      return { ...l, mode: l.mode as "increase" | "decrease" | "set" };
    });
    const results = await prisma.$transaction(async (tx: AnyTx) => {
      const out = await bulkAdjust(tx, adjustLines, commonReason, req.user!.id);
      await auditResults(tx, req.user!.id, "inventory.adjust", out, req.ip ?? null);
      return out;
    });
    res.json({ status: "ok", results });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Mỗi dòng")) {
      res.status(400).json({ status: "error", message: err.message });
      return;
    }
    handleError(res, err);
  }
});

export default router;
