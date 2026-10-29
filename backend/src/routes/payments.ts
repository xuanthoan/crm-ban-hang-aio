/**
 * Payment / Debt API — Sprint Thanh toán / Công nợ.
 *
 * Locked rules applied here (docs/12_QUY_TAC_CHOT_CUNG.md §3, §5, §6):
 *  §3  paid_total is DERIVED from active payments only, never
 *      hand-edited. Every create / cancel calls
 *      recalculateOrderPaymentTotals() in the same transaction.
 *      debt_total = grand_total - paid_total; payment_status is
 *      derived (unpaid / partial / paid). A payment may not exceed
 *      the remaining debt in MVP.
 *  §3.3 Cancelling a payment never hard-deletes it: status becomes
 *      "cancelled" with a mandatory reason, cancelled_by and
 *      cancelled_at. Cancelled payments stay visible in the list.
 *  §3.4 Debt agrees at both levels: per-order debt is the order's
 *      debt_total; per-customer debt is the sum of debt_total of
 *      that customer's orders that are still owing. Draft orders
 *      (not yet committed) and cancelled orders (void) are not
 *      owing, so both debt endpoints default to confirmed/completed
 *      orders only; an explicit ?status= filter can override that
 *      for auditing. The customer total is computed live from Order
 *      rows — there is no separate stored customer total to drift.
 *  §5  There is NO hard-delete route for payments in this sprint.
 *  §6  Backend permission + data-scope checks on every route.
 *
 * Overpayment after a return (recorded decision): if a return
 * shrinks grand_total below paid_total, debt_total is NEGATIVE —
 * that is the customer's credit ("tiền thừa cần hoàn"),
 * payment_status stays "paid", and no new payment may be created
 * while debt_total <= 0. No refund workflow exists in this sprint
 * (explicit backlog item); no negative payment is auto-created.
 *
 * Payment methods are the docs 05 §7.1 defaults: cash (Tiền mặt),
 * bank_transfer (Chuyển khoản), cod (COD), e_wallet (Ví điện tử).
 * No free-form method is accepted.
 *
 * Deliberately NOT in this sprint:
 *  - Refunds / issuing money back for overpaid (credit) orders.
 *  - Editing a payment's amount or method (cancel + recreate instead).
 *  - Dashboard / care / import / export.
 */

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { getPrisma } from "../lib/prisma";
import {
  computePaymentTotals,
  isPaymentError,
  isValidPaymentMethod,
  lockOrderRow,
  parsePaymentAmount,
  paymentMethodLabel,
  PaymentError,
  recalculateOrderPaymentTotals,
} from "../lib/payments";

const router = Router();
router.use(authenticate);

type AnyTx = any;
type AnyReq = import("express").Request;
type AnyRes = import("express").Response;

/** Orders that can carry debt: committed and not void. See header. */
const PAYABLE_ORDER_STATUSES = ["confirmed", "completed"] as const;

function dbUnavailable(res: AnyRes, err: unknown) {
  console.error("[payments] database error:", err);
  res.status(503).json({
    status: "error",
    message: "Chưa kết nối được database. Hãy chạy PostgreSQL (docker compose up -d postgres) rồi thử lại.",
  });
}

function handleError(res: AnyRes, err: unknown): void {
  if (isPaymentError(err)) {
    res.status(err.status).json({ status: "error", message: err.message });
    return;
  }
  dbUnavailable(res, err);
}

function parsePagination(req: AnyReq): { page: number; pageSize: number } {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
  return { page, pageSize };
}

