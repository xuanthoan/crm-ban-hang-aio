/**
 * Supplier-payment library — Sprint NCC-3 (thanh toán + công nợ NCC).
 *
 * Mirrors src/lib/payments.ts (locked rules docs/12 §3, §5, §6), with
 * the money direction identical (we pay the supplier) and the money
 * model simplified to integer VND (đồng nguyên) like the rest of the
 * purchase module — no Decimal/cents conversion is needed because PO
 * totals and supplier-payment amounts are already integers:
 *  §3.1 A supplier payment is a separate record, never a hand-edited
 *      number on the purchase order. The frontend may compute for
 *      display, but the backend always recomputes and never trusts
 *      frontend values.
 *  §3.2 The ONLY formula, recomputed by the backend after every
 *      payment change (and after a return changes grand_total):
 *        paid_total = sum(amount of ACTIVE supplier payments)
 *        debt_total = grand_total - paid_total
 *        payment_status: paid_total = 0 -> unpaid (unless grand <= 0);
 *          0 < paid_total < grand_total -> partial;
 *          paid_total >= grand_total -> paid.
 *  §3.3 Cancelling a supplier payment never hard-deletes it: status
 *      becomes "cancelled" with a mandatory reason, cancelled_by and
 *      cancelled_at. Cancelled payments do NOT count into paid_total.
 *  §3.4 Debt must agree at both levels: per-PO debt = the PO's
 *      debt_total; per-supplier debt = sum of debt_total of that
 *      supplier's POs that are still owing. Draft POs (not yet
 *      committed) and cancelled POs (void) are NOT owing, so the
 *      supplier-debt endpoint lists confirmed/completed POs only —
 *      see routes/supplierPayments.ts.
 *
 * Credit on over-return (mirror of the sales MVP decision): if a PO
 * return shrinks grand_total below paid_total, debt_total goes
 * NEGATIVE. That negative amount is the amount the supplier owes back
 * (we overpaid), payment_status stays "paid", and no new payment may
 * be created while debt_total <= 0. No auto-refund in MVP.
 *
 * This file imports only src/lib/payments.ts (which itself has NO
 * imports, so the pure functions stay testable without a generated
 * Prisma client) — never the PrismaClient type, same pattern as
 * src/lib/purchases.ts and src/lib/inventory.ts.
 */

import { paymentMethodLabel } from "./payments";

export class SupplierPaymentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function isSupplierPaymentError(err: unknown): err is SupplierPaymentError {
  return err instanceof SupplierPaymentError;
}

export interface SupplierPaymentTotals {
  paidTotal: number;
  debtTotal: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  /** True when we overpaid the supplier (debt_total < 0 = supplier owes us). */
  overpaid: boolean;
}

/**
 * The single supplier-payment formula. Pure: no database.
 * grand_total <= 0 means nothing is owed, so the PO is "paid" even
 * with zero payments (e.g. fully returned).
 */
export function computeSupplierPaymentTotals(
  grandTotal: number,
  activeAmounts: number[],
): SupplierPaymentTotals {
  if (!Number.isInteger(grandTotal)) {
    throw new SupplierPaymentError("Tổng tiền đơn nhập không hợp lệ.", 400);
  }
  let paidTotal = 0;
  for (const amount of activeAmounts) {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new SupplierPaymentError("Số tiền thanh toán NCC không hợp lệ.", 400);
    }
    paidTotal += amount;
  }
  const debtTotal = grandTotal - paidTotal;
  let paymentStatus: SupplierPaymentTotals["paymentStatus"];
  if (grandTotal <= 0) {
    paymentStatus = "paid";
  } else if (paidTotal <= 0) {
    paymentStatus = "unpaid";
  } else if (paidTotal < grandTotal) {
    paymentStatus = "partial";
  } else {
    paymentStatus = "paid";
  }
  return { paidTotal, debtTotal, paymentStatus, overpaid: debtTotal < 0 };
}

/* ------------------------------------------------------------------ */
/* Recalculation — the choke point for every supplier-payment change  */
/* ------------------------------------------------------------------ */

type AnyTx = any;

/**
 * Recompute a purchase order's paid_total / debt_total /
 * payment_status from its ACTIVE supplier payments, inside the
 * caller's transaction. Every route that creates or cancels a
 * supplier payment — and the return flow in routes/purchases.ts after
 * it changes grand_total — MUST call this before returning. Never
 * accept paid_total or debt_total from the frontend as input.
 *
 * Returns the recomputed totals plus the updated PO row.
 */
export async function recalculatePurchasePaymentTotals(
  tx: AnyTx,
  purchaseOrderId: string,
): Promise<{ purchaseOrder: any; totals: SupplierPaymentTotals }> {
  const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
  if (!po) {
    throw new SupplierPaymentError("Không tìm thấy đơn nhập.", 404);
  }
  const activePayments = await tx.supplierPayment.findMany({
    where: { purchaseOrderId, status: "active" },
    select: { amount: true },
  });
  const totals = computeSupplierPaymentTotals(
    po.grandTotal,
    activePayments.map((p: any) => p.amount),
  );
  const updated = await tx.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: {
      paidTotal: totals.paidTotal,
      debtTotal: totals.debtTotal,
      paymentStatus: totals.paymentStatus,
    },
  });
  return { purchaseOrder: updated, totals };
}

/**
 * Lock one purchase-order row for update inside the caller's
 * transaction, so two payment creations for the SAME PO cannot both
 * read the old debt and both pass the overpay check. Different POs
 * are not blocked by each other. This is deliberately kept inside the
 * payment transaction (not a separate query) so the lock is released
 * when the transaction commits or rolls back.
 */
export async function lockPurchaseOrderRow(tx: AnyTx, purchaseOrderId: string): Promise<void> {
  await tx.$executeRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${purchaseOrderId} FOR UPDATE`;
}

/**
 * Serialize one supplier payment for API responses. The frontend
 * shows paymentMethodLabel, never a raw method code, and the cancel
 * reason + canceller name for cancelled payments.
 */
export function serializeSupplierPayment(p: any) {
  return {
    id: p.id,
    purchaseOrderId: p.purchaseOrderId,
    amount: p.amount,
    paymentMethod: p.paymentMethod,
    paymentMethodLabel: paymentMethodLabel(p.paymentMethod),
    note: p.note ?? null,
    status: p.status,
    cancelReason: p.cancelledReason ?? null,
    cancelledById: p.cancelledById ?? null,
    cancelledByName: p.cancelledBy?.fullName ?? null,
    cancelledAt: p.cancelledAt ?? null,
    createdById: p.createdById ?? null,
    createdByName: p.createdBy?.fullName ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
