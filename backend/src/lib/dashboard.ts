/**
 * Dashboard / Report pure logic — Sprint Dashboard / Báo cáo.
 *
 * This module imports NOTHING from Prisma, so it can be unit-tested
 * without a database. All money is plain numbers (the Order model
 * stores Decimal; routes convert with Number() before calling here).
 *
 * Definitions (kept identical in DEVELOPMENT_PLAN.md and README.md):
 *  - A "committed" order is confirmed or completed only. Draft and
 *    cancelled orders NEVER count toward revenue, paid, top-SKU or
 *    top-customer figures. Cancelled payments NEVER count as paid.
 *  - sales_total (period) = sum of grandTotal of committed orders
 *    created in the period, AFTER returns (grandTotal is already
 *    recomputed by the Order sprint on return).
 *  - paid_total (period) = sum of the Order.paidTotal SNAPSHOTS of
 *    those same orders. That snapshot is maintained by the Payment
 *    sprint's recalculate service (sum of active payments), so it
 *    agrees with the Payment table — but note the attribution: a
 *    payment made later for an old order counts on the ORDER's
 *    creation day, not on the payment day. Revenue-by-payment-method
 *    is the exception: it groups by payment creation day.
 *  - debt_total (period) = sales_total - paid_total (net; may be
 *    negative when returns made grandTotal smaller than paidTotal —
 *    that is customer credit, not debt owed).
 *  - A sold line for top-SKU = quantity - returnedQuantity. Lines
 *    fully returned (soldQty <= 0) are excluded. Line revenue =
 *    soldQty * unitPrice - discountAmount. LIMITATION: discountAmount
 *    is the stored line discount, which the Order sprint keeps in
 *    full while any quantity remains and drops only when the line
 *    is fully returned — it is NOT prorated on partial returns, so
 *    partial-return line revenue is slightly understated.
 *  - gross_profit (estimate only) = sum over sold lines of
 *    (unitPrice - currentImportPrice) * soldQty. LIMITATION: the
 *    import price used is the SKU's CURRENT importPrice, not the
 *    historical cost at sale time and not lot cost. This is an
 *    estimate, never an accounting-accurate profit. Variants with
 *    no importPrice contribute cost 0 (their full revenue counts
 *    toward profit), which overstates profit for those lines.
 *  - Dates are UTC days, consistent with the Care sprint: a day
 *    rolls over at 07:00 Vietnam time. This is documented, not hidden.
 */

export class DashboardError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function isDashboardError(err: unknown): err is DashboardError {
  return err instanceof DashboardError;
}

export type PeriodPreset = "today" | "7d" | "30d" | "all";

