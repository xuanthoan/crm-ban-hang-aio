/**
 * Supplier Payment / Debt API — Sprint NCC-3 (thanh toán + công nợ NCC).
 *
 * Mirrors the sales Payment/Debt module (routes/payments.ts) with the
 * money direction identical (we pay the supplier; paid_total /
 * debt_total / payment_status on the PO behave exactly like on a sales
 * order), except the money model is integer VND throughout:
 *  §3  paid_total is DERIVED from active supplier payments only,
 *      never hand-edited. Every create / cancel calls
 *      recalculatePurchasePaymentTotals() in the same transaction.
 *      debt_total = grand_total - paid_total; payment_status is
 *      derived (unpaid / partial / paid). A payment may not exceed
 *      the remaining debt in MVP.
 *  §3.3 Cancelling a supplier payment never hard-deletes it: status
 *      becomes "cancelled" with a mandatory reason, cancelled_by and
 *      cancelled_at. Cancelled payments stay visible in the list.
 *  §3.4 Debt agrees at both levels: per-PO debt is the PO's
 *      debt_total; per-supplier debt is the sum of debt_total of
 *      that supplier's POs that are still owing. Draft POs (not yet
 *      committed) and cancelled POs (void) are not owing, so the
 *      supplier-debt endpoint lists confirmed/completed POs only.
 *  §5  There is NO hard-delete route for supplier payments in this
 *      sprint (and none is planned: cancel + keep the record is the
 *      deletion path, same as sales payments).
 *  §6  Backend permission + data-scope checks on every route. There
 *      are deliberately NO new view codes: the payment section and
 *      the debt page follow PO visibility (purchase.view_all /
 *      view_own); only create and cancel have their own codes.
 *
 * Credit on over-return (mirror of the sales MVP decision): if a PO
 * return shrinks grand_total below paid_total, debt_total goes
 * NEGATIVE — that is the amount the supplier owes back (we overpaid),
 * payment_status stays "paid", and no new payment may be created
 * while debt_total <= 0. No refund workflow exists in this sprint
 * (explicit backlog item); no negative payment is auto-created. The
 * return flow in routes/purchases.ts calls
 * recalculatePurchasePaymentTotals() after recomputing grand_total so
 * this credit is real, never stale.
 *
 * Payment methods are the docs 05 §7.1 defaults, same as sales:
 * cash (Tiền mặt), bank_transfer (Chuyển khoản), cod (COD), e_wallet
 * (Ví điện tử). No free-form method is accepted.
 *
 * Deliberately NOT in this sprint:
 *  - Refunds / issuing money back for overpaid (credit) POs.
 *  - Editing a payment's amount or method (cancel + recreate instead).
 *  - Reports supplier-debt section, supplier CSV import/export, PO
 *    export (Sprint NCC-4).
 */

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { getPrisma } from "../lib/prisma";
import { isValidPaymentMethod, parsePaymentAmount } from "../lib/payments";
import {
  computeSupplierPaymentTotals,
  isSupplierPaymentError,
  lockPurchaseOrderRow,
  recalculatePurchasePaymentTotals,
  serializeSupplierPayment,
  SupplierPaymentError,
} from "../lib/supplierPayments";

const router = Router();
router.use(authenticate);

type AnyTx = any;
type AnyReq = import("express").Request;
type AnyRes = import("express").Response;

/** POs that can carry debt: committed and not void. See header. */
const PAYABLE_PO_STATUSES = ["confirmed", "completed"] as const;

function dbUnavailable(res: AnyRes, err: unknown) {
  console.error("[supplierPayments] database error:", err);
  res.status(503).json({
    status: "error",
    message: "Chưa kết nối được database. Hãy chạy PostgreSQL (docker compose up -d postgres) rồi thử lại.",
  });
}

