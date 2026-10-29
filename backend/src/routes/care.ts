/**
 * Care / Reminder / Segment API — Sprint Chăm sóc / Nhắc việc.
 *
 * Locked rules applied here (docs/12_QUY_TAC_CHOT_CUNG.md §5, §6):
 *  §5  No hard delete of data with history. Activities are IMMUTABLE:
 *      there is deliberately NO update/delete route for activities —
 *      a wrong note is corrected by writing a new activity, so the
 *      history stays truthful. Reminders are never hard-deleted either;
 *      they are completed or cancelled (status change, audited).
 *  §6  Backend permission + data-scope checks on every route.
 *      Frontend hiding is never a substitute.
 *
 * Deliberately NOT in this sprint:
 *  - No automatic sending via Zalo / SMS / Email / Messenger. Segments
 *    are lists for staff to act on by hand; nothing sends and no
 *    activity is auto-created by a segment or a reminder.
 *  - No background job. Overdue / due-today / upcoming are DERIVED
 *    from dueAt + status at read time (docs 06 §6.2 note).
 *  - No dashboard, import or export.
 *
 * Schema notes (migration pending, not yet run — no DB on this machine):
 *  CustomerActivity gains performedAt + result (docs 06 §5.2/§5.3).
 *  Reminder gains assignedToId, completedById, cancelReason,
 *  completionNote, type, orderId, and a nullable customerId (a reminder
 *  may be general, e.g. "call the supplier", without a customer).
 */

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { getPrisma } from "../lib/prisma";
import {
  ACTIVITY_TYPES,
  ageYearsAt,
  isBirthdayWithin,
  isInactiveCustomer,
  isNewCustomer,
  isSegmentKey,
  isValidActivityResult,
  isValidActivityType,
  isValidReminderType,
  matchesTimeGroup,
  nextBirthday,
  reminderTimeGroup,
  SEGMENT_DEFINITIONS,
  totalDebt,
  totalGrand,
  type ReminderTimeGroup,
  type SegmentKey,
} from "../lib/care";

const router = Router();
router.use(authenticate);

type AnyReq = import("express").Request;
type AnyRes = import("express").Response;

function dbUnavailable(res: AnyRes, err: unknown) {
  console.error("[care] database error:", err);
  res.status(503).json({
    status: "error",
    message: "Chưa kết nối được database. Hãy chạy PostgreSQL (docker compose up -d postgres) rồi thử lại.",
  });
}

function parsePagination(req: AnyReq): { page: number; pageSize: number } {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
  return { page, pageSize };
}

function parseDate(value: unknown): { date: Date | null; error?: string } {
  if (value === undefined || value === null || value === "") return { date: null };
  if (typeof value !== "string") return { date: null, error: "Ngày phải là chuỗi ISO (YYYY-MM-DD)." };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: null, error: `Ngày "${value}" không hợp lệ.` };
  return { date: d };
}

function canViewAllCare(req: AnyReq): boolean {
  return req.user!.permissions.includes("activity.view_all");
}

function canViewCare(req: AnyReq): boolean {
  return canViewAllCare(req) || req.user!.permissions.includes("activity.view_own");
}

function canViewAllCustomers(req: AnyReq): boolean {
  return req.user!.permissions.includes("customer.view_all");
}

function customerScopeWhere(req: AnyReq): Record<string, unknown> {
  if (canViewAllCustomers(req)) return {};
  return { OR: [{ createdById: req.user!.id }, { assignedToId: req.user!.id }] };
}

function customerInScope(customer: { createdById: string | null; assignedToId: string | null }, req: AnyReq): boolean {
  if (canViewAllCustomers(req)) return true;
  return customer.createdById === req.user!.id || customer.assignedToId === req.user!.id;
}

function canViewAllReminders(req: AnyReq): boolean {
  return req.user!.permissions.includes("reminder.view_all");
}

function canViewReminders(req: AnyReq): boolean {
  return canViewAllReminders(req) || req.user!.permissions.includes("reminder.view_own");
}

