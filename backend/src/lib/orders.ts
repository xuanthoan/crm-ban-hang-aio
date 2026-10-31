/**
 * Order library — Sprint Đơn hàng.
 *
 * Locked rules applied here (docs/12_QUY_TAC_CHOT_CUNG.md):
 *  §1  Only a SKU (ProductVariant) is sold, never the parent product.
 *      Every order line carries snapshots taken at sale time.
 *  §2  Physical stock changes ONLY through src/lib/inventory.ts.
 *      This file touches ONLY InventoryItem.reservedQuantity (the draft
 *      hold) — never InventoryItem.quantity. Confirm / cancel / return
 *      call the inventory service for physical movement.
 *  §3  Money is recomputed by the backend. In this sprint paid_total is
 *      always 0 (no payments yet — Payment sprint recomputes it from
 *      active payments) and debt_total = grand_total - paid_total.
 *
 * Reservation model (owner decision 2026-10-29: draft orders HOLD stock,
 * MVP statuses are draft / confirmed / completed / cancelled only):
 *  - available = quantity - reservedQuantity.
 *  - Draft create / draft edit: reserve (reservedQuantity += qty) after
 *    checking available >= qty for every line, all-or-nothing.
 *  - draft -> confirmed: reserved -= qty, then inventory service deducts
 *    physical quantity (order_confirmed) and sets inventoryDeducted.
 *  - draft -> cancelled: reserved -= qty, physical unchanged.
 *  - confirmed -> cancelled: inventory service restores only the
 *    NOT-YET-RETURNED quantity (order_cancelled) and sets
 *    inventoryRestored. It must NOT call restoreForOrder() when part of
 *    the order was already returned, because that helper restores the
 *    FULL original quantity and would double-restore the returned part.
 *  - confirmed/completed -> return (partial): inventory service adds
 *    the returned quantity back (type "return"), returnedQuantity +=
 *    qty, totals recomputed from remaining quantities. Status unchanged.
 *    fullyReturned = true when every line is fully returned.
 *
 * Money model (all amounts in VND, 2 decimals, computed in integer
 * cents to avoid float drift):
 *  - lineTotal = quantity * unitPrice - lineDiscountAmount.
 *  - subtotal  = sum of lineTotals.
 *  - grandTotal = subtotal - discountTotal + shippingFee, with
 *    discountTotal capped at subtotal after a return (a discount cannot
 *    exceed the value of the goods still kept).
 *  - On return, a line's discountAmount is kept while the line still
 *    has remaining quantity and dropped to 0 when the line is fully
 *    returned (its lineTotal is then 0 anyway).
 *  - paymentStatus: grandTotal == 0 -> "paid" (nothing owed);
 *    otherwise paid_total (0 in this sprint) == 0 -> "unpaid".
 *    The Payment sprint recomputes this from active payments.
 *
 * This file has NO imports on purpose, so the pure functions can be
 * tested with ts-node --transpile-only without a generated Prisma
 * client (same pattern as src/lib/inventory.ts).
 */

export type OrderStatus = "draft" | "confirmed" | "completed" | "cancelled";

export class OrderError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function isOrderError(err: unknown): err is OrderError {
  return err instanceof OrderError;
}

/* ------------------------------------------------------------------ */
/* Money — integer cents                                             */
/* ------------------------------------------------------------------ */

export function toCents(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  if (typeof n !== "number" || Number.isNaN(n)) {
    throw new OrderError("Số tiền không hợp lệ.", 400);
  }
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Round a user-supplied money value to 2 decimals (VND). */
export function roundMoney(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new OrderError("Số tiền phải là số không âm.", 400);
  }
  return Math.round(value * 100) / 100;
}

export interface OrderLineInput {
  productVariantId: string;
  quantity: number;
  /** Optional: defaults to the SKU's current selling price (snapshot). */
  unitPrice?: number | null;
  /** Optional per-line discount, default 0, must not exceed qty * price. */
  discountAmount?: number | null;
}

export interface OrderTotals {
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  grandTotal: number;
  paidTotal: number;
  debtTotal: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  lines: { quantity: number; unitPrice: number; discountAmount: number; lineTotal: number }[];
}

function paymentStatusFor(grandCents: number, paidCents: number): "unpaid" | "partial" | "paid" {
  if (grandCents <= 0) return "paid";
  if (paidCents <= 0) return "unpaid";
  if (paidCents < grandCents) return "partial";
  return "paid";
}