export interface Period {
  preset: PeriodPreset;
  from: Date | null; // inclusive, start of UTC day (null for "all")
  to: Date | null; // inclusive end (end of UTC day, null for "all")
  fromLabel: string | null; // YYYY-MM-DD or null
  toLabel: string | null;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfUtcDay(d: Date): Date {
  const s = startOfUtcDay(d);
  return new Date(s.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function formatDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDateParam(value: unknown, name: string): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DashboardError(`Tham số ${name} phải có dạng YYYY-MM-DD.`);
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || formatDay(d) !== value) {
    throw new DashboardError(`Tham số ${name} không phải ngày hợp lệ.`);
  }
  return d;
}

/**
 * Parse ?preset= / ?from= / ?to= into a Period.
 * Default (no params): last 30 days. Explicit from/to win over preset
 * (except preset=all with no from/to means all time). Max range 365 days.
 */
export function parsePeriod(query: Record<string, unknown>, now = new Date()): Period {
  const presetRaw = typeof query.preset === "string" ? query.preset : "";
  const hasFrom = typeof query.from === "string" && query.from.trim() !== "";
  const hasTo = typeof query.to === "string" && query.to.trim() !== "";
  if (presetRaw !== "" && !["today", "7d", "30d", "all"].includes(presetRaw)) {
    throw new DashboardError("preset phải là một trong: today, 7d, 30d, all.");
  }
  const today = startOfUtcDay(now);
  if (!hasFrom && !hasTo) {
    const preset = (presetRaw || "30d") as PeriodPreset;
    if (preset === "all") return { preset, from: null, to: null, fromLabel: null, toLabel: null };
    if (preset === "today") {
      return { preset, from: today, to: endOfUtcDay(today), fromLabel: formatDay(today), toLabel: formatDay(today) };
    }
    const days = preset === "7d" ? 7 : 30;
    const from = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    return { preset, from, to: endOfUtcDay(today), fromLabel: formatDay(from), toLabel: formatDay(today) };
  }
  // Explicit range: both bounds required for an unambiguous window.
  if (!hasFrom || !hasTo) {
    throw new DashboardError("Khi dùng khoảng ngày tùy chọn, phải gửi cả from và to (dạng YYYY-MM-DD).");
  }
  const fromDay = startOfUtcDay(parseDateParam(query.from, "from"));
  const toDay = startOfUtcDay(parseDateParam(query.to, "to"));
  if (fromDay.getTime() > toDay.getTime()) {
    throw new DashboardError("from phải nhỏ hơn hoặc bằng to.");
  }
  const rangeDays = Math.round((toDay.getTime() - fromDay.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (rangeDays > 365) {
    throw new DashboardError("Khoảng ngày tối đa là 365 ngày.");
  }
  return {
    preset: (presetRaw || "custom") as PeriodPreset,
    from: fromDay,
    to: endOfUtcDay(toDay),
    fromLabel: formatDay(fromDay),
    toLabel: formatDay(toDay),
  };
}

export function parseLimit(query: Record<string, unknown>, fallback = 10): number {
  const raw = parseInt(String(query.limit ?? ""), 10);
  if (Number.isNaN(raw)) return fallback;
  return Math.min(50, Math.max(1, raw));
}

export function parseLowStockThreshold(query: Record<string, unknown>, fallback = 5): number {
  const raw = parseInt(String(query.lowStockThreshold ?? query.maxQuantity ?? ""), 10);
  if (Number.isNaN(raw)) return fallback;
  if (raw < 0) throw new DashboardError("Ngưỡng tồn thấp không được âm.");
  return raw;
}

export const COMMITTED_ORDER_STATUSES = ["confirmed", "completed"] as const;

export interface OrderRow {
  id: string;
  customerId: string;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  paidTotal: number;
  debtTotal: number;
  createdAt: Date;
  createdById?: string | null;
}

export function isCommitted(order: { status: string }): boolean {
  return (COMMITTED_ORDER_STATUSES as readonly string[]).includes(order.status);
}

export interface PeriodTotals {
  salesTotal: number;
  paidTotal: number;
  debtTotal: number;
  ordersCount: number;
}

export function summarizeOrders(orders: OrderRow[]): PeriodTotals {
  const committed = orders.filter(isCommitted);
  const salesTotal = committed.reduce((s, o) => s + o.grandTotal, 0);
  const paidTotal = committed.reduce((s, o) => s + o.paidTotal, 0);
  return { salesTotal, paidTotal, debtTotal: salesTotal - paidTotal, ordersCount: committed.length };
}

export interface DayRevenue {
  date: string;
  salesTotal: number;
  paidTotal: number;
  debtTotal: number;
  ordersCount: number;
}

export function revenueByDay(orders: OrderRow[], from: Date, to: Date): DayRevenue[] {
  const map = new Map<string, DayRevenue>();
  for (let d = startOfUtcDay(from); d.getTime() <= startOfUtcDay(to).getTime(); d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
    const key = formatDay(d);
    map.set(key, { date: key, salesTotal: 0, paidTotal: 0, debtTotal: 0, ordersCount: 0 });
  }
  for (const o of orders.filter(isCommitted)) {
    const key = formatDay(o.createdAt);
    const row = map.get(key);
    if (!row) continue;
    row.salesTotal += o.grandTotal;
    row.paidTotal += o.paidTotal;
    row.ordersCount += 1;
  }
  for (const row of map.values()) row.debtTotal = row.salesTotal - row.paidTotal;
  return [...map.values()];
}

export interface PaymentRow {
  amount: number;
  paymentMethod: string;
  createdAt: Date;
  orderStatus: string;
}

export const PAYMENT_METHODS = ["cash", "bank_transfer", "cod", "e_wallet"] as const;

export function paymentMethodLabel(method: string): string {
  switch (method) {
    case "cash": return "Tiền mặt";
    case "bank_transfer": return "Chuyển khoản";
    case "cod": return "COD";
    case "e_wallet": return "Ví điện tử";
    default: return method;
  }
}

export interface MethodRevenue {
  paymentMethod: string;
  paymentMethodLabel: string;
  totalAmount: number;
  paymentCount: number;
}

export function revenueByPaymentMethod(payments: PaymentRow[]): MethodRevenue[] {
  const map = new Map<string, MethodRevenue>();
  for (const p of payments) {
    if (!(COMMITTED_ORDER_STATUSES as readonly string[]).includes(p.orderStatus)) continue;
    const row = map.get(p.paymentMethod) ?? {
      paymentMethod: p.paymentMethod,
      paymentMethodLabel: paymentMethodLabel(p.paymentMethod),
      totalAmount: 0,
      paymentCount: 0,
    };
    row.totalAmount += p.amount;
    row.paymentCount += 1;
    map.set(p.paymentMethod, row);
  }
  return [...map.values()].sort((a, b) => b.totalAmount - a.totalAmount);
}

export interface OrderItemRow {
  productVariantId: string;
  sku: string;
  productName: string;
  variantName: string;
  unitPrice: number;
  discountAmount: number;
  quantity: number;
  returnedQuantity: number;
  currentImportPrice: number | null;
  orderStatus: string;
}

export interface TopSku {
  productVariantId: string;
  sku: string;
  productName: string;
  variantName: string;
  quantitySold: number;
  revenue: number;
  grossProfitEstimate: number | null; // null when caller did not ask for profit
}

export function topSkus(items: OrderItemRow[], limit: number, includeProfit: boolean): TopSku[] {
  const map = new Map<string, TopSku & { cost: number }>();
  for (const it of items) {
    if (!(COMMITTED_ORDER_STATUSES as readonly string[]).includes(it.orderStatus)) continue;
    const soldQty = it.quantity - it.returnedQuantity;
    if (soldQty <= 0) continue; // fully returned lines are not sales
    const revenue = soldQty * it.unitPrice - it.discountAmount;
    const row = map.get(it.productVariantId) ?? {
      productVariantId: it.productVariantId,
      sku: it.sku,
      productName: it.productName,
      variantName: it.variantName,
      quantitySold: 0,
      revenue: 0,
      grossProfitEstimate: 0,
      cost: 0,
    };
    row.quantitySold += soldQty;
    row.revenue += revenue;
    row.cost += soldQty * (it.currentImportPrice ?? 0);
    map.set(it.productVariantId, row);
  }
  return [...map.values()]
    .sort((a, b) => b.revenue - a.revenue || b.quantitySold - a.quantitySold)
    .slice(0, limit)
    .map((r) => ({
      productVariantId: r.productVariantId,
      sku: r.sku,
      productName: r.productName,
      variantName: r.variantName,
      quantitySold: r.quantitySold,
      revenue: r.revenue,
      grossProfitEstimate: includeProfit ? r.revenue - r.cost : null,
    }));
}

export interface TopCustomer {
  customerId: string;
  customerName: string | null;
  ordersCount: number;
  grandTotal: number;
  paidTotal: number;
  currentDebt: number; // sum of POSITIVE debtTotals of the customer's committed orders (all time)
}

export function topCustomers(
  orders: (OrderRow & { customerName?: string | null })[],
  allTimeOrders: (OrderRow & { customerName?: string | null })[],
  limit: number,
): TopCustomer[] {
  const map = new Map<string, TopCustomer>();
  for (const o of orders.filter(isCommitted)) {
    const row = map.get(o.customerId) ?? {
      customerId: o.customerId,
      customerName: o.customerName ?? null,
      ordersCount: 0,
      grandTotal: 0,
      paidTotal: 0,
      currentDebt: 0,
    };
    row.ordersCount += 1;
    row.grandTotal += o.grandTotal;
    row.paidTotal += o.paidTotal;
    map.set(o.customerId, row);
  }
  // Current debt is all-time, not period-bound (same rule as the debt page).
  const debtByCustomer = new Map<string, number>();
  for (const o of allTimeOrders.filter(isCommitted)) {
    if (o.debtTotal > 0) debtByCustomer.set(o.customerId, (debtByCustomer.get(o.customerId) ?? 0) + o.debtTotal);
  }
  for (const row of map.values()) row.currentDebt = debtByCustomer.get(row.customerId) ?? 0;
  return [...map.values()]
    .sort((a, b) => b.grandTotal - a.grandTotal || b.ordersCount - a.ordersCount)
    .slice(0, limit);
}

export interface DebtSummary {
  totalDebtOwing: number; // sum of positive debtTotals only (credit never nets debt away)
  totalCredit: number; // sum of |negative debtTotals| (overpaid, to be refunded)
  netDebt: number; // owing - credit
  debtOrderCount: number;
  debtCustomerCount: number;
  byPaymentStatus: { paymentStatus: string; orderCount: number; debtTotal: number }[];
}

export function summarizeDebt(orders: OrderRow[]): DebtSummary {
  const committed = orders.filter(isCommitted);
  let totalDebtOwing = 0;
  let totalCredit = 0;
  let debtOrderCount = 0;
  const customers = new Set<string>();
  const byStatus = new Map<string, { orderCount: number; debtTotal: number }>();
  for (const o of committed) {
    if (o.debtTotal > 0) {
      totalDebtOwing += o.debtTotal;
      debtOrderCount += 1;
      customers.add(o.customerId);
      const row = byStatus.get(o.paymentStatus) ?? { orderCount: 0, debtTotal: 0 };
      row.orderCount += 1;
      row.debtTotal += o.debtTotal;
      byStatus.set(o.paymentStatus, row);
    } else if (o.debtTotal < 0) {
      totalCredit += -o.debtTotal;
    }
  }
  return {
    totalDebtOwing,
    totalCredit,
    netDebt: totalDebtOwing - totalCredit,
    debtOrderCount,
    debtCustomerCount: customers.size,
    byPaymentStatus: [...byStatus.entries()].map(([paymentStatus, v]) => ({ paymentStatus, ...v })),
  };
}

export interface InventoryRow {
  productVariantId: string;
  quantity: number;
  reservedQuantity: number;
  currentImportPrice: number | null;
}

export interface InventorySummary {
  totalSkuCount: number;
  totalQuantity: number;
  totalReservedQuantity: number;
  totalAvailableQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
  inventoryValueEstimate: number | null; // null when caller may not see value
}

export function summarizeInventory(
  rows: InventoryRow[],
  lowStockThreshold: number,
  includeValue: boolean,
): InventorySummary {
  let totalQuantity = 0;
  let totalReserved = 0;
  let low = 0;
  let out = 0;
  let value = 0;
  for (const r of rows) {
    totalQuantity += r.quantity;
    totalReserved += r.reservedQuantity;
    if (r.quantity <= lowStockThreshold) low += 1;
    if (r.quantity === 0) out += 1;
    if (includeValue) value += r.quantity * (r.currentImportPrice ?? 0);
  }
  return {
    totalSkuCount: rows.length,
    totalQuantity,
    totalReservedQuantity: totalReserved,
    totalAvailableQuantity: totalQuantity - totalReserved,
    lowStockCount: low,
    outOfStockCount: out,
    inventoryValueEstimate: includeValue ? value : null,
  };
}

// Reminder time groups, same UTC-day rule as the Care sprint (lib/care.ts).
export function reminderGroup(status: string, dueAt: Date, now: Date): "overdue" | "due_today" | "upcoming" | "other" {
  if (status !== "pending") return "other";
  const due = startOfUtcDay(dueAt);
  const today = startOfUtcDay(now);
  if (due.getTime() < today.getTime()) return "overdue";
  if (due.getTime() === today.getTime()) return "due_today";
  return "upcoming";
}
