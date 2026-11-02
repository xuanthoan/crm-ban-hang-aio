/**
 * Purchase-order library — Sprint NCC-2 (đơn nhập hàng).
 *
 * Mirrors src/lib/orders.ts with the stock direction reversed and the
 * money model simplified to integer VND (đồng nguyên):
 *  §1  Only a SKU (ProductVariant) is received, never the parent
 *      product. Every PO line carries snapshots taken at receipt time.
 *  §2  Physical stock changes ONLY through src/lib/inventory.ts.
 *      Draft POs change NO stock (unlike sales drafts, a purchase draft
 *      holds nothing — the goods do not exist yet). Confirm adds stock
 *      (purchase_received) exactly once; cancel of a confirmed PO
 *      removes only the NOT-YET-RETURNED quantity
 *      (purchase_cancelled) exactly once; partial returns use
 *      purchase_return. No negative stock: any operation that would
 *      drive a SKU negative is blocked and rolled back entirely.
 *  §3  Money is recomputed by the backend. NCC-2 has no payments yet,
 *      so paid_total is always 0 and debt_total = grand_total.
 *      Sprint NCC-3 recomputes paid/debt/status from active supplier
 *      payments — frontend values are never trusted as input.
 *  §7.1 No partial receipt in v1: confirm receives ALL lines in full.
 *  §7.2 Receiving NEVER rewrites a variant's current importPrice;
 *      the PO line keeps its own unitCost snapshot only.
 *  §7.5 No per-line discount, order discount, shipping fee or tax on
 *      POs in v1: grandTotal = Σ quantity × unitCost.
 *
 * This file has NO imports on purpose, so the pure functions can be
 * tested without a generated Prisma client (same pattern as
 * src/lib/inventory.ts and src/lib/orders.ts).
 */

export type PurchaseOrderStatus = "draft" | "confirmed" | "completed" | "cancelled";

export class PurchaseError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function isPurchaseError(err: unknown): err is PurchaseError {
  return err instanceof PurchaseError;
}

/* ------------------------------------------------------------------ */
/* Money — integer VND (đồng nguyên)                                  */
/* ------------------------------------------------------------------ */

export interface PurchaseLineInput {
  variantId: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseTotals {
  grandTotal: number;
  paidTotal: number;
  debtTotal: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  lines: { quantity: number; unitCost: number; lineTotal: number }[];
}

function paymentStatusFor(grandTotal: number, paidTotal: number): "unpaid" | "partial" | "paid" {
  if (grandTotal <= 0) return "paid";
  if (paidTotal <= 0) return "unpaid";
  if (paidTotal < grandTotal) return "partial";
  return "paid";
}

/**
 * Compute PO totals from lines. Pure: no database. Throws on any
 * invalid line — the caller's transaction rolls back, so no partial PO
 * is ever created.
 */
export function computePurchaseTotals(lines: PurchaseLineInput[], paidTotalInput = 0): PurchaseTotals {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new PurchaseError("Đơn nhập phải có ít nhất một dòng hàng.", 400);
  }
  if (!Number.isInteger(paidTotalInput) || paidTotalInput < 0) {
    throw new PurchaseError("Số tiền đã trả phải là số nguyên không âm.", 400);
  }
  const computedLines: PurchaseTotals["lines"] = [];
  let grandTotal = 0;
  for (const line of lines) {
    if (!line || typeof line.variantId !== "string" || !line.variantId) {
      throw new PurchaseError("Mỗi dòng đơn nhập phải có variantId (SKU), không được tạo dòng chỉ bằng sản phẩm cha.", 400);
    }
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new PurchaseError("Số lượng mỗi dòng đơn nhập phải là số nguyên lớn hơn 0.", 400);
    }
    if (!Number.isInteger(line.unitCost) || line.unitCost < 0) {
      throw new PurchaseError("Đơn giá nhập mỗi dòng phải là số nguyên (đồng) không âm.", 400);
    }
    const lineTotal = line.quantity * line.unitCost;
    grandTotal += lineTotal;
    computedLines.push({ quantity: line.quantity, unitCost: line.unitCost, lineTotal });
  }
  return {
    grandTotal,
    paidTotal: paidTotalInput,
    debtTotal: grandTotal - paidTotalInput,
    paymentStatus: paymentStatusFor(grandTotal, paidTotalInput),
    lines: computedLines,
  };
}

/**
 * Recompute totals after a partial return. remainingLines carry the
 * quantities still kept (quantity - returnedQuantity). There are no
 * discounts in v1, so nothing is prorated: a fully returned line
 * contributes 0. paidTotal is carried over (0 in NCC-2); NCC-3 will
 * recompute it from active payments, and a grandTotal below paidTotal
 * then means supplier credit (debt negative, status stays "paid").
 */
export function recomputeTotalsAfterReturn(
  remainingLines: { quantity: number; unitCost: number }[],
  paidTotalInput = 0,
): { grandTotal: number; debtTotal: number; paymentStatus: "unpaid" | "partial" | "paid" } {
  let grandTotal = 0;
  for (const line of remainingLines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 0) {
      throw new PurchaseError("Số lượng còn lại mỗi dòng phải là số nguyên không âm.", 400);
    }
    if (!Number.isInteger(line.unitCost) || line.unitCost < 0) {
      throw new PurchaseError("Đơn giá nhập mỗi dòng phải là số nguyên (đồng) không âm.", 400);
    }
    grandTotal += line.quantity * line.unitCost;
  }
  return {
    grandTotal,
    debtTotal: grandTotal - paidTotalInput,
    paymentStatus: paymentStatusFor(grandTotal, paidTotalInput),
  };
}

/* ------------------------------------------------------------------ */
/* Status transitions — MVP: draft / confirmed / completed / cancelled */
/* ------------------------------------------------------------------ */

const ALLOWED_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function assertPurchaseTransition(from: string, to: PurchaseOrderStatus): void {
  const allowed = (ALLOWED_TRANSITIONS as Record<string, PurchaseOrderStatus[]>)[from];
  if (!allowed || !allowed.includes(to)) {
    throw new PurchaseError(
      `Không thể chuyển đơn nhập từ trạng thái "${from}" sang "${to}". Luồng MVP chỉ cho: nháp → xác nhận (nhận hàng)/hủy, đã xác nhận → hoàn thành/hủy.`,
      400,
    );
  }
}

/**
 * Generate a purchase-order code: NH-YYYYMMDD-XXXXXX (random suffix).
 * The caller retries on a unique-constraint conflict (see
 * routes/purchases.ts), same pattern as sales-order codes.
 */
export function generatePurchaseOrderCode(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
  return `NH-${y}${m}${d}-${suffix}`;
}