function dec(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function canViewAllPayments(req: AnyReq): boolean {
  return req.user!.permissions.includes("payment.view_all");
}

function canViewPayment(req: AnyReq): boolean {
  return canViewAllPayments(req) || req.user!.permissions.includes("payment.view_own");
}

function canViewDebt(req: AnyReq): boolean {
  return req.user!.permissions.includes("debt.view_all") || req.user!.permissions.includes("debt.view_own");
}

function canViewAllDebt(req: AnyReq): boolean {
  return req.user!.permissions.includes("debt.view_all");
}

/** Data scope for order-based reads: view_all sees all, otherwise own orders only. */
function orderInScope(order: { createdById: string | null }, req: AnyReq): boolean {
  if (canViewAllPayments(req) || canViewAllDebt(req)) return true;
  return order.createdById === req.user!.id;
}

function orderScopeWhere(req: AnyReq): Record<string, unknown> {
  if (canViewAllPayments(req) || canViewAllDebt(req)) return {};
  return { createdById: req.user!.id };
}

function serializePayment(p: any) {
  return {
    id: p.id,
    orderId: p.orderId,
    customerId: p.customerId,
    amount: dec(p.amount),
    paymentMethod: p.paymentMethod,
    paymentMethodLabel: paymentMethodLabel(p.paymentMethod),
    paidAt: p.paidAt,
    note: p.note ?? null,
    status: p.status,
    cancelReason: p.cancelReason ?? null,
    cancelledById: p.cancelledById ?? null,
    cancelledByName: p.cancelledBy?.fullName ?? null,
    cancelledAt: p.cancelledAt ?? null,
    createdById: p.createdById ?? null,
    createdByName: p.createdBy?.fullName ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function serializeOrderTotals(order: any) {
  return {
    id: order.id,
    orderCode: order.orderCode,
    customerId: order.customerId,
    status: order.status,
    paymentStatus: order.paymentStatus,
    grandTotal: dec(order.grandTotal),
    paidTotal: dec(order.paidTotal),
    debtTotal: dec(order.debtTotal),
  };
}

/* ------------------------------------------------------------------ */
/* GET /api/orders/:id/payments — payments of one order                */
/* ------------------------------------------------------------------ */

router.get("/orders/:id/payments", async (req, res) => {
  try {
    if (!canViewPayment(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem thanh toán." });
      return;
    }
    const prisma = getPrisma();
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order || (order as any).deletedAt) {
      res.status(404).json({ status: "error", message: "Không tìm thấy đơn hàng." });
      return;
    }
    if (!orderInScope(order as any, req)) {
      res.status(403).json({ status: "error", message: "Đơn hàng này không thuộc phạm vi của bạn." });
      return;
    }
    const payments = await prisma.payment.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { fullName: true } },
        cancelledBy: { select: { fullName: true } },
      },
    });
    res.json({
      status: "ok",
      data: { order: serializeOrderTotals(order), payments: payments.map(serializePayment) },
    });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/orders/:id/payments — record one payment                  */
/* ------------------------------------------------------------------ */

router.post("/orders/:id/payments", authorize("payment.create"), async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    // Frontend values for totals are NEVER trusted: amount/method/note
    // are the only accepted inputs; totals are recomputed server-side.
    if ("paidTotal" in body || "debtTotal" in body || "paymentStatus" in body) {
      // Silently ignored by design (not an error): the backend always
      // recomputes totals from active payments below.
    }
    const amount = parsePaymentAmount(body.amount);
    if (!isValidPaymentMethod(body.paymentMethod)) {
      res.status(400).json({
        status: "error",
        message: "Phương thức thanh toán bắt buộc và phải là một trong: cash (Tiền mặt), bank_transfer (Chuyển khoản), cod (COD), e_wallet (Ví điện tử).",
      });
      return;
    }
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    const prisma = getPrisma();
    const actorId = req.user!.id;
    const result = await prisma.$transaction(async (tx: AnyTx) => {
      const order = await tx.order.findUnique({ where: { id: req.params.id } });
      if (!order || order.deletedAt) {
        throw new PaymentError("Không tìm thấy đơn hàng.", 404);
      }
      if (!orderInScope(order, req)) {
        throw new PaymentError("Đơn hàng này không thuộc phạm vi của bạn.", 403);
      }
      if (order.status !== "confirmed" && order.status !== "completed") {
        throw new PaymentError(
          `Chỉ ghi nhận thanh toán cho đơn đã xác nhận hoặc đã hoàn thành. Đơn đang ở trạng thái "${order.status}" nên không thu tiền được.`,
          400,
        );
      }
      // Serialize payment writes for this order, then re-read the
      // CURRENT active total inside the same transaction (never trust
      // the stored debt_total, which could be stale under concurrency).
      await lockOrderRow(tx, order.id);
      const activePayments = await tx.payment.findMany({
        where: { orderId: order.id, status: "active" },
        select: { amount: true },
      });
      const current = computePaymentTotals(
        Number(order.grandTotal),
        activePayments.map((p: any) => Number(p.amount)),
      );
      if (current.debtTotal <= 0) {
        throw new PaymentError(
          current.overpaid
            ? `Đơn ${order.orderCode} đang thừa tiền ${Math.abs(current.debtTotal).toLocaleString("vi-VN")} (tiền thừa cần hoàn). Không tạo thêm payment khi đơn đã đủ hoặc thừa tiền; hoàn tiền chưa làm ở sprint này.`
            : `Đơn ${order.orderCode} đã thanh toán đủ, không tạo thêm payment.`,
          400,
        );
      }
      if (amount > current.debtTotal) {
        throw new PaymentError(
          `Số tiền thanh toán (${amount.toLocaleString("vi-VN")}) vượt số còn nợ của đơn (${current.debtTotal.toLocaleString("vi-VN")}). Toàn bộ payment đã bị hủy, không ghi nhận một phần.`,
          400,
        );
      }
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
          amount,
          paymentMethod: body.paymentMethod as string,
          note,
          status: "active",
          createdById: actorId,
        },
        include: {
          createdBy: { select: { fullName: true } },
          cancelledBy: { select: { fullName: true } },
        },
      });
      const { order: updated, totals } = await recalculateOrderPaymentTotals(tx, order.id);
      await writeAudit(tx, {
        actorId,
        action: "payment.create",
        entityType: "payment",
        entityId: payment.id,
        oldValue: { orderId: order.id, paidTotal: current.paidTotal, debtTotal: current.debtTotal },
        newValue: {
          orderId: order.id,
          amount,
          paymentMethod: body.paymentMethod,
          paidTotal: totals.paidTotal,
          debtTotal: totals.debtTotal,
          paymentStatus: totals.paymentStatus,
        },
        ipAddress: req.ip ?? null,
      });
      return { payment, order: updated, totals };
    });
    res.status(201).json({
      status: "ok",
      data: { payment: serializePayment(result.payment), order: serializeOrderTotals(result.order) },
    });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/payments/:id/cancel — cancel one payment (no hard delete) */
