/**
 * Dashboard / Report API — Sprint Dashboard / Báo cáo. READ-ONLY.
 *
 * Locked rules applied (docs/12_QUY_TAC_CHOT_CUNG.md §3, §6):
 *  §3 Debt agrees at both levels: per-order debt is Order.debtTotal;
 *    per-customer debt is the sum of that customer's committed
 *    orders' debtTotals. This file computes both live from Order
 *    rows — the same rule as the debt page — so the dashboard,
 *    the debt list and the customer profile cannot drift apart.
 *  §6 Sensitive data is FILTERED SERVER-SIDE, never just hidden
 *    in the UI: revenue, gross profit, inventory value and
 *    system-wide debt are omitted from the response (not null,
 *    not zero) when the caller lacks the matching permission.
 *    Hiding a card in the frontend is never a substitute.
 *
 * Permission model (codes already seeded in permissions.ts):
 *  - Scope: report.view_all -> "all"; report.view_team -> "team"
 *    (NO team entity exists in MVP, so "team" is treated as "all"
 *    and the response says so — this is the same treatment as
 *    manager's order/customer view_all in earlier sprints);
 *    report.view_own -> "own" (only orders the user created,
 *    customers they created or are assigned to, reminders they
 *    created or are assigned to). No report code at all -> 403,
 *    except the inventory report, which inventory.view alone
 *    unlocks (inventory rows only, no revenue/profit/debt).
 *  - System revenue: report.view_all or report.view_revenue.
 *    A scope-"all"/"team" caller without it gets NO revenue
 *    fields at all (they are omitted, not replaced by own
 *    numbers, because the caller's scope is system-wide).
 *    A scope-"own" caller sees only their own revenue.
 *  - Gross profit: report.view_profit only (admin in defaults).
 *    It is an ESTIMATE from the SKU's CURRENT importPrice, not
 *    historical/lot cost — see lib/dashboard.ts. If the caller
 *    lacks the permission, gross_profit is omitted entirely.
 *  - Inventory value: report.view_inventory_value or
 *    inventory.view_value. Otherwise the value field is omitted
 *    (counts are operational and stay visible).
 *  - System debt: debt.view_all, report.view_debt or
 *    report.view_all. Without it, only in-scope debt is returned
 *    and total_debt_all_time is omitted.
 *
 * No AuditLog is written for reads (docs 07 does not require it).
 * Dates are UTC days, consistent with the Care sprint: a day
 * rolls over at 07:00 Vietnam time.
 *
 * Deliberately NOT in this sprint: import/export (next sprint),
 * revenue by source/staff (Order has no source/staff field in
 * MVP schema — only createdById), customer/source/tag reports,
 * care reports, and any export endpoint.
 */

import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getPrisma } from "../lib/prisma";
import {
  COMMITTED_ORDER_STATUSES,
  DashboardError,
  isDashboardError,
  parseLimit,
  parseLowStockThreshold,
  parsePeriod,
  paymentMethodLabel,
  reminderGroup,
  revenueByDay,
  revenueByPaymentMethod,
  summarizeDebt,
  summarizeInventory,
  summarizeOrders,
  topCustomers,
  topSkus,
  type Period,
} from "../lib/dashboard";

const router = Router();
router.use(authenticate);

type AnyReq = import("express").Request;
type AnyRes = import("express").Response;

function dbUnavailable(res: AnyRes, err: unknown) {
  console.error("[dashboard] database error:", err);
  res.status(503).json({
    status: "error",
    message: "Chưa kết nối được database. Hãy chạy PostgreSQL (docker compose up -d postgres) rồi thử lại.",
  });
}

function handleError(res: AnyRes, err: unknown): void {
  if (isDashboardError(err)) {
    res.status(err.status).json({ status: "error", message: err.message });
    return;
  }
  dbUnavailable(res, err);
}