function reminderInScope(r: { createdById: string | null; assignedToId: string | null }, req: AnyReq): boolean {
  if (canViewAllReminders(req)) return true;
  return r.createdById === req.user!.id || r.assignedToId === req.user!.id;
}

/** Only managers/admins (reminder.view_all holders) may assign to others. */
function canAssignOthers(req: AnyReq): boolean {
  return canViewAllReminders(req);
}

function serializeActivity(a: any) {
  return {
    id: a.id,
    customerId: a.customerId,
    customerName: a.customer?.fullName ?? null,
    type: a.type,
    title: a.title,
    content: a.content ?? null,
    result: a.result ?? null,
    performedAt: a.performedAt ?? a.createdAt,
    createdById: a.createdById ?? null,
    createdByName: a.createdBy?.fullName ?? null,
    createdAt: a.createdAt,
  };
}

function serializeReminder(r: any) {
  const now = new Date();
  return {
    id: r.id,
    customerId: r.customerId ?? null,
    customerName: r.customer?.fullName ?? null,
    orderId: r.orderId ?? null,
    orderCode: r.order?.orderCode ?? null,
    title: r.title,
    description: r.description ?? null,
    type: r.type ?? null,
    dueAt: r.dueAt,
    timeGroup: reminderTimeGroup(r.status, new Date(r.dueAt), now),
    status: r.status,
    assignedToId: r.assignedToId ?? null,
    assignedToName: r.assignedTo?.fullName ?? null,
    createdById: r.createdById ?? null,
    createdByName: r.createdBy?.fullName ?? null,
    completedAt: r.completedAt ?? null,
    completedById: r.completedById ?? null,
    completionNote: r.completionNote ?? null,
    cancelReason: r.cancelReason ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Activities                                                          */
/* ------------------------------------------------------------------ */

/* GET /api/customers/:id/activities — history of one customer, newest first. */
router.get("/customers/:id/activities", async (req, res) => {
  try {
    if (!canViewCare(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem hoạt động chăm sóc." });
      return;
    }
    const prisma: any = getPrisma();
    const { page, pageSize } = parsePagination(req);
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer || customer.deletedAt) {
      res.status(404).json({ status: "error", message: "Không tìm thấy khách hàng." });
      return;
    }
    if (!canViewAllCare(req) && !customerInScope(customer, req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem hoạt động của khách hàng này." });
      return;
    }
    const where: Record<string, unknown> = { customerId: customer.id };
    const type = String(req.query.type ?? "");
    if (type) where.type = type;
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    if (from.error || to.error) {
      res.status(400).json({ status: "error", message: from.error ?? to.error });
      return;
    }
    if (from.date || to.date) {
      where.performedAt = {
        ...(from.date ? { gte: from.date } : {}),
        ...(to.date ? { lte: to.date } : {}),
      };
    }
    const [total, rows] = await Promise.all([
      prisma.customerActivity.count({ where }),
      prisma.customerActivity.findMany({
        where,
        orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: { select: { fullName: true } }, createdBy: { select: { fullName: true } } },
      }),
    ]);
    res.json({
      status: "ok",
      customer: { id: customer.id, fullName: customer.fullName },
      activities: rows.map(serializeActivity),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* POST /api/customers/:id/activities — write one immutable activity. */
router.post("/customers/:id/activities", authorize("activity.create"), async (req, res) => {
  try {
    const prisma: any = getPrisma();
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!isValidActivityType(body.type)) {
      res.status(400).json({
        status: "error",
        message: `Loại hoạt động không hợp lệ. Loại cho phép: ${ACTIVITY_TYPES.join(", ")}.`,
      });
      return;
    }
    if (typeof body.content !== "string" || !body.content.trim()) {
      res.status(400).json({ status: "error", message: "Nội dung hoạt động là bắt buộc." });
      return;
    }
    if (!isValidActivityResult(body.result)) {
      res.status(400).json({ status: "error", message: "Kết quả hoạt động không hợp lệ." });
      return;
    }
    const performed = parseDate(body.performedAt);
    if (performed.error) {
      res.status(400).json({ status: "error", message: performed.error });
      return;
    }
    if (performed.date && performed.date > new Date()) {
      res.status(400).json({ status: "error", message: "Ngày thực hiện không được là ngày tương lai." });
      return;
    }
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer || customer.deletedAt) {
      res.status(404).json({ status: "error", message: "Không tìm thấy khách hàng." });
      return;
    }
    if (!canViewAllCare(req) && !customerInScope(customer, req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền ghi hoạt động cho khách hàng này." });
      return;
    }
    const activity = await prisma.customerActivity.create({
      data: {
        customerId: customer.id,
        type: body.type,
        title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : String(body.type),
        content: String(body.content).trim(),
        result: typeof body.result === "string" && body.result.trim() ? body.result.trim() : null,
        performedAt: performed.date ?? new Date(),
        createdById: req.user!.id,
      },
      include: { customer: { select: { fullName: true } }, createdBy: { select: { fullName: true } } },
    });
    res.status(201).json({ status: "ok", activity: serializeActivity(activity) });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* GET /api/activities — recent activities in the user's scope. */
router.get("/activities", async (req, res) => {
  try {
    if (!canViewCare(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem hoạt động chăm sóc." });
      return;
    }
    const prisma: any = getPrisma();
    const { page, pageSize } = parsePagination(req);
    const where: Record<string, unknown> = {};
    if (!canViewAllCare(req)) {
      where.OR = [
        { createdById: req.user!.id },
        { customer: { OR: [{ createdById: req.user!.id }, { assignedToId: req.user!.id }] } },
      ];
    }
    const type = String(req.query.type ?? "");
    if (type) where.type = type;
    if (req.query.createdById) where.createdById = String(req.query.createdById);
    if (req.query.customerId) where.customerId = String(req.query.customerId);
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    if (from.error || to.error) {
      res.status(400).json({ status: "error", message: from.error ?? to.error });
      return;
    }
    if (from.date || to.date) {
      where.performedAt = {
        ...(from.date ? { gte: from.date } : {}),
        ...(to.date ? { lte: to.date } : {}),
      };
    }
    const [total, rows] = await Promise.all([
      prisma.customerActivity.count({ where }),
      prisma.customerActivity.findMany({
        where,
        orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: { select: { fullName: true } }, createdBy: { select: { fullName: true } } },
      }),
    ]);
    res.json({
      status: "ok",
      activities: rows.map(serializeActivity),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* Reminders                                                           */
/* ------------------------------------------------------------------ */

async function loadReminderForWrite(prisma: any, id: string, req: AnyReq) {
  const reminder = await prisma.reminder.findUnique({
    where: { id },
    include: { customer: { select: { fullName: true } }, createdBy: { select: { fullName: true } }, assignedTo: { select: { fullName: true } } },
  });
  if (!reminder || reminder.deletedAt) return { error: 404 as const, reminder: null };
  if (!reminderInScope(reminder, req)) return { error: 403 as const, reminder: null };
  return { error: null, reminder };
}

/* GET /api/reminders */
router.get("/reminders", async (req, res) => {
  try {
    if (!canViewReminders(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem nhắc việc." });
      return;
    }
    const prisma: any = getPrisma();
    const { page, pageSize } = parsePagination(req);
    const now = new Date();
    const group = String(req.query.timeGroup ?? req.query.group ?? "all") as ReminderTimeGroup;
    const validGroups: ReminderTimeGroup[] = ["all", "overdue", "due_today", "upcoming", "done", "cancelled"];
    if (!validGroups.includes(group)) {
      res.status(400).json({ status: "error", message: `timeGroup không hợp lệ. Cho phép: ${validGroups.join(", ")}.` });
      return;
    }
    const upcomingDays = Math.max(1, Math.min(90, parseInt(String(req.query.days ?? "7"), 10) || 7));
    const where: Record<string, unknown> = { deletedAt: null };
    if (!canViewAllReminders(req)) {
      where.OR = [{ createdById: req.user!.id }, { assignedToId: req.user!.id }];
    }
    if (req.query.assignedToId) where.assignedToId = String(req.query.assignedToId);
    if (req.query.customerId) where.customerId = String(req.query.customerId);
    const statusParam = String(req.query.status ?? "");
    if (statusParam) {
      if (!["pending", "completed", "cancelled"].includes(statusParam)) {
        res.status(400).json({ status: "error", message: "status không hợp lệ (pending/completed/cancelled)." });
        return;
      }
      where.status = statusParam;
    }
    const q = String(req.query.q ?? "").trim();
    if (q) where.title = { contains: q, mode: "insensitive" };
    // Time groups are derived, so filter in memory for those groups.
    const needsInMemory = group === "overdue" || group === "due_today" || group === "upcoming";
    const rows = await prisma.reminder.findMany({
      where: needsInMemory ? { ...where, status: "pending" } : where,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      ...(needsInMemory ? { take: 1000 } : { skip: (page - 1) * pageSize, take: pageSize }),
      include: {
        customer: { select: { fullName: true } },
        createdBy: { select: { fullName: true } },
        assignedTo: { select: { fullName: true } },
        order: { select: { orderCode: true } },
      },
    });
    const filtered = needsInMemory ? rows.filter((r: any) => matchesTimeGroup(r.status, new Date(r.dueAt), group, now, upcomingDays)) : rows;
    const total = needsInMemory ? filtered.length : await prisma.reminder.count({ where });
    const pageRows = needsInMemory ? filtered.slice((page - 1) * pageSize, page * pageSize) : filtered;
    res.json({
      status: "ok",
      reminders: pageRows.map(serializeReminder),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* POST /api/reminders */
router.post("/reminders", authorize("reminder.create"), async (req, res) => {
  try {
    const prisma: any = getPrisma();
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.title !== "string" || !body.title.trim()) {
      res.status(400).json({ status: "error", message: "Tiêu đề nhắc việc là bắt buộc." });
      return;
    }
    const due = parseDate(body.dueAt);
    if (due.error || !due.date) {
      res.status(400).json({ status: "error", message: due.error ?? "Hạn nhắc việc (dueAt) là bắt buộc." });
      return;
    }
    if (!isValidReminderType(body.type)) {
      res.status(400).json({ status: "error", message: "Loại nhắc việc không hợp lệ." });
      return;
    }
    let customer: any = null;
    if (body.customerId) {
      customer = await prisma.customer.findUnique({ where: { id: String(body.customerId) } });
      if (!customer || customer.deletedAt) {
        res.status(404).json({ status: "error", message: "Không tìm thấy khách hàng." });
        return;
      }
      if (!customerInScope(customer, req)) {
        res.status(403).json({ status: "error", message: "Bạn không có quyền tạo nhắc việc cho khách hàng này." });
        return;
      }
    }
    if (body.orderId) {
      const order = await prisma.order.findUnique({ where: { id: String(body.orderId) } });
      if (!order || order.deletedAt) {
        res.status(404).json({ status: "error", message: "Không tìm thấy đơn hàng." });
        return;
      }
      if (customer && order.customerId !== customer.id) {
        res.status(400).json({ status: "error", message: "Đơn hàng không thuộc khách hàng đã chọn." });
        return;
      }
    }
    const assignedToId = typeof body.assignedToId === "string" && body.assignedToId.trim() ? body.assignedToId.trim() : req.user!.id;
    if (assignedToId !== req.user!.id && !canAssignOthers(req)) {
      res.status(403).json({ status: "error", message: "Bạn chỉ được tạo nhắc việc cho chính mình." });
      return;
    }
    if (assignedToId !== req.user!.id) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!assignee || assignee.deletedAt) {
        res.status(404).json({ status: "error", message: "Không tìm thấy người được giao." });
        return;
      }
    }
    const reminder = await prisma.reminder.create({
      data: {
        title: String(body.title).trim(),
        description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
        type: typeof body.type === "string" && body.type.trim() ? body.type.trim() : null,
        customerId: customer ? customer.id : null,
        orderId: typeof body.orderId === "string" && body.orderId.trim() ? body.orderId.trim() : null,
        dueAt: due.date,
        assignedToId,
        createdById: req.user!.id,
        status: "pending",
      },
      include: {
        customer: { select: { fullName: true } },
        createdBy: { select: { fullName: true } },
        assignedTo: { select: { fullName: true } },
        order: { select: { orderCode: true } },
      },
    });
    await writeAudit(prisma, { actorId: req.user!.id, action: "reminder.create", entityType: "reminder", entityId: reminder.id, newValue: { title: reminder.title, dueAt: reminder.dueAt }, ipAddress: req.ip ?? null });
    res.status(201).json({ status: "ok", reminder: serializeReminder(reminder) });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* PATCH /api/reminders/:id — pending only. */
router.patch("/reminders/:id", authorize("reminder.update"), async (req, res) => {
  try {
    const prisma: any = getPrisma();
    const { error, reminder } = await loadReminderForWrite(prisma, req.params.id, req);
    if (error) {
      res.status(error).json({ status: "error", message: error === 404 ? "Không tìm thấy nhắc việc." : "Bạn không có quyền sửa nhắc việc này." });
      return;
    }
    if (reminder.status !== "pending") {
      res.status(409).json({ status: "error", message: "Chỉ sửa được nhắc việc đang chờ (pending)." });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        res.status(400).json({ status: "error", message: "Tiêu đề không được để trống." });
        return;
      }
      data.title = body.title.trim();
    }
    if (body.description !== undefined) data.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
    if (body.type !== undefined) {
      if (!isValidReminderType(body.type)) {
        res.status(400).json({ status: "error", message: "Loại nhắc việc không hợp lệ." });
        return;
      }
      data.type = typeof body.type === "string" && body.type.trim() ? body.type.trim() : null;
    }
    if (body.dueAt !== undefined) {
      const due = parseDate(body.dueAt);
      if (due.error || !due.date) {
        res.status(400).json({ status: "error", message: due.error ?? "Hạn nhắc việc không hợp lệ." });
        return;
      }
      data.dueAt = due.date;
    }
    if (body.assignedToId !== undefined) {
      const nextAssignee = typeof body.assignedToId === "string" && body.assignedToId.trim() ? body.assignedToId.trim() : req.user!.id;
      if (nextAssignee !== req.user!.id && nextAssignee !== reminder.assignedToId && !canAssignOthers(req)) {
        res.status(403).json({ status: "error", message: "Bạn chỉ được giao nhắc việc cho chính mình." });
        return;
      }
      data.assignedToId = nextAssignee;
    }
    const updated = await prisma.reminder.update({
      where: { id: reminder.id },
      data,
      include: {
        customer: { select: { fullName: true } },
        createdBy: { select: { fullName: true } },
        assignedTo: { select: { fullName: true } },
        order: { select: { orderCode: true } },
      },
    });
    await writeAudit(prisma, { actorId: req.user!.id, action: "reminder.update", entityType: "reminder", entityId: updated.id, oldValue: { title: reminder.title, dueAt: reminder.dueAt }, newValue: { title: updated.title, dueAt: updated.dueAt }, ipAddress: req.ip ?? null });
    res.json({ status: "ok", reminder: serializeReminder(updated) });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* POST /api/reminders/:id/complete */
router.post("/reminders/:id/complete", authorize("reminder.complete"), async (req, res) => {
  try {
    const prisma: any = getPrisma();
    const { error, reminder } = await loadReminderForWrite(prisma, req.params.id, req);
    if (error) {
      res.status(error).json({ status: "error", message: error === 404 ? "Không tìm thấy nhắc việc." : "Bạn không có quyền hoàn thành nhắc việc này." });
      return;
    }
    if (reminder.status !== "pending") {
      res.status(409).json({ status: "error", message: "Chỉ hoàn thành được nhắc việc đang chờ (pending)." });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const updated = await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        completedById: req.user!.id,
        completionNote: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
      },
      include: {
        customer: { select: { fullName: true } },
        createdBy: { select: { fullName: true } },
        assignedTo: { select: { fullName: true } },
        order: { select: { orderCode: true } },
      },
    });
    await writeAudit(prisma, { actorId: req.user!.id, action: "reminder.complete", entityType: "reminder", entityId: updated.id, ipAddress: req.ip ?? null });
    res.json({ status: "ok", reminder: serializeReminder(updated) });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* POST /api/reminders/:id/cancel */
router.post("/reminders/:id/cancel", authorize("reminder.cancel"), async (req, res) => {
  try {
    const prisma: any = getPrisma();
    const { error, reminder } = await loadReminderForWrite(prisma, req.params.id, req);
    if (error) {
      res.status(error).json({ status: "error", message: error === 404 ? "Không tìm thấy nhắc việc." : "Bạn không có quyền hủy nhắc việc này." });
      return;
    }
    if (reminder.status !== "pending") {
      res.status(409).json({ status: "error", message: "Chỉ hủy được nhắc việc đang chờ (pending). Nhắc việc đã xong/hủy không hoàn thành hay hủy lại được." });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const updated = await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        status: "cancelled",
        cancelReason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null,
      },
      include: {
        customer: { select: { fullName: true } },
        createdBy: { select: { fullName: true } },
        assignedTo: { select: { fullName: true } },
        order: { select: { orderCode: true } },
      },
    });
    await writeAudit(prisma, { actorId: req.user!.id, action: "reminder.cancel", entityType: "reminder", entityId: updated.id, ipAddress: req.ip ?? null });
    res.json({ status: "ok", reminder: serializeReminder(updated) });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* Segments — computed live, never stored, never sent                  */
/* ------------------------------------------------------------------ */

interface SegmentCustomerRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  reason: string;
  totalGrand: number;
  totalDebt: number;
  lastPurchaseAt: Date | null;
}

async function loadSegmentBase(prisma: any, req: AnyReq) {
  // Only active, non-deleted customers. Children: non-deleted only.
  // Orders: committed (confirmed/completed) only — same rule as debt.
  return prisma.customer.findMany({
    where: { status: "active", deletedAt: null, ...customerScopeWhere(req) },
    select: {
      id: true,
      fullName: true,
      email: true,
      dateOfBirth: true,
      createdAt: true,
      phones: { where: { status: "active" }, select: { phone: true, isPrimary: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1 },
      children: { where: { deletedAt: null }, select: { id: true, fullName: true, dateOfBirth: true } },
      tagLinks: { select: { tagId: true, tag: { select: { name: true } } } },
      orders: {
        where: { status: { in: ["confirmed", "completed"] }, deletedAt: null },
        select: { grandTotal: true, debtTotal: true, createdAt: true },
      },
    },
  });
}

function toRow(c: any, reason: string): SegmentCustomerRow {
  const orders = (c.orders ?? []).map((o: any) => ({
    status: "confirmed",
    grandTotal: Number(o.grandTotal ?? 0),
    debtTotal: Number(o.debtTotal ?? 0),
    createdAt: new Date(o.createdAt),
  }));
  // totalGrand/totalDebt helpers re-filter by committed status; the query
  // already restricted to committed orders, so totals are exact here.
  const grand = orders.reduce((s: number, o: any) => s + o.grandTotal, 0);
  const debt = orders.reduce((s: number, o: any) => s + o.debtTotal, 0);
  const last = orders.length > 0 ? orders.reduce((m: Date, o: any) => (o.createdAt > m ? o.createdAt : m), orders[0].createdAt) : null;
  return {
    id: c.id,
    fullName: c.fullName,
    email: c.email ?? null,
    phone: c.phones?.[0]?.phone ?? null,
    createdAt: c.createdAt,
    reason,
    totalGrand: grand,
    totalDebt: debt,
    lastPurchaseAt: last,
  };
}

function fmtDate(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/* GET /api/segments — definitions with live counts. */
router.get("/segments", authorize("segment.view"), async (req, res) => {
  try {
    const prisma: any = getPrisma();
    const now = new Date();
    const days = Math.max(1, Math.min(365, parseInt(String(req.query.days ?? "7"), 10) || 7));
    const customers = await loadSegmentBase(prisma, req);
    const tagId = String(req.query.tagId ?? "");
    const counts: Record<string, number | null> = {};
    counts.birthday_customers = customers.filter((c: any) => c.dateOfBirth && isBirthdayWithin(new Date(c.dateOfBirth), now, days)).length;
    counts.birthday_children = customers.reduce((sum: number, c: any) => sum + (c.children ?? []).filter((ch: any) => ch.dateOfBirth && isBirthdayWithin(new Date(ch.dateOfBirth), now, days)).length, 0);
    const inactiveDays = Math.max(1, Math.min(3650, parseInt(String(req.query.inactiveDays ?? "90"), 10) || 90));
    counts.inactive_customers = customers.filter((c: any) => {
      const orders = (c.orders ?? []).map((o: any) => ({ status: "confirmed", grandTotal: Number(o.grandTotal ?? 0), debtTotal: Number(o.debtTotal ?? 0), createdAt: new Date(o.createdAt) }));
      return isInactiveCustomer(orders, now, inactiveDays);
    }).length;
    counts.new_customers = customers.filter((c: any) => isNewCustomer(new Date(c.createdAt), now, 30)).length;
    counts.no_purchase_customers = customers.filter((c: any) => (c.orders ?? []).length === 0).length;
    counts.debt_customers = customers.filter((c: any) => totalDebt((c.orders ?? []).map((o: any) => ({ status: "confirmed", grandTotal: Number(o.grandTotal ?? 0), debtTotal: Number(o.debtTotal ?? 0), createdAt: new Date(o.createdAt) }))) > 0).length;
    counts.high_value_customers = customers.filter((c: any) => totalGrand((c.orders ?? []).map((o: any) => ({ status: "confirmed", grandTotal: Number(o.grandTotal ?? 0), debtTotal: Number(o.debtTotal ?? 0), createdAt: new Date(o.createdAt) }))) >= 5000000).length;
    counts.by_tag = tagId ? customers.filter((c: any) => (c.tagLinks ?? []).some((t: any) => t.tagId === tagId)).length : null;
    res.json({
      status: "ok",
      segments: SEGMENT_DEFINITIONS.map((d) => ({
        key: d.key,
        name: d.name,
        description: d.description,
        count: counts[d.key] ?? null,
        note: d.key === "by_tag" && !tagId ? "Cần tham số tagId để đếm phân đoạn này." : "Số lượng tính trực tiếp, không lưu sẵn. Phân đoạn không tự gửi tin.",
      })),
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* GET /api/segments/:key/customers */
router.get("/segments/:key/customers", authorize("segment.view"), async (req, res) => {
  try {
    const key = req.params.key;
    if (!isSegmentKey(key)) {
      res.status(400).json({ status: "error", message: `Phân đoạn không hợp lệ. Cho phép: ${SEGMENT_DEFINITIONS.map((d) => d.key).join(", ")}.` });
      return;
    }
    const prisma: any = getPrisma();
    const { page, pageSize } = parsePagination(req);
    const now = new Date();
    const days = Math.max(1, Math.min(365, parseInt(String(req.query.days ?? "7"), 10) || 7));
    const threshold = Math.max(0, parseInt(String(req.query.threshold ?? "5000000"), 10) || 5000000);
    const tagId = String(req.query.tagId ?? "");
    if (key === "by_tag" && !tagId) {
      res.status(400).json({ status: "error", message: "Phân đoạn by_tag cần tham số tagId." });
      return;
    }
    const customers = await loadSegmentBase(prisma, req);
    const toOrders = (c: any) => (c.orders ?? []).map((o: any) => ({ status: "confirmed", grandTotal: Number(o.grandTotal ?? 0), debtTotal: Number(o.debtTotal ?? 0), createdAt: new Date(o.createdAt) }));

    if (key === "birthday_children") {
      const rows: any[] = [];
      for (const c of customers) {
        for (const ch of c.children ?? []) {
          if (!ch.dateOfBirth) continue;
          if (!isBirthdayWithin(new Date(ch.dateOfBirth), now, days)) continue;
          const next = nextBirthday(new Date(ch.dateOfBirth), now);
          rows.push({
            childId: ch.id,
            childName: ch.fullName,
            customerId: c.id,
            customerName: c.fullName,
            customerPhone: c.phones?.[0]?.phone ?? null,
            nextBirthday: next.date.toISOString().slice(0, 10),
            upcomingAge: next.upcomingAge,
            reason: `Sinh nhật bé ${ch.fullName} sắp tới: ${fmtDate(next.date)} (${next.upcomingAge} tuổi).`,
          });
        }
      }
      rows.sort((a, b) => (a.nextBirthday < b.nextBirthday ? -1 : 1));
      const total = rows.length;
      res.json({ status: "ok", segment: key, items: rows.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
      return;
    }

    let rows: SegmentCustomerRow[] = [];
    if (key === "birthday_customers") {
      rows = customers
        .filter((c: any) => c.dateOfBirth && isBirthdayWithin(new Date(c.dateOfBirth), now, days))
        .map((c: any) => {
          const next = nextBirthday(new Date(c.dateOfBirth), now);
          return toRow(c, `Sinh nhật sắp tới: ${fmtDate(next.date)} (${next.upcomingAge} tuổi).`);
        });
    } else if (key === "inactive_customers") {
      const inactiveDays = Math.max(1, Math.min(3650, parseInt(String(req.query.inactiveDays ?? "90"), 10) || 90));
      rows = customers
        .filter((c: any) => isInactiveCustomer(toOrders(c), now, inactiveDays))
        .map((c: any) => {
          const r = toRow(c, "");
          return { ...r, reason: r.lastPurchaseAt ? `Lần mua cuối: ${fmtDate(r.lastPurchaseAt)}.` : "Chưa từng mua." };
        });
    } else if (key === "new_customers") {
      rows = customers
        .filter((c: any) => isNewCustomer(new Date(c.createdAt), now, 30))
        .map((c: any) => toRow(c, `Khách tạo ngày ${fmtDate(new Date(c.createdAt))}.`));
    } else if (key === "no_purchase_customers") {
      rows = customers
        .filter((c: any) => (c.orders ?? []).length === 0)
        .map((c: any) => toRow(c, "Chưa từng có đơn confirmed/completed nào."));
    } else if (key === "debt_customers") {
      rows = customers
        .filter((c: any) => totalDebt(toOrders(c)) > 0)
        .map((c: any) => {
          const r = toRow(c, "");
          return { ...r, reason: `Tổng công nợ: ${r.totalDebt.toLocaleString("vi-VN")} (chỉ đơn confirmed/completed).` };
        });
    } else if (key === "high_value_customers") {
      rows = customers
        .filter((c: any) => totalGrand(toOrders(c)) >= threshold)
        .map((c: any) => {
          const r = toRow(c, "");
          return { ...r, reason: `Tổng tiền đơn confirmed/completed: ${r.totalGrand.toLocaleString("vi-VN")} (>= ${threshold.toLocaleString("vi-VN")}).` };
        });
    } else if (key === "by_tag") {
      rows = customers
        .filter((c: any) => (c.tagLinks ?? []).some((t: any) => t.tagId === tagId))
        .map((c: any) => {
          const tag = (c.tagLinks ?? []).find((t: any) => t.tagId === tagId);
          return toRow(c, `Có tag: ${tag?.tag?.name ?? tagId}.`);
        });
    }
    const total = rows.length;
    res.json({ status: "ok", segment: key, items: rows.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

export default router;