/* ------------------------------------------------------------------ */

router.post("/payments/:id/cancel", authorize("payment.cancel"), async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "";
    if (!reason) {
      res.status(400).json({ status: "error", message: "Hủy payment bắt buộc phải có lý do." });
      return;
    }
    const prisma = getPrisma();
    const actorId = req.user!.id;
    const result = await prisma.$transaction(async (tx: AnyTx) => {
      const payment = await tx.payment.findUnique({
        where: { id: req.params.id },
        include: { order: true },
      });
      if (!payment) {
        throw new PaymentError("Không tìm thấy payment.", 404);
      }
      if (!orderInScope(payment.order as any, req)) {
        throw new PaymentError("Đơn hàng của payment này không thuộc phạm vi của bạn.", 403);
      }
      if (payment.status !== "active") {
        throw new PaymentError("Payment này đã bị hủy trước đó, không hủy lại được.", 409);
      }
      await lockOrderRow(tx, payment.orderId);
      const before = computePaymentTotals(
        Number(payment.order.grandTotal),
        (await tx.payment.findMany({ where: { orderId: payment.orderId, status: "active" }, select: { amount: true } })).map(
          (p: any) => Number(p.amount),
        ),
      );
      const cancelled = await tx.payment.update({
        where: { id: payment.id },
        data: { status: "cancelled", cancelReason: reason, cancelledById: actorId, cancelledAt: new Date() },
        include: {
          createdBy: { select: { fullName: true } },
          cancelledBy: { select: { fullName: true } },
        },
      });
      const { order: updated, totals } = await recalculateOrderPaymentTotals(tx, payment.orderId);
      await writeAudit(tx, {
        actorId,
        action: "payment.cancel",
        entityType: "payment",
        entityId: payment.id,
        oldValue: { orderId: payment.orderId, paidTotal: before.paidTotal, debtTotal: before.debtTotal },
        newValue: {
          orderId: payment.orderId,
          cancelReason: reason,
          paidTotal: totals.paidTotal,
          debtTotal: totals.debtTotal,
          paymentStatus: totals.paymentStatus,
        },
        ipAddress: req.ip ?? null,
      });
      return { payment: cancelled, order: updated, totals };
    });
    res.json({
      status: "ok",
      data: { payment: serializePayment(result.payment), order: serializeOrderTotals(result.order) },
    });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/debts — debt list per order                                */
/* ------------------------------------------------------------------ */

router.get("/debts", async (req, res) => {
  try {
    if (!canViewDebt(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem công nợ." });
      return;
    }
    const prisma = getPrisma();
    const { page, pageSize } = parsePagination(req);
    const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : null;
    const customerId = typeof req.query.customerId === "string" && req.query.customerId.trim() ? req.query.customerId.trim() : null;
    const paymentStatus = typeof req.query.paymentStatus === "string" && req.query.paymentStatus.trim() ? req.query.paymentStatus.trim() : null;
    const statusParam = typeof req.query.status === "string" && req.query.status.trim() ? req.query.status.trim() : null;
    const debtOnly = req.query.debtOnly !== "false";
    const sort = req.query.sort === "debt" ? "debt" : "created";
    const where: Record<string, unknown> = {
      ...orderScopeWhere(req),
      deletedAt: null,
      status: statusParam ? { in: [statusParam] } : { in: [...PAYABLE_ORDER_STATUSES] },
    };
    if (customerId) where.customerId = customerId;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (debtOnly) (where as any).debtTotal = { gt: 0 };
    if (q) {
      (where as any).OR = [
        { orderCode: { contains: q, mode: "insensitive" } },
        { customer: { fullName: { contains: q, mode: "insensitive" } } },
      ];
    }
    const [orders, total, aggregate] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: sort === "debt" ? { debtTotal: "desc" } : { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: { select: { fullName: true } } },
      }),
      prisma.order.count({ where }),
      prisma.order.aggregate({ where, _sum: { debtTotal: true } }),
    ]);
    res.json({
      status: "ok",
      data: orders.map((o: any) => ({
        ...serializeOrderTotals(o),
        customerName: o.customer?.fullName ?? null,
        createdAt: o.createdAt,
        fullyReturned: o.fullyReturned ?? false,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      summary: { totalDebt: dec(aggregate._sum.debtTotal), count: total },
    });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/customers/:id/debt — debt per customer, computed live      */
/* ------------------------------------------------------------------ */

router.get("/customers/:id/debt", async (req, res) => {
  try {
    if (!canViewDebt(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem công nợ." });
      return;
    }
    const prisma = getPrisma();
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer || (customer as any).deletedAt) {
      res.status(404).json({ status: "error", message: "Không tìm thấy khách hàng." });
      return;
    }
    if (!canViewAllDebt(req)) {
      const own = (customer as any).createdById === req.user!.id || (customer as any).assignedToId === req.user!.id;
      if (!own) {
        res.status(403).json({ status: "error", message: "Khách hàng này không thuộc phạm vi của bạn." });
        return;
      }
    }
    const orders = await prisma.order.findMany({
      where: { customerId: customer.id, deletedAt: null, status: { in: [...PAYABLE_ORDER_STATUSES] } },
      orderBy: { createdAt: "desc" },
    });
    let totalDebt = 0;
    let totalOwing = 0;
    let totalCredit = 0;
    const owingOrders: any[] = [];
    for (const o of orders) {
      const debt = dec(o.debtTotal);
      totalDebt += debt;
      if (debt > 0) {
        totalOwing += debt;
        owingOrders.push({ ...serializeOrderTotals(o), createdAt: o.createdAt, fullyReturned: (o as any).fullyReturned ?? false });
      } else if (debt < 0) {
        totalCredit += -debt;
      }
    }
    res.json({
      status: "ok",
      data: {
        customer: { id: customer.id, fullName: (customer as any).fullName },
        // Net sum of all payable orders' debt (owing - credit). The
        // owing-only total is what the debt list sums to; the two
        // agree whenever no order is overpaid.
        totalDebt,
        totalOwing,
        totalCredit,
        orderCount: orders.length,
        owingOrderCount: owingOrders.length,
        orders: owingOrders,
        note: "Công nợ tính trực tiếp từ các đơn confirmed/completed của khách (đơn nháp và đơn đã hủy không tính là còn nợ). Đơn trả thừa (debt âm) được tính là tiền thừa cần hoàn, không phải nợ.",
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