/**
 * Compute order totals from lines + order-level discount + shipping.
 * Pure: no database, no rounding surprises (integer cents).
 */
export function computeOrderTotals(
  lines: OrderLineInput[],
  discountTotalInput: number,
  shippingFeeInput: number,
  paidTotalInput = 0,
): OrderTotals {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new OrderError("Đơn hàng phải có ít nhất một dòng hàng.", 400);
  }
  const discountCents = toCents(roundMoney(discountTotalInput));
  const shippingCents = toCents(roundMoney(shippingFeeInput));
  const paidCents = toCents(roundMoney(paidTotalInput));
  const computedLines: OrderTotals["lines"] = [];
  let subtotalCents = 0;
  for (const line of lines) {
    if (!line || typeof line.productVariantId !== "string" || !line.productVariantId) {
      throw new OrderError("Mỗi dòng đơn phải có productVariantId (SKU), không được tạo dòng chỉ bằng sản phẩm cha.", 400);
    }
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new OrderError("Số lượng mỗi dòng đơn phải là số nguyên lớn hơn 0.", 400);
    }
    if (line.unitPrice === undefined || line.unitPrice === null) {
      throw new OrderError("Đơn giá mỗi dòng đơn không được để trống (backend sẽ điền giá bán hiện tại của SKU nếu frontend không gửi).", 400);
    }
    const unitCents = toCents(roundMoney(line.unitPrice));
    const lineDiscountCents = line.discountAmount === undefined || line.discountAmount === null ? 0 : toCents(roundMoney(line.discountAmount));
    const lineGross = line.quantity * unitCents;
    if (lineDiscountCents > lineGross) {
      throw new OrderError("Giảm giá của một dòng không được lớn hơn thành tiền của dòng đó.", 400);
    }
    const lineTotalCents = lineGross - lineDiscountCents;
    subtotalCents += lineTotalCents;
    computedLines.push({
      quantity: line.quantity,
      unitPrice: fromCents(unitCents),
      discountAmount: fromCents(lineDiscountCents),
      lineTotal: fromCents(lineTotalCents),
    });
  }
  if (discountCents > subtotalCents) {
    throw new OrderError("Chiết khấu cấp đơn không được lớn hơn tổng tiền hàng (subtotal).", 400);
  }
  const grandCents = subtotalCents - discountCents + shippingCents;
  return {
    subtotal: fromCents(subtotalCents),
    discountTotal: fromCents(discountCents),
    shippingFee: fromCents(shippingCents),
    grandTotal: fromCents(grandCents),
    paidTotal: fromCents(paidCents),
    debtTotal: fromCents(grandCents - paidCents),
    paymentStatus: paymentStatusFor(grandCents, paidCents),
    lines: computedLines,
  };
}

/**
 * Recompute totals after a partial return. remainingLines carry the
 * quantities still kept; a fully returned line contributes 0 (its
 * discount is dropped with it). The order-level discount is capped at
 * the new subtotal so it can never exceed the kept goods' value.
 */
export function recomputeTotalsAfterReturn(
  remainingLines: { quantity: number; unitPrice: number; discountAmount: number }[],
  oldDiscountTotal: number,
  shippingFee: number,
): { subtotal: number; discountTotal: number; grandTotal: number; debtTotal: number; paymentStatus: "unpaid" | "partial" | "paid" } {
  let subtotalCents = 0;
  for (const line of remainingLines) {
    const unitCents = toCents(roundMoney(line.unitPrice));
    const discountCents = line.quantity === 0 ? 0 : toCents(roundMoney(line.discountAmount));
    subtotalCents += line.quantity * unitCents - discountCents;
  }
  const cappedDiscountCents = Math.min(toCents(roundMoney(oldDiscountTotal)), subtotalCents);
  const shippingCents = toCents(roundMoney(shippingFee));
  const grandCents = subtotalCents - cappedDiscountCents + shippingCents;
  return {
    subtotal: fromCents(subtotalCents),
    discountTotal: fromCents(cappedDiscountCents),
    grandTotal: fromCents(grandCents),
    debtTotal: fromCents(grandCents),
    paymentStatus: paymentStatusFor(grandCents, 0),
  };
}

