/**
 * Care / Reminder / Segment pure logic — Sprint Chăm sóc / Nhắc việc.
 *
 * This module imports NOTHING from Prisma, so it can be unit-tested
 * without a database. All date math is done in UTC days: a reminder is
 * "due today" when its due date falls on the server's current UTC day,
 * and a birthday is "upcoming" when its next occurrence falls within
 * the window. Operators should be aware the server timezone is UTC;
 * a shop running in Asia/Bangkok will see the day roll over at 07:00
 * local time. That is documented, not hidden.
 *
 * Deliberately NOT in this sprint (locked decision):
 *  - No automatic sending via Zalo / SMS / Email / Messenger. Segments
 *    are lists for staff to act on by hand; nothing sends, and no
 *    activity is auto-created by a segment.
 *  - No background job. Overdue / due-today / upcoming are DERIVED
 *    from dueAt + status at read time (docs 06 §6.2 note).
 */

// Activity types (docs 06 §5.2, fixed list — free-form types rejected).
export const ACTIVITY_TYPES = [
  "call",
  "zalo",
  "facebook",
  "email",
  "visit",
  "consultation",
  "quote",
  "close",
  "reschedule",
  "refuse",
  "after_sales",
  "payment_reminder",
  "complaint",
  "internal_note",
  "other",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export function isValidActivityType(value: unknown): value is ActivityType {
  return typeof value === "string" && (ACTIVITY_TYPES as readonly string[]).includes(value);
}

// Activity results (docs 06 §5.3, optional free-text in docs, but a fixed
// list keeps reporting comparable; "other" is the escape hatch).
export const ACTIVITY_RESULTS = [
  "contacted",
  "no_answer",
  "wrong_number",
  "interested",
  "not_interested",
  "callback",
  "quoted",
  "closed",
  "refused",
  "need_followup",
  "payment_reminded",
  "resolved",
  "other",
] as const;

export function isValidActivityResult(value: unknown): boolean {
  return value === null || value === undefined || value === "" ||
    (typeof value === "string" && (ACTIVITY_RESULTS as readonly string[]).includes(value));
}

// Reminder types (docs 06 §6.1, fixed list).
export const REMINDER_TYPES = [
  "callback",
  "message",
  "after_sales",
  "birthday",
  "payment",
  "complaint",
  "delivery",
  "check_order",
  "other",
] as const;

export function isValidReminderType(value: unknown): boolean {
  return value === null || value === undefined || value === "" ||
    (typeof value === "string" && (REMINDER_TYPES as readonly string[]).includes(value));
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/** Age in whole years at a given date (never stored, always computed). */
export function ageYearsAt(dateOfBirth: Date, at: Date): number {
  let age = at.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const birthdayThisYear = new Date(Date.UTC(at.getUTCFullYear(), dateOfBirth.getUTCMonth(), dateOfBirth.getUTCDate()));
  if (at < birthdayThisYear) age -= 1;
  return age;
}

export interface NextBirthday {
  date: Date;
  upcomingAge: number;
}

/**
 * Next occurrence of a month/day birthday on/after `from` (day precision).
 * Feb 29 birthdays surface on Feb 28 in non-leap years — a documented
 * choice, so a leap-day child is never silently skipped in a normal year.
 */
export function nextBirthday(dateOfBirth: Date, from: Date): NextBirthday {
  const fromDay = startOfUtcDay(from);
  const month = dateOfBirth.getUTCMonth();
  const day = dateOfBirth.getUTCDate();
  for (let year = fromDay.getUTCFullYear(); year <= fromDay.getUTCFullYear() + 2; year += 1) {
    let candidate: Date;
    if (month === 1 && day === 29) {
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      candidate = isLeap
        ? new Date(Date.UTC(year, 1, 29))
        : new Date(Date.UTC(year, 1, 28));
    } else {
      candidate = new Date(Date.UTC(year, month, day));
    }
    if (candidate >= fromDay) {
      return { date: candidate, upcomingAge: year - dateOfBirth.getUTCFullYear() };
    }
  }
  // Unreachable (loop covers 3 years), kept for type safety.
  throw new Error("Could not compute next birthday");
}

export function isBirthdayWithin(dateOfBirth: Date, from: Date, days: number): boolean {
  const next = nextBirthday(dateOfBirth, from);
  const limit = addDays(startOfUtcDay(from), days);
  return next.date <= limit;
}

export type ReminderTimeGroup = "overdue" | "due_today" | "upcoming" | "done" | "cancelled" | "all";

/** Derive a reminder's time group from status + dueAt at read time. */
export function reminderTimeGroup(status: string, dueAt: Date, now: Date): "overdue" | "due_today" | "upcoming" | "done" | "cancelled" | "other" {
  if (status === "completed") return "done";
  if (status === "cancelled") return "cancelled";
  const dueDay = startOfUtcDay(dueAt);
  const today = startOfUtcDay(now);
  if (dueDay < today) return "overdue";
  if (dueDay.getTime() === today.getTime()) return "due_today";
  return "upcoming";
}

export function matchesTimeGroup(
  status: string,
  dueAt: Date,
  group: ReminderTimeGroup,
  now: Date,
  upcomingDays = 7,
): boolean {
  if (group === "all") return true;
  if (group === "done") return status === "completed";
  if (group === "cancelled") return status === "cancelled";
  if (status !== "pending") return false;
  const derived = reminderTimeGroup(status, dueAt, now);
  if (group === "upcoming") {
    if (derived !== "upcoming") return false;
    const limit = addDays(startOfUtcDay(now), upcomingDays);
    return startOfUtcDay(dueAt) <= limit;
  }
  return derived === group;
}

// ---------- Segments ----------

export const SEGMENT_DEFINITIONS = [
  { key: "birthday_customers", name: "Sinh nhật khách trong thời gian tới", description: "Khách đang hoạt động có sinh nhật trong N ngày tới (mặc định 7 ngày, theo ngày/tháng sinh nhật, không phụ thuộc năm sinh). Chỉ là danh sách để chăm sóc thủ công, không tự gửi tin." },
  { key: "birthday_children", name: "Sinh nhật con trong thời gian tới", description: "Con của khách đang hoạt động có sinh nhật trong N ngày tới (mặc định 7 ngày). Chỉ trả tên con, khách liên quan, ngày sinh nhật sắp tới và tuổi sắp tới — không trả toàn bộ hồ sơ con." },
  { key: "inactive_customers", name: "Khách lâu không mua", description: "Khách đã từng mua (có đơn confirmed/completed) nhưng không có đơn nào trong X ngày qua (mặc định 90 ngày). Khách chưa từng mua thuộc nhóm riêng, không lẫn vào đây." },
  { key: "new_customers", name: "Khách mới", description: "Khách tạo trong 30 ngày qua (tham số days đổi được)." },
  { key: "no_purchase_customers", name: "Khách chưa từng mua", description: "Khách đang hoạt động chưa từng có đơn confirmed/completed nào." },
  { key: "debt_customers", name: "Khách còn nợ", description: "Khách có tổng công nợ > 0, tính như Sprint Thanh toán: chỉ đơn confirmed/completed, tổng debt_total của khách. Khớp với trang Công nợ." },
  { key: "high_value_customers", name: "Khách giá trị cao", description: "Khách có tổng tiền đơn confirmed/completed (grand_total sau trả hàng, KHÔNG phải paid_total) >= ngưỡng (mặc định 5.000.000, tham số threshold đổi được)." },
  { key: "by_tag", name: "Khách theo tag", description: "Khách đang hoạt động được gán tagId chỉ định. Cần tham số tagId." },
] as const;

export type SegmentKey = (typeof SEGMENT_DEFINITIONS)[number]["key"];

export function isSegmentKey(value: unknown): value is SegmentKey {
  return typeof value === "string" &&
    (SEGMENT_DEFINITIONS as readonly { key: string }[]).some((d) => d.key === value);
}

export interface OrderSummary {
  status: string;
  grandTotal: number;
  debtTotal: number;
  createdAt: Date;
}

const COMMITTED_ORDER_STATUSES = ["confirmed", "completed"];

/** Orders that count for purchase-based segments (same rule as debt). */
export function committedOrders(orders: OrderSummary[]): OrderSummary[] {
  return orders.filter((o) => COMMITTED_ORDER_STATUSES.includes(o.status));
}

export function totalGrand(orders: OrderSummary[]): number {
  return committedOrders(orders).reduce((sum, o) => sum + o.grandTotal, 0);
}

export function totalDebt(orders: OrderSummary[]): number {
  return committedOrders(orders).reduce((sum, o) => sum + o.debtTotal, 0);
}

export function lastPurchaseAt(orders: OrderSummary[]): Date | null {
  const committed = committedOrders(orders);
  if (committed.length === 0) return null;
  return committed.reduce((max, o) => (o.createdAt > max ? o.createdAt : max), committed[0].createdAt);
}

export function isInactiveCustomer(orders: OrderSummary[], now: Date, days = 90): boolean {
  const last = lastPurchaseAt(orders);
  if (!last) return false; // never purchased -> no_purchase segment, not inactive
  return last.getTime() < now.getTime() - days * 24 * 60 * 60 * 1000;
}

export function isNewCustomer(createdAt: Date, now: Date, days = 30): boolean {
  return createdAt.getTime() >= now.getTime() - days * 24 * 60 * 60 * 1000;
}
