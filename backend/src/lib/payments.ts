/**
 * Payment library — Sprint Thanh toán / Công nợ.
 *
 * Locked rules applied here (docs/12_QUY_TAC_CHOT_CUNG.md §3, §5, §6):
 *  §3.1 Payment is a separate record, never a hand-edited number on
 *      the order. The frontend may compute for display, but the
 *      backend always recomputes and never trusts frontend values.
 *  §3.2 The ONLY formula, recomputed by the backend after every
 *      payment change (and after a return changes grand_total):
 *        paid_total = sum(amount of ACTIVE payments of the order)
 *        debt_total = grand_total - paid_total
 *        payment_status: paid_total = 0 -> unpaid (unless grand <= 0);
 *          0 < paid_total < grand_total -> partial;
 *          paid_total >= grand_total -> paid.
 *  §3.3 Cancelling a payment never hard-deletes it: status becomes
 *      "cancelled" with a mandatory reason, cancelled_by and
 *      cancelled_at. Cancelled payments do NOT count into paid_total.
 *  §3.4 Debt must agree at both levels: per-order debt = the order's
 *      debt_total; per-customer debt = sum of debt_total of that
 *      customer's orders that are still owing. Draft orders (not yet
 *      committed) and cancelled orders (void) are NOT owing, so the
 *      debt endpoints in this sprint default to confirmed/completed
 *      orders only — see routes/payments.ts. That keeps the debt
 *      list, the customer debt total and the customer profile showing
 *      the same numbers.
 *
 * Overpayment after a return (owner decision recorded in
 * DEVELOPMENT_PLAN.md): if a return shrinks grand_total below
 * paid_total, debt_total goes NEGATIVE. That negative amount is the
 * customer's CREDIT ("tiền thừa cần hoàn"), payment_status stays
 * "paid", and no new payment may be created while debt_total <= 0.
 * No negative payment is auto-created and no refund is issued in
 * this sprint — a refund workflow is an explicit backlog item.
 *
 * Money model: amounts are whole VND (integer). Order totals are
 * stored as Decimal(19, 2) but computed in integer cents by
 * src/lib/orders.ts; payment amounts in this sprint must be integers
 * so a payment can never introduce a fractional đồng.
 *
 * This file has NO imports on purpose, so the pure functions can be
 * tested with ts-node --transpile-only without a generated Prisma
 * client (same pattern as src/lib/orders.ts and src/lib/inventory.ts).
 */

export class PaymentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function isPaymentError(err: unknown): err is PaymentError {
  return err instanceof PaymentError;
}

/* ------------------------------------------------------------------ */
/* Payment methods — docs 05 §7.1 (default methods)                    */
/* ------------------------------------------------------------------ */

export const PAYMENT_METHODS = [
  { code: "cash", label: "Tiền mặt" },
  { code: "bank_transfer", label: "Chuyển khoản" },
  { code: "cod", label: "COD" },
  { code: "e_wallet", label: "Ví điện tử" },
] as const;

export type PaymentMethodCode = (typeof PAYMENT_METHODS)[number]["code"];

export function paymentMethodLabel(code: string): string {
  return PAYMENT_METHODS.find((m) => m.code === code)?.label ?? code;
}

export function isValidPaymentMethod(value: unknown): value is PaymentMethodCode {
  return typeof value === "string" && PAYMENT_METHODS.some((m) => m.code === value);
}

/* ------------------------------------------------------------------ */
/* Pure money helpers                                                  */
/* ------------------------------------------------------------------ */

function decToCents(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  if (typeof n !== "number" || Number.isNaN(n)) {
    throw new PaymentError("Số tiền không hợp lệ.", 400);
  }
  return Math.round(n * 100);
}

function centsToNumber(cents: number): number {
  return cents / 100;
}

/**
 * Validate a payment amount. Must be a whole-VND integer greater than
 * zero (the task's "số nguyên > 0", same unit as Order totals).
 * Accepts a JSON number or a numeric string, rejects floats, NaN,
 * zero and negatives.
 */
export function parsePaymentAmount(value: unknown): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || Number.isNaN(n) || !Number.isInteger(n) || n <= 0) {
    throw new PaymentError("Số tiền thanh toán phải là số nguyên (đồng) lớn hơn 0.", 400);
  }
  return n;
}

export interface PaymentTotals {
  paidTotal: number;
  debtTotal: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  /** True when the customer has overpaid (debt_total < 0 = credit). */
  overpaid: boolean;
}

/**
 * The single payment formula. Pure: no database, no rounding drift
 * (integer cents). grand_total <= 0 means nothing is owed, so the
 * order is "paid" even with zero payments (e.g. fully returned).
 */
export function computePaymentTotals(
  grandTotal: number,
  activeAmounts: number[],
): PaymentTotals {
  const grandCents = decToCents(grandTotal);
  let paidCents = 0;
  for (const amount of activeAmounts) {
    paidCents += decToCents(amount);
  }
  const debtCents = grandCents - paidCents;
  let paymentStatus: PaymentTotals["paymentStatus"];
  if (grandCents <= 0) {
    paymentStatus = "paid";
  } else if (paidCents <= 0) {
    paymentStatus = "unpaid";
  } else if (paidCents < grandCents) {
    paymentStatus = "partial";
  } else {
    paymentStatus = "paid";
  }
  return {
    paidTotal: centsToNumber(paidCents),
    debtTotal: centsToNumber(debtCents),
    paymentStatus,
    overpaid: debtCents < 0,
  };
}

/* ------------------------------------------------------------------ */
/* Recalculation — the choke point for every payment change           */
/* ------------------------------------------------------------------ */

type AnyTx = any;

/**
 * Recompute an order's paid_total / debt_total / payment_status from
 * its ACTIVE payments, inside the caller's transaction. Every route
 * that creates, cancels or otherwise changes payments — and the
 * return flow in routes/orders.ts after it changes grand_total —
 * MUST call this before returning. Never accept paid_total or
 * debt_total from the frontend as input.
 *
 * Returns the recomputed totals plus the updated order row.
 */
export async function recalculateOrderPaymentTotals(
  tx: AnyTx,
  orderId: string,
): Promise<{ order: any; totals: PaymentTotals }> {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new PaymentError("Không tìm thấy đơn hàng.", 404);
  }
  const activePayments = await tx.payment.findMany({
    where: { orderId, status: "active" },
    select: { amount: true },
  });
  const totals = computePaymentTotals(
    Number(order.grandTotal),
    activePayments.map((p: any) => Number(p.amount)),
  );
  const updated = await tx.order.update({
    where: { id: orderId },
    data: {
      paidTotal: totals.paidTotal,
      debtTotal: totals.debtTotal,
      paymentStatus: totals.paymentStatus,
    },
  });
  return { order: updated, totals };
}

/**
 * Lock one order row for update inside the caller's transaction, so
 * two payment creations for the SAME order cannot both read the old
 * debt and both pass the overpay check. Different orders are not
 * blocked by each other. This is deliberately kept inside the
 * payment transaction (not a separate query) so the lock is released
 * when the transaction commits or rolls back.
 *
 * NOTE: this line is not yet verified against a real database
 * (Prisma generate / migrate are blocked by the network on this
 * machine, like every other sprint). The payment checklist in
 * DEVELOPMENT_PLAN.md includes re-running payment creation after a
 * real migrate; if the raw lock ever fails against the live schema,
 * it must be fixed there, never silently dropped.
 */
export async function lockOrderRow(tx: AnyTx, orderId: string): Promise<void> {
  await tx.$executeRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
}