function dec(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function has(req: AnyReq, code: string): boolean {
  return req.user!.permissions.includes(code);
}

type Scope = "all" | "team" | "own" | "none";

function scopeOf(req: AnyReq): Scope {
  if (has(req, "report.view_all")) return "all";
  if (has(req, "report.view_team")) return "team";
  if (has(req, "report.view_own")) return "own";
  return "none";
}

function scopeNote(scope: Scope): string {
  if (scope === "team") return "Phạm vi team: MVP chưa có thực thể team nên phạm vi team được tính như toàn hệ thống.";
  if (scope === "own") return "Phạm vi cá nhân: chỉ tính đơn do bạn tạo, khách do bạn tạo hoặc được giao, nhắc việc do bạn tạo hoặc được giao.";
  return "Phạm vi toàn hệ thống.";
}

/** Prisma where for orders in scope (team treated as all, see header). */
function orderScopeWhere(req: AnyReq, scope: Scope): Record<string, unknown> {
  if (scope === "own") return { createdById: req.user!.id };
  return {};
}

function customerScopeWhere(req: AnyReq, scope: Scope): Record<string, unknown> {
  if (scope === "own") {
    return { OR: [{ createdById: req.user!.id }, { assignedToId: req.user!.id }] };
  }
  return {};
}

function reminderScopeWhere(req: AnyReq, scope: Scope): Record<string, unknown> {
  if (scope === "own") {
    return { OR: [{ createdById: req.user!.id }, { assignedToId: req.user!.id }] };
  }
  return {};
}

function periodWhere(period: Period): Record<string, unknown> {
  if (!period.from || !period.to) return {};
  return { createdAt: { gte: period.from, lte: period.to } };
}

function requireReportAccess(req: AnyReq, res: AnyRes): Scope | null {
  const scope = scopeOf(req);
  if (scope === "none") {
    res.status(403).json({ status: "error", message: "Bạn không có quyền xem dashboard/báo cáo." });
    return null;
  }
  return scope;
}

/** Revenue fields are visible only for system-revenue holders, or own-scope callers (own numbers). */
function revenueAllowed(req: AnyReq, scope: Scope): boolean {
  if (scope === "all" || scope === "team") return has(req, "report.view_all") || has(req, "report.view_revenue");
  return true; // own scope: personal numbers only
}

function canSystemDebt(req: AnyReq): boolean {
  return has(req, "debt.view_all") || has(req, "report.view_debt") || has(req, "report.view_all");
}

function canViewDebt(req: AnyReq): boolean {
  return canSystemDebt(req) || has(req, "debt.view_own");
}

/* ------------------------------------------------------------------ */
/* GET /api/dashboard/summary                                         */
/* ------------------------------------------------------------------ */

router.get("/dashboard/summary", async (req, res) => {
  try {
    const scope = requireReportAccess(req, res);
    if (!scope) return;
    const period = parsePeriod(req.query as Record<string, unknown>);
    const lowThreshold = parseLowStockThreshold(req.query as Record<string, unknown>, 5);
    const prisma = getPrisma();
    const now = new Date();
    const orderWhere = { ...orderScopeWhere(req, scope), ...periodWhere(period), deletedAt: null };
    const [periodOrders, allTimeOrders, customers, newCustomers, variants, reminders] = await Promise.all([
      prisma.order.findMany({ where: orderWhere }),
      prisma.order.findMany({
        where: { ...orderScopeWhere(req, scope), deletedAt: null, status: { in: [...COMMITTED_ORDER_STATUSES] } },
      }),
      prisma.customer.findMany({ where: { ...customerScopeWhere(req, scope), deletedAt: null }, select: { id: true, createdAt: true } }),
      period.from && period.to
        ? prisma.customer.count({
            where: { ...customerScopeWhere(req, scope), deletedAt: null, createdAt: { gte: period.from, lte: period.to } },
          })
        : prisma.customer.count({ where: { ...customerScopeWhere(req, scope), deletedAt: null } }),
      prisma.productVariant.findMany({
        where: { deletedAt: null },
        include: { inventoryItem: true, product: { select: { status: true } } },
      }),
      prisma.reminder.findMany({
        where: { ...reminderScopeWhere(req, scope), deletedAt: null, status: "pending" },
        select: { dueAt: true, status: true },
      }),
    ]);

    const totals = summarizeOrders(periodOrders.map((o: any) => ({
      id: o.id, customerId: o.customerId, status: o.status, paymentStatus: o.paymentStatus,
      grandTotal: dec(o.grandTotal), paidTotal: dec(o.paidTotal), debtTotal: dec(o.debtTotal),
      createdAt: o.createdAt, createdById: o.createdById ?? null,
    })));
    const debtAll = summarizeDebt(allTimeOrders.map((o: any) => ({
      id: o.id, customerId: o.customerId, status: o.status, paymentStatus: o.paymentStatus,
      grandTotal: dec(o.grandTotal), paidTotal: dec(o.paidTotal), debtTotal: dec(o.debtTotal),
      createdAt: o.createdAt, createdById: o.createdById ?? null,
    })));
    const inventory = summarizeInventory(
      variants.map((v: any) => ({
        productVariantId: v.id,
        quantity: v.inventoryItem?.quantity ?? 0,
        reservedQuantity: v.inventoryItem?.reservedQuantity ?? 0,
        currentImportPrice: v.importPrice === null || v.importPrice === undefined ? null : dec(v.importPrice),
      })),
      lowThreshold,
      has(req, "report.view_inventory_value") || has(req, "inventory.view_value"),
    );
    let overdue = 0;
    let dueToday = 0;
    for (const r of reminders) {
      const g = reminderGroup(r.status, r.dueAt, now);
      if (g === "overdue") overdue += 1;
      if (g === "due_today") dueToday += 1;
    }
    const byStatus: Record<string, number> = {};
    for (const o of periodOrders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;

    const revAllowed = revenueAllowed(req, scope);
    const data: Record<string, unknown> = {
      period: { preset: period.preset, from: period.fromLabel, to: period.toLabel },
      scope,
      scopeNote: scopeNote(scope),
      orders: {
        count: totals.ordersCount,
        byStatus,
        draftCount: byStatus.draft ?? 0,
        cancelledCount: byStatus.cancelled ?? 0,
      },
      customers: { total: customers.length, newInPeriod: newCustomers },
      inventory: {
        totalSkuCount: inventory.totalSkuCount,
        totalQuantity: inventory.totalQuantity,
        totalReservedQuantity: inventory.totalReservedQuantity,
        totalAvailableQuantity: inventory.totalAvailableQuantity,
        lowStockCount: inventory.lowStockCount,
        outOfStockCount: inventory.outOfStockCount,
        lowStockThreshold: lowThreshold,
        ...(inventory.inventoryValueEstimate !== null
          ? { inventoryValueEstimate: inventory.inventoryValueEstimate }
          : {}),
      },
      reminders: { overdueCount: overdue, dueTodayCount: dueToday, pendingCount: reminders.length },
      debt: {
        debtInScopeOwing: debtAll.totalDebtOwing,
        debtInScopeCredit: debtAll.totalCredit,
        debtInScopeNet: debtAll.netDebt,
        debtOrderCount: debtAll.debtOrderCount,
        debtCustomerCount: debtAll.debtCustomerCount,
        ...(canSystemDebt(req) ? { totalDebtAllTime: debtAll.totalDebtOwing } : {}),
      },
    };
    if (revAllowed) {
      (data as any).sales = {
        salesTotal: totals.salesTotal,
        paidTotal: totals.paidTotal,
        debtTotal: totals.debtTotal,
        averageOrderValue: totals.ordersCount > 0 ? totals.salesTotal / totals.ordersCount : null,
      };
    } else {
      (data as any).omittedFields = ["sales"];
      (data as any).omittedNote =
        "Bạn không có quyền xem doanh thu toàn hệ thống nên các trường doanh thu đã bị lược khỏi response (không phải bằng 0).";
    }
    res.json({ status: "ok", data });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/dashboard/revenue-by-day                                  */
/* ------------------------------------------------------------------ */

router.get("/dashboard/revenue-by-day", async (req, res) => {
  try {
    const scope = requireReportAccess(req, res);
    if (!scope) return;
    const period = parsePeriod(req.query as Record<string, unknown>);
    if (!period.from || !period.to) {
      res.status(400).json({ status: "error", message: "Doanh thu theo ngày cần khoảng thời gian cụ thể (preset today/7d/30d hoặc from/to), không dùng preset all." });
      return;
    }
    if (!revenueAllowed(req, scope)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem doanh thu toàn hệ thống." });
      return;
    }
    const prisma = getPrisma();
    const orders = await prisma.order.findMany({
      where: { ...orderScopeWhere(req, scope), ...periodWhere(period), deletedAt: null },
    });
    const days = revenueByDay(
      orders.map((o: any) => ({
        id: o.id, customerId: o.customerId, status: o.status, paymentStatus: o.paymentStatus,
        grandTotal: dec(o.grandTotal), paidTotal: dec(o.paidTotal), debtTotal: dec(o.debtTotal),
        createdAt: o.createdAt, createdById: o.createdById ?? null,
      })),
      period.from,
      period.to,
    );
    res.json({
      status: "ok",
      data: {
        period: { preset: period.preset, from: period.fromLabel, to: period.toLabel },
        scope,
        scopeNote: scopeNote(scope),
        note: "Doanh thu theo ngày tính theo ngày tạo đơn (createdAt, ngày UTC). Tiền đã thu theo ngày là tổng paidTotal snapshot của các đơn tạo trong ngày đó, không phải ngày tạo payment — xem revenue-by-payment-method để biết tiền thu theo ngày payment.",
        days,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/dashboard/revenue-by-payment-method                       */
/* ------------------------------------------------------------------ */

router.get("/dashboard/revenue-by-payment-method", async (req, res) => {
  try {
    const scope = requireReportAccess(req, res);
    if (!scope) return;
    const period = parsePeriod(req.query as Record<string, unknown>);
    if (!revenueAllowed(req, scope)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem doanh thu toàn hệ thống." });
      return;
    }
    const prisma = getPrisma();
    const payments = await prisma.payment.findMany({
      where: {
        status: "active",
        ...(period.from && period.to ? { createdAt: { gte: period.from, lte: period.to } } : {}),
        order: { deletedAt: null, ...(scope === "own" ? { createdById: req.user!.id } : {}) },
      },
      include: { order: { select: { status: true } } },
    });
    const methods = revenueByPaymentMethod(
      payments.map((p: any) => ({
        amount: dec(p.amount),
        paymentMethod: p.paymentMethod,
        createdAt: p.createdAt,
        orderStatus: p.order?.status ?? "",
      })),
    );
    res.json({
      status: "ok",
      data: {
        period: { preset: period.preset, from: period.fromLabel, to: period.toLabel },
        scope,
        scopeNote: scopeNote(scope),
        note: "Chỉ tính payment đang active của đơn confirmed/completed, nhóm theo ngày tạo payment (createdAt), không phải ngày tạo đơn.",
        methods: methods.map((m) => ({ ...m, paymentMethodLabel: paymentMethodLabel(m.paymentMethod) })),
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/reports/top-skus                                          */
/* ------------------------------------------------------------------ */

router.get("/reports/top-skus", async (req, res) => {
  try {
    const scope = requireReportAccess(req, res);
    if (!scope) return;
    const period = parsePeriod(req.query as Record<string, unknown>);
    const limit = parseLimit(req.query as Record<string, unknown>, 10);
    const includeProfit = has(req, "report.view_profit");
    const prisma = getPrisma();
    const items = await prisma.orderItem.findMany({
      where: {
        order: {
          deletedAt: null,
          status: { in: [...COMMITTED_ORDER_STATUSES] },
          ...(period.from && period.to ? { createdAt: { gte: period.from, lte: period.to } } : {}),
          ...(scope === "own" ? { createdById: req.user!.id } : {}),
        },
      },
      include: { variant: { include: { product: true } } },
    });
    const rows = topSkus(
      items.map((it: any) => ({
        productVariantId: it.productVariantId,
        sku: it.skuSnapshot,
        productName: it.productNameSnapshot,
        variantName: it.variantNameSnapshot,
        unitPrice: dec(it.unitPrice),
        discountAmount: dec(it.discountAmount),
        quantity: it.quantity,
        returnedQuantity: it.returnedQuantity,
        currentImportPrice: it.variant?.importPrice === null || it.variant?.importPrice === undefined ? null : dec(it.variant.importPrice),
        orderStatus: "confirmed", // already filtered to committed orders above
      })),
      limit,
      includeProfit,
    );
    res.json({
      status: "ok",
      data: {
        period: { preset: period.preset, from: period.fromLabel, to: period.toLabel },
        scope,
        scopeNote: scopeNote(scope),
        note: "Số lượng bán = quantity - returnedQuantity (dòng trả hết không tính). Doanh thu dòng = số lượng bán x đơn giá - discount dòng đã lưu (discount không chia tỷ lệ khi trả một phần). Lãi gộp chỉ là ước tính theo giá nhập hiện tại của SKU, xem lib/dashboard.ts.",
        ...(includeProfit ? {} : { grossProfitNote: "Bạn không có quyền xem lãi gộp nên trường grossProfitEstimate đã bị lược khỏi response." }),
        items: rows,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/reports/top-customers                                     */
/* ------------------------------------------------------------------ */

router.get("/reports/top-customers", async (req, res) => {
  try {
    const scope = requireReportAccess(req, res);
    if (!scope) return;
    const period = parsePeriod(req.query as Record<string, unknown>);
    const limit = parseLimit(req.query as Record<string, unknown>, 10);
    const prisma = getPrisma();
    const where = {
      ...orderScopeWhere(req, scope),
      ...periodWhere(period),
      deletedAt: null,
    };
    const [periodOrders, allOrders] = await Promise.all([
      prisma.order.findMany({ where, include: { customer: { select: { fullName: true } } } }),
      prisma.order.findMany({
        where: { ...orderScopeWhere(req, scope), deletedAt: null, status: { in: [...COMMITTED_ORDER_STATUSES] } },
        include: { customer: { select: { fullName: true } } },
      }),
    ]);
    const toRow = (o: any) => ({
      id: o.id, customerId: o.customerId, customerName: o.customer?.fullName ?? null,
      status: o.status, paymentStatus: o.paymentStatus,
      grandTotal: dec(o.grandTotal), paidTotal: dec(o.paidTotal), debtTotal: dec(o.debtTotal),
      createdAt: o.createdAt, createdById: o.createdById ?? null,
    });
    let rows = topCustomers(periodOrders.map(toRow), allOrders.map(toRow), limit);
    if (scope !== "own" && !revenueAllowed(req, scope)) {
      // System scope without revenue permission: customers may be
      // listed, but their money figures must not leak.
      rows = rows.map((r) => ({ ...r, grandTotal: undefined as unknown as number, paidTotal: undefined as unknown as number, currentDebt: r.currentDebt }));
      // Strip the undefined money fields explicitly so they are absent, not null.
      rows = rows.map((r) => {
        const { grandTotal: _g, paidTotal: _p, ...rest } = r as any;
        return rest;
      });
    }
    res.json({
      status: "ok",
      data: {
        period: { preset: period.preset, from: period.fromLabel, to: period.toLabel },
        scope,
        scopeNote: scopeNote(scope),
        note: "Top khách tính từ đơn confirmed/completed trong khoảng. currentDebt là tổng công nợ dương hiện tại của khách (mọi thời gian, chỉ đơn confirmed/completed), giống trang Công nợ.",
        items: rows,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/reports/debt                                              */
/* ------------------------------------------------------------------ */

router.get("/reports/debt", async (req, res) => {
  try {
    const scope = scopeOf(req);
    const hasDebtAccess = canViewDebt(req);
    if (scope === "none" && !hasDebtAccess) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem báo cáo công nợ." });
      return;
    }
    const period = parsePeriod(req.query as Record<string, unknown>);
    const limit = parseLimit(req.query as Record<string, unknown>, 10);
    // Debt scope: debt.view_own alone also means own orders; otherwise
    // fall back to the report scope. System debt total only for
    // system-debt holders.
    const orderWhere: Record<string, unknown> =
      scope === "own" || (!canSystemDebt(req) && hasDebtAccess)
        ? { createdById: req.user!.id }
        : {};
    const prisma = getPrisma();
    const [periodOrders, allOrders] = await Promise.all([
      prisma.order.findMany({
        where: { ...orderWhere, ...periodWhere(period), deletedAt: null, status: { in: [...COMMITTED_ORDER_STATUSES] } },
        include: { customer: { select: { fullName: true } } },
      }),
      prisma.order.findMany({
        where: { ...orderWhere, deletedAt: null, status: { in: [...COMMITTED_ORDER_STATUSES] } },
        include: { customer: { select: { fullName: true } } },
      }),
    ]);
    const toRow = (o: any) => ({
      id: o.id, customerId: o.customerId, status: o.status, paymentStatus: o.paymentStatus,
      grandTotal: dec(o.grandTotal), paidTotal: dec(o.paidTotal), debtTotal: dec(o.debtTotal),
      createdAt: o.createdAt, createdById: o.createdById ?? null,
    });
    const periodDebt = summarizeDebt(periodOrders.map(toRow));
    const allDebt = summarizeDebt(allOrders.map(toRow));
    const byCustomer = new Map<string, { customerId: string; customerName: string | null; debtTotal: number; orderCount: number }>();
    for (const o of allOrders) {
      if (dec(o.debtTotal) <= 0) continue;
      const row = byCustomer.get(o.customerId) ?? { customerId: o.customerId, customerName: o.customer?.fullName ?? null, debtTotal: 0, orderCount: 0 };
      row.debtTotal += dec(o.debtTotal);
      row.orderCount += 1;
      byCustomer.set(o.customerId, row);
    }
    const topDebtCustomers = [...byCustomer.values()].sort((a, b) => b.debtTotal - a.debtTotal).slice(0, limit);
    res.json({
      status: "ok",
      data: {
        period: { preset: period.preset, from: period.fromLabel, to: period.toLabel },
        scope: scope === "none" ? "own" : scope,
        scopeNote: scopeNote(scope === "none" ? "own" : scope),
        note: "Công nợ chỉ tính đơn confirmed/completed. totalDebtOwing là tổng các debtTotal dương (tiền thừa âm không trừ vào nợ); totalCredit là tổng tiền thừa cần hoàn. Khớp với trang Công nợ (cùng quy tắc).",
        inPeriod: periodDebt,
        ...(canSystemDebt(req)
          ? { allTime: allDebt, totalDebtAllTime: allDebt.totalDebtOwing }
          : { allTimeNote: "Bạn không có quyền xem công nợ toàn hệ thống nên tổng toàn hệ thống đã bị lược khỏi response." }),
        topDebtCustomers,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/reports/inventory                                         */
/* ------------------------------------------------------------------ */

router.get("/reports/inventory", async (req, res) => {
  try {
    const scope = scopeOf(req);
    const canInventory = has(req, "inventory.view");
    if (scope === "none" && !canInventory) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem báo cáo tồn kho." });
      return;
    }
    const lowThreshold = parseLowStockThreshold(req.query as Record<string, unknown>, 5);
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
    const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : null;
    const categoryId = typeof req.query.categoryId === "string" && req.query.categoryId.trim() ? req.query.categoryId.trim() : null;
    const stockStatus = typeof req.query.stockStatus === "string" ? req.query.stockStatus : "";
    const canValue = has(req, "report.view_inventory_value") || has(req, "inventory.view_value");
    const prisma = getPrisma();
    const variants = await prisma.productVariant.findMany({
      where: {
        deletedAt: null,
        ...(categoryId ? { product: { categoryId } } : {}),
        ...(q
          ? {
              OR: [
                { sku: { contains: q, mode: "insensitive" } },
                { variantName: { contains: q, mode: "insensitive" } },
                { product: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: { inventoryItem: true, product: { select: { name: true, status: true } } },
      orderBy: { sku: "asc" },
    });
    const rows = variants.map((v: any) => {
      const quantity = v.inventoryItem?.quantity ?? 0;
      const reserved = v.inventoryItem?.reservedQuantity ?? 0;
      return {
        productVariantId: v.id,
        sku: v.sku,
        productName: v.product?.name ?? null,
        variantName: v.variantName,
        productStatus: v.product?.status ?? null,
        variantStatus: v.status,
        quantity,
        reservedQuantity: reserved,
        availableQuantity: quantity - reserved,
        stockStatus: quantity === 0 ? "out_of_stock" : quantity <= lowThreshold ? "low_stock" : "ok",
        ...(canValue
          ? {
              importPrice: v.importPrice === null || v.importPrice === undefined ? null : dec(v.importPrice),
              inventoryValueEstimate: quantity * (v.importPrice === null || v.importPrice === undefined ? 0 : dec(v.importPrice)),
            }
          : {}),
      };
    });
    const filtered = stockStatus ? rows.filter((r: any) => r.stockStatus === stockStatus) : rows;
    const summary = summarizeInventory(
      rows.map((r: any) => ({
        productVariantId: r.productVariantId,
        quantity: r.quantity,
        reservedQuantity: r.reservedQuantity,
        currentImportPrice: canValue ? (r as any).importPrice ?? null : null,
      })),
      lowThreshold,
      canValue,
    );
    const lowStock = rows
      .filter((r: any) => r.quantity <= lowThreshold && r.quantity > 0)
      .sort((a: any, b: any) => a.quantity - b.quantity)
      .slice(0, 50);
    const outOfStock = rows.filter((r: any) => r.quantity === 0).slice(0, 50);
    res.json({
      status: "ok",
      data: {
        lowStockThreshold: lowThreshold,
        summary,
        lowStock,
        outOfStock,
        items: filtered.slice((page - 1) * pageSize, page * pageSize),
        pagination: { page, pageSize, total: filtered.length, totalPages: Math.ceil(filtered.length / pageSize) },
        ...(canValue
          ? { valueNote: "Giá trị tồn kho là ước tính theo giá nhập hiện tại của SKU, không phải giá vốn theo lô." }
          : { valueNote: "Bạn không có quyền xem giá trị tồn kho nên trường giá trị đã bị lược khỏi response." }),
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