/* ------------------------------------------------------------------ */
/* Status transitions — MVP: draft / confirmed / completed / cancelled */
/* ------------------------------------------------------------------ */

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function assertTransition(from: string, to: OrderStatus): void {
  const allowed = (ALLOWED_TRANSITIONS as Record<string, OrderStatus[]>)[from];
  if (!allowed || !allowed.includes(to)) {
    throw new OrderError(
      `Không thể chuyển đơn từ trạng thái "${from}" sang "${to}". Luồng MVP chỉ cho: nháp → xác nhận/hủy, đã xác nhận → hoàn thành/hủy.`,
      400,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Reservation — touches ONLY reservedQuantity, never quantity        */
/* ------------------------------------------------------------------ */

export function availableQuantity(item: { quantity: number; reservedQuantity?: number | null }): number {
  return item.quantity - (item.reservedQuantity ?? 0);
}

export interface ReservedLine {
  variantId: string;
  quantity: number;
}

/**
 * Aggregate duplicate variant lines (the API rejects duplicates before
 * this, but aggregation keeps the check correct if called elsewhere).
 */
export function aggregateLines(lines: ReservedLine[]): ReservedLine[] {
  const map = new Map<string, number>();
  for (const line of lines) {
    map.set(line.variantId, (map.get(line.variantId) ?? 0) + line.quantity);
  }
  return Array.from(map.entries()).map(([variantId, quantity]) => ({ variantId, quantity }));
}

type AnyTx = any;

async function getOrCreateItem(tx: AnyTx, variantId: string): Promise<any> {
  const existing = await tx.inventoryItem.findUnique({ where: { variantId } });
  if (existing) return existing;
  return tx.inventoryItem.create({ data: { variantId, warehouseCode: "MAIN", quantity: 0, reservedQuantity: 0 } });
}

/**
 * Reserve stock for a draft order. Checks available >= qty for EVERY
 * line first; any shortfall throws and the caller's $transaction rolls
 * everything back — no partial reservation, no draft order created.
 */
export async function reserveStock(tx: AnyTx, lines: ReservedLine[]): Promise<void> {
  const aggregated = aggregateLines(lines);
  const items: { variantId: string; item: any; quantity: number }[] = [];
  // Collect EVERY shortfall instead of failing on the first line, so the
  // user can fix all lines in one pass instead of fix-and-retry per line.
  // Nothing is reserved yet at throw time, so the all-or-nothing rule
  // still holds.
  const shortfalls: string[] = [];
  for (const line of aggregated) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new OrderError("Số lượng đặt giữ phải là số nguyên lớn hơn 0.", 400);
    }
    const item = await getOrCreateItem(tx, line.variantId);
    if (line.quantity > availableQuantity(item)) {
      // Never show a raw variant id in a user-facing message: resolve the
      // human-readable SKU code + product/variant names for the error.
      const variant = await tx.productVariant.findUnique({ where: { id: line.variantId }, include: { product: true } });
      const label = variant
        ? `${variant.sku} (${variant.product?.name ?? ""} / ${variant.variantName})`
        : "SKU này";
      shortfalls.push(`${label}: tồn ${item.quantity}, đang giữ ${item.reservedQuantity ?? 0}, khả dụng ${availableQuantity(item)}, cần ${line.quantity}`);
    } else {
      items.push({ variantId: line.variantId, item, quantity: line.quantity });
    }
  }
  if (shortfalls.length > 0) {
    throw new OrderError(
      `Không đủ tồn khả dụng để giữ cho đơn nháp (${shortfalls.join("; ")}). Toàn bộ đơn đã bị hủy, không tạo đơn nửa vời.`,
      400,
    );
  }
  for (const entry of items) {
    await tx.inventoryItem.update({
      where: { id: entry.item.id },
      data: { reservedQuantity: entry.item.reservedQuantity + entry.quantity },
    });
  }
}

/**
 * Release a draft hold. Used on draft cancel and on draft edit (release
 * old lines before validating/reserving the new ones, inside the same
 * transaction so a failure rolls the release back too). A negative
 * result is clamped to 0 defensively — reservations are only ever
 * changed by this file, so a shortfall means pre-existing data
 * inconsistency, never a reason to block cancelling an order.
 */
export async function releaseReservation(tx: AnyTx, lines: ReservedLine[]): Promise<void> {
  for (const line of aggregateLines(lines)) {
    const item = await getOrCreateItem(tx, line.variantId);
    const next = Math.max(0, (item.reservedQuantity ?? 0) - line.quantity);
    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { reservedQuantity: next },
    });
  }
}

/**
 * Generate an order code: DH-YYYYMMDD-XXXXXX (random suffix). The
 * caller retries on a unique-constraint conflict (see routes/orders.ts).
 */
export function generateOrderCode(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
  return `DH-${y}${m}${d}-${suffix}`;
}