function handleError(res: AnyRes, err: unknown): void {
  if (isSupplierPaymentError(err)) {
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

function canViewAllPO(req: AnyReq): boolean {
  return req.user!.permissions.includes("purchase.view_all");
}

function canViewPO(req: AnyReq): boolean {
  return canViewAllPO(req) || req.user!.permissions.includes("purchase.view_own");
}

/** Data scope for PO-based reads: view_all sees all, otherwise own POs only. */
function poInScope(po: { createdById: string | null }, req: AnyReq): boolean {
  if (canViewAllPO(req)) return true;
  return po.createdById === req.user!.id;
}

function poScopeWhere(req: AnyReq): Record<string, unknown> {
  if (canViewAllPO(req)) return {};
  return { createdById: req.user!.id };
}

function serializePOTotals(po: any) {
  return {
    id: po.id,
    code: po.code,
    supplierId: po.supplierId,
    status: po.status,
    paymentStatus: po.paymentStatus,
    grandTotal: po.grandTotal,
    paidTotal: po.paidTotal,
    debtTotal: po.debtTotal,
  };
}

/* ------------------------------------------------------------------ */
/* GET /api/purchase-orders/:id/payments — payments of one PO          */
/* ------------------------------------------------------------------ */

router.get("/purchase-orders/:id/payments", async (req, res) => {
  try {
    if (!canViewPO(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem đơn nhập." });
      return;
    }
    const prisma = getPrisma();
    const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!po) {
      res.status(404).json({ status: "error", message: "Không tìm thấy đơn nhập." });
      return;
    }
    if (!poInScope(po as any, req)) {
      res.status(403).json({ status: "error", message: "Đơn nhập này không thuộc phạm vi của bạn." });
      return;
    }
    const payments = await prisma.supplierPayment.findMany({
      where: { purchaseOrderId: po.id },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { fullName: true } },
        cancelledBy: { select: { fullName: true } },
      },
    });
    res.json({
      status: "ok",
      data: { purchaseOrder: serializePOTotals(po), payments: payments.map(serializeSupplierPayment) },
    });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/purchase-orders/:id/payments — record one payment         */
/* ------------------------------------------------------------------ */

router.post("/purchase-orders/:id/payments", authorize("supplier_payment.create"), async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    // Frontend values for totals are NEVER trusted: amount/method/note
    // are the only accepted inputs; totals are recomputed server-side.
    // (No grandTotal / paidTotal / debtTotal / paymentStatus is read
    // from the body anywhere in this file, by design.)
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
      const po = await tx.purchaseOrder.findUnique({ where: { id: req.params.id } });
      if (!po) {
        throw new SupplierPaymentError("Không tìm thấy đơn nhập.", 404);
      }
      if (!poInScope(po, req)) {
        throw new SupplierPaymentError("Đơn nhập này không thuộc phạm vi của bạn.", 403);
      }
      if (po.status !== "confirmed" && po.status !== "completed") {
        throw new SupplierPaymentError(
          `Chỉ ghi nhận thanh toán cho đơn nhập đã xác nhận hoặc đã hoàn thành. Đơn đang ở trạng thái "${po.status}" nên không trả tiền được.`,
          400,
        );
      }
      // Serialize payment writes for this PO, then re-read the
      // CURRENT active total inside the same transaction (never trust
      // the stored debt_total, which could be stale under concurrency).
      await lockPurchaseOrderRow(tx, po.id);
      const activePayments = await tx.supplierPayment.findMany({
        where: { purchaseOrderId: po.id, status: "active" },
        select: { amount: true },
      });
      const current = computeSupplierPaymentTotals(
        po.grandTotal,
        activePayments.map((p: any) => p.amount),
      );
      if (current.debtTotal <= 0) {
        throw new SupplierPaymentError(
          current.overpaid
            ? `Đơn ${po.code} đang thừa tiền ${Math.abs(current.debtTotal).toLocaleString("vi-VN")} (nhà cung cấp đang nợ lại). Không tạo thêm payment khi đơn đã đủ hoặc thừa tiền; hoàn tiền chưa làm ở sprint này.`
            : `Đơn ${po.code} đã thanh toán đủ, không tạo thêm payment.`,
          400,
        );
      }
      if (amount > current.debtTotal) {
        throw new SupplierPaymentError(
          `Số tiền thanh toán (${amount.toLocaleString("vi-VN")}) vượt số còn nợ của đơn ${po.code} (${current.debtTotal.toLocaleString("vi-VN")}). Toàn bộ payment đã bị hủy, không ghi nhận một phần.`,
          400,
        );
      }
      const payment = await tx.supplierPayment.create({
        data: {
          purchaseOrderId: po.id,
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
      const { purchaseOrder: updated, totals } = await recalculatePurchasePaymentTotals(tx, po.id);
      await writeAudit(tx, {
        actorId,
        action: "supplier_payment.create",
        entityType: "supplier_payment",
        entityId: payment.id,
        oldValue: { purchaseOrderId: po.id, paidTotal: current.paidTotal, debtTotal: current.debtTotal },
        newValue: {
          purchaseOrderId: po.id,
          amount,
          paymentMethod: body.paymentMethod,
          paidTotal: totals.paidTotal,
          debtTotal: totals.debtTotal,
          paymentStatus: totals.paymentStatus,
        },
        ipAddress: req.ip ?? null,
      });
      return { payment, purchaseOrder: updated, totals };
    });
    res.status(201).json({
      status: "ok",
      data: { payment: serializeSupplierPayment(result.payment), purchaseOrder: serializePOTotals(result.purchaseOrder) },
    });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/purchase-orders/:id/payments/:paymentId/cancel — cancel   */
/* one supplier payment (no hard delete)                              */
/* ------------------------------------------------------------------ */

router.post("/purchase-orders/:id/payments/:paymentId/cancel", authorize("supplier_payment.cancel"), async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "";
    if (!reason) {
      res.status(400).json({ status: "error", message: "Hủy thanh toán NCC bắt buộc phải có lý do." });
      return;
    }
    const prisma = getPrisma();
    const actorId = req.user!.id;
    const result = await prisma.$transaction(async (tx: AnyTx) => {
      const payment = await tx.supplierPayment.findUnique({
        where: { id: req.params.paymentId },
        include: { purchaseOrder: true },
      });
      if (!payment || payment.purchaseOrderId !== req.params.id) {
        throw new SupplierPaymentError("Không tìm thấy thanh toán NCC.", 404);
      }
      if (!poInScope(payment.purchaseOrder as any, req)) {
        throw new SupplierPaymentError("Đơn nhập của thanh toán này không thuộc phạm vi của bạn.", 403);
      }
      if (payment.status !== "active") {
        throw new SupplierPaymentError("Thanh toán NCC này đã bị hủy trước đó, không hủy lại được.", 409);
      }
      await lockPurchaseOrderRow(tx, payment.purchaseOrderId);
      const before = computeSupplierPaymentTotals(
        payment.purchaseOrder.grandTotal,
        (await tx.supplierPayment.findMany({ where: { purchaseOrderId: payment.purchaseOrderId, status: "active" }, select: { amount: true } })).map(
          (p: any) => p.amount,
        ),
      );
      const cancelled = await tx.supplierPayment.update({
        where: { id: payment.id },
        data: { status: "cancelled", cancelledReason: reason, cancelledById: actorId, cancelledAt: new Date() },
        include: {
          createdBy: { select: { fullName: true } },
          cancelledBy: { select: { fullName: true } },
        },
      });
      const { purchaseOrder: updated, totals } = await recalculatePurchasePaymentTotals(tx, payment.purchaseOrderId);
      await writeAudit(tx, {
        actorId,
        action: "supplier_payment.cancel",
        entityType: "supplier_payment",
        entityId: payment.id,
        oldValue: { purchaseOrderId: payment.purchaseOrderId, paidTotal: before.paidTotal, debtTotal: before.debtTotal },
        newValue: {
          purchaseOrderId: payment.purchaseOrderId,
          cancelReason: reason,
          paidTotal: totals.paidTotal,
          debtTotal: totals.debtTotal,
          paymentStatus: totals.paymentStatus,
        },
        ipAddress: req.ip ?? null,
      });
      return { payment: cancelled, purchaseOrder: updated, totals };
    });
    res.json({
      status: "ok",
      data: { payment: serializeSupplierPayment(result.payment), purchaseOrder: serializePOTotals(result.purchaseOrder) },
    });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/supplier-debts — debt list per purchase order              */
/* ------------------------------------------------------------------ */

router.get("/supplier-debts", async (req, res) => {
  try {
    if (!canViewPO(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem công nợ NCC." });
      return;
    }
    const prisma = getPrisma();
    const { page, pageSize } = parsePagination(req);
    const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : null;
    const paymentStatus = typeof req.query.paymentStatus === "string" && req.query.paymentStatus.trim() ? req.query.paymentStatus.trim() : null;
    const sort = req.query.sort === "debt" ? "debt" : "created";
    const where: Record<string, unknown> = {
      ...poScopeWhere(req),
      status: { in: [...PAYABLE_PO_STATUSES] },
      debtTotal: { gt: 0 },
    };
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (q) {
      (where as any).OR = [
        { code: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
      ];
    }
    const [rows, total, aggregate, allMatching] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        orderBy: sort === "debt" ? { debtTotal: "desc" } : { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { supplier: { select: { name: true } } },
      }),
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.aggregate({ where, _sum: { debtTotal: true } }),
      // Per-supplier totals cover ALL matching POs, not just this page.
      prisma.purchaseOrder.findMany({
        where,
        select: { supplierId: true, debtTotal: true, supplier: { select: { name: true } } },
      }),
    ]);
    const perSupplierMap = new Map<string, { supplierId: string; supplierName: string | null; totalDebt: number; poCount: number }>();
    for (const po of allMatching as any[]) {
      const key = po.supplierId as string;
      const entry = perSupplierMap.get(key) ?? { supplierId: key, supplierName: po.supplier?.name ?? null, totalDebt: 0, poCount: 0 };
      entry.totalDebt += po.debtTotal as number;
      entry.poCount += 1;
      perSupplierMap.set(key, entry);
    }
    const perSupplier = Array.from(perSupplierMap.values()).sort((a, b) => b.totalDebt - a.totalDebt);
    res.json({
      status: "ok",
      data: (rows as any[]).map((po: any) => ({
        ...serializePOTotals(po),
        supplierName: po.supplier?.name ?? null,
        fullyReturned: po.fullyReturned ?? false,
        createdAt: po.createdAt,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      summary: { totalDebt: aggregate._sum.debtTotal ?? 0, count: total },
      perSupplier,
    });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
