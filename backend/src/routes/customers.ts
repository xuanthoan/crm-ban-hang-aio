/**
 * Customer API — Sprint Customer.
 *
 * Reuses Sprint Auth: authenticate() + authorize() middleware, never a
 * second auth mechanism. Frontend hiding is never a substitute (locked
 * rules §6). All duplicate-phone, normalization and permission checks
 * run again on the backend, even if the frontend already checked them.
 *
 * Locked rules applied here:
 *  §4.1 unlimited phones via CustomerPhone, exactly one primary,
 *       duplicate check across ALL phones (other customers + within
 *       the same request), whole operation blocked on a match.
 *  §5   no hard delete of data with transactions: DELETE soft-deletes
 *       (status inactive + deletedAt); hard delete only when the
 *       customer has NO related data at all, only Admin, audited.
 *  §6   backend permission + data-scope checks on every route.
 *
 * Data scope: customer.view_all sees all customers. customer.view_own
 * sees only customers the user created or is assigned to (createdById /
 * assignedToId). There is no team entity in MVP, so a "team" scope
 * cannot be enforced yet — see DEVELOPMENT_PLAN.md.
 */

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import {
  ageYears,
  duplicateErrorMessage,
  findDuplicatePhone,
  isValidPhoneNormalized,
  normalizePhone,
  normalizePhoneList,
} from "../lib/customers";
import { getPrisma } from "../lib/prisma";

const router = Router();
router.use(authenticate);

function dbUnavailable(res: import("express").Response, err: unknown) {
  console.error("[customers] database error:", err);
  res.status(503).json({
    status: "error",
    message: "Chưa kết nối được database. Hãy chạy PostgreSQL (docker compose up -d postgres) rồi thử lại.",
  });
}

function isPrismaUniqueError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

function canViewAll(req: import("express").Request): boolean {
  return req.user!.permissions.includes("customer.view_all");
}

function canView(req: import("express").Request): boolean {
  return canViewAll(req) || req.user!.permissions.includes("customer.view_own");
}

function scopeWhere(req: import("express").Request): Record<string, unknown> {
  if (canViewAll(req)) return {};
  return { OR: [{ createdById: req.user!.id }, { assignedToId: req.user!.id }] };
}

function inScope(customer: { createdById: string | null; assignedToId: string | null }, req: import("express").Request): boolean {
  if (canViewAll(req)) return true;
  return customer.createdById === req.user!.id || customer.assignedToId === req.user!.id;
}

function parsePagination(req: import("express").Request): { page: number; pageSize: number } {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
  return { page, pageSize };
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseDate(value: unknown): { date: Date | null; error?: string } {
  if (value === undefined || value === null || value === "") return { date: null };
  if (typeof value !== "string") return { date: null, error: "Ngày phải là chuỗi ISO (YYYY-MM-DD)." };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: null, error: `Ngày "${value}" không hợp lệ.` };
  return { date: d };
}

interface ChildInput {
  id?: string;
  fullName: string;
  dateOfBirth: Date | null;
  gender: string | null;
  note: string | null;
}

function validateChildren(children: unknown): { children: ChildInput[]; error?: string } {
  if (!Array.isArray(children)) return { children: [], error: "children phải là một danh sách." };
  const out: ChildInput[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const item of children) {
    if (!item || typeof item !== "object") return { children: [], error: "Mỗi con phải là một đối tượng." };
    const c = item as Record<string, unknown>;
    if (typeof c.fullName !== "string" || !c.fullName.trim()) {
      return { children: [], error: "Tên con không được để trống." };
    }
    const dob = parseDate(c.dateOfBirth);
    if (dob.error) return { children: [], error: dob.error };
    if (dob.date && dob.date > today) {
      return { children: [], error: `Ngày sinh của bé "${String(c.fullName).trim()}" không được là ngày tương lai.` };
    }
    out.push({
      ...(typeof c.id === "string" ? { id: c.id } : {}),
      fullName: String(c.fullName).trim(),
      dateOfBirth: dob.date,
      gender: typeof c.gender === "string" && c.gender.trim() ? c.gender.trim() : null,
      note: typeof c.note === "string" && c.note.trim() ? c.note.trim() : null,
    });
  }
  return { children: out };
}

function serializeListCustomer(c: any) {
  const phones = (c.phones ?? []).filter((p: any) => p.status === "active" && !p.deletedAt);
  const primary = phones.find((p: any) => p.isPrimary) ?? phones[0] ?? null;
  return {
    id: c.id,
    fullName: c.fullName,
    gender: c.gender,
    dateOfBirth: c.dateOfBirth,
    address: c.address,
    email: c.email,
    note: c.note,
    source: c.source,
    status: c.status,
    primaryPhone: primary ? primary.phone : null,
    primaryPhoneNormalized: primary ? primary.phoneNormalized : null,
    phoneCount: phones.length,
    tags: (c.tagLinks ?? []).map((l: any) => ({ id: l.tag.id, name: l.tag.name, color: l.tag.color ?? null })),
    // Prefer the (already soft-delete-filtered) children array over
    // _count, because _count would also count soft-deleted children.
    childrenCount: Array.isArray(c.children) ? c.children.length : (c._count?.children ?? 0),
    createdById: c.createdById,
    assignedToId: c.assignedToId,
    createdByName: c.createdBy?.fullName ?? null,
    assignedToName: c.assignedTo?.fullName ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function serializeDetailCustomer(c: any) {
  const phones = (c.phones ?? [])
    .filter((p: any) => p.status === "active" && !p.deletedAt)
    .sort((a: any, b: any) => Number(b.isPrimary) - Number(a.isPrimary));
  return {
    ...serializeListCustomer(c),
    phones: phones.map((p: any) => ({
      id: p.id,
      phone: p.phone,
      phoneNormalized: p.phoneNormalized,
      isPrimary: p.isPrimary,
      label: p.label,
      status: p.status,
      createdAt: p.createdAt,
    })),
    children: (c.children ?? []).map((ch: any) => ({
      id: ch.id,
      fullName: ch.fullName,
      dateOfBirth: ch.dateOfBirth,
      ageYears: ageYears(ch.dateOfBirth),
      gender: ch.gender,
      note: ch.note,
      sortOrder: ch.sortOrder,
      createdAt: ch.createdAt,
    })),
    // Orders / payments do not exist yet in this sprint. They are
    // deliberately empty with an explicit note — never faked numbers.
    orders: [],
    payments: [],
    debtTotal: null,
    ordersNote: "Sẽ có ở Sprint Đơn hàng/Thanh toán.",
  };
}

async function loadCustomerForScope(prisma: ReturnType<typeof getPrisma>, id: string) {
  return prisma.customer.findUnique({
    where: { id, deletedAt: null },
    include: {
      phones: { where: { status: "active", deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      tagLinks: { include: { tag: true } },
      children: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      createdBy: { select: { id: true, fullName: true, username: true } },
      assignedTo: { select: { id: true, fullName: true, username: true } },
      _count: { select: { orders: true, payments: true, activities: true, reminders: true } },
    },
  });
}

/* ------------------------------------------------------------------ */
/* Tags                                                                */
/* ------------------------------------------------------------------ */

/** GET /api/tags — list tags (customer viewers only). */
router.get("/tags", async (req, res) => {
  try {
    if (!canView(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem khách hàng." });
      return;
    }
    const prisma = getPrisma();
    const { page, pageSize } = parsePagination(req);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const where: Record<string, unknown> = {
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };
    const [total, tags] = await Promise.all([
      prisma.customerTag.count({ where }),
      prisma.customerTag.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { customerLinks: true } } },
      }),
    ]);
    res.json({
      status: "ok",
      data: tags.map((t: any) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        description: t.description,
        customerCount: t._count.customerLinks,
        createdAt: t.createdAt,
      })),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** POST /api/tags — Admin/Manager (customer.tag_manage). */
router.post("/tags", authorize("customer.tag_manage"), async (req, res) => {
  try {
    const { name, color, description } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ status: "error", message: "Tên tag không được để trống." });
      return;
    }
    const prisma = getPrisma();
    const existing = await prisma.customerTag.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" } },
    });
    if (existing && !existing.deletedAt) {
      res.status(409).json({ status: "error", message: `Tag "${existing.name}" đã tồn tại.` });
      return;
    }
    let tag;
    if (existing) {
      tag = await prisma.customerTag.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          color: typeof color === "string" ? color : existing.color,
          description: typeof description === "string" ? description : existing.description,
        },
      });
    } else {
      tag = await prisma.customerTag.create({
        data: {
          name: name.trim(),
          color: typeof color === "string" ? color : null,
          description: typeof description === "string" ? description : null,
        },
      });
    }
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "tag_created",
      entityType: "customer_tag",
      entityId: tag.id,
      newValue: { name: tag.name },
      ipAddress: req.ip ?? null,
    });
    res.status(201).json({ status: "ok", tag });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** PATCH /api/tags/:id — rename / recolor a tag. */
router.patch("/tags/:id", authorize("customer.tag_manage"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const tag = await prisma.customerTag.findUnique({ where: { id: req.params.id } });
    if (!tag || tag.deletedAt) {
      res.status(404).json({ status: "error", message: "Tag không tồn tại." });
      return;
    }
    const { name, color, description } = req.body ?? {};
    if (typeof name === "string" && name.trim() && name.trim().toLowerCase() !== tag.name.toLowerCase()) {
      const clash = await prisma.customerTag.findFirst({
        where: { name: { equals: name.trim(), mode: "insensitive" }, deletedAt: null, id: { not: tag.id } },
      });
      if (clash) {
        res.status(409).json({ status: "error", message: `Tag "${clash.name}" đã tồn tại.` });
        return;
      }
    }
    const updated = await prisma.customerTag.update({
      where: { id: tag.id },
      data: {
        ...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
        ...(typeof color === "string" ? { color } : {}),
        ...(typeof description === "string" ? { description } : {}),
      },
    });
    // Sprint Audit supplement: tag edits were previously the only
    // tag operation without an audit row (create/deactivate had one).
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "tag_updated",
      entityType: "customer_tag",
      entityId: tag.id,
      oldValue: { name: tag.name, color: tag.color, description: tag.description },
      newValue: { name: updated.name, color: updated.color, description: updated.description },
      ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", tag: updated });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** DELETE /api/tags/:id — soft-delete (deactivate), never hard-delete in use. */
router.delete("/tags/:id", authorize("customer.tag_manage"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const tag = await prisma.customerTag.findUnique({ where: { id: req.params.id } });
    if (!tag || tag.deletedAt) {
      res.status(404).json({ status: "error", message: "Tag không tồn tại." });
      return;
    }
    await prisma.customerTag.update({ where: { id: tag.id }, data: { deletedAt: new Date() } });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "tag_deactivated",
      entityType: "customer_tag",
      entityId: tag.id,
      oldValue: { name: tag.name },
      ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", message: "Đã ngừng hoạt động tag." });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* Customers — list / detail                                           */
/* ------------------------------------------------------------------ */

/** GET /api/customers — paginated, searchable by name or ANY phone. */
router.get("/customers", async (req, res) => {
  try {
    if (!canView(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem khách hàng." });
      return;
    }
    const prisma = getPrisma();
    const { page, pageSize } = parsePagination(req);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const source = typeof req.query.source === "string" ? req.query.source.trim() : "";
    const createdFrom = typeof req.query.createdFrom === "string" ? new Date(req.query.createdFrom) : null;
    const createdTo = typeof req.query.createdTo === "string" ? new Date(req.query.createdTo) : null;

    // Tag filter: ?tagId=<id> (or ?tag=<id-or-name> as a convenience).
    let tagId: string | null = typeof req.query.tagId === "string" && req.query.tagId ? req.query.tagId : null;
    if (!tagId && typeof req.query.tag === "string" && req.query.tag) {
      const byId = await prisma.customerTag.findUnique({ where: { id: req.query.tag } }).catch(() => null);
      if (byId) tagId = byId.id;
      else {
        const byName = await prisma.customerTag.findFirst({
          where: { name: { equals: req.query.tag, mode: "insensitive" }, deletedAt: null },
        });
        if (byName) tagId = byName.id;
      }
    }

    const and: Record<string, unknown>[] = [{ deletedAt: null }, scopeWhere(req)];
    if (q) {
      const normalizedQ = normalizePhone(q);
      const looksLikePhone = /[\d+][\d\s.\-()]*\d/.test(q) && normalizedQ.replace(/\D/g, "").length >= 3;
      and.push({
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          // Search by ANY phone, normalized the same way as stored phones,
          // so "0987 884 244", "098-788-4244" and "+84987884244" all match.
          ...(looksLikePhone
            ? [{ phones: { some: { phoneNormalized: { contains: normalizePhone(q).replace(/^\+84/, "0") }, status: "active", deletedAt: null } } }]
            : []),
        ],
      });
    }
    if (status === "active" || status === "inactive") and.push({ status });
    if (source) and.push({ source: { contains: source, mode: "insensitive" } });
    if (createdFrom && !Number.isNaN(createdFrom.getTime())) and.push({ createdAt: { gte: createdFrom } });
    if (createdTo && !Number.isNaN(createdTo.getTime())) and.push({ createdAt: { lte: createdTo } });
    if (tagId) and.push({ tagLinks: { some: { tagId, tag: { deletedAt: null } } } });

    const where = { AND: and };
    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          phones: { where: { status: "active", deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
          tagLinks: { include: { tag: true } },
          createdBy: { select: { fullName: true } },
          assignedTo: { select: { fullName: true } },
          children: { where: { deletedAt: null }, select: { id: true } },
        },
      }),
    ]);
    res.json({
      status: "ok",
      data: customers.map((c: any) => serializeListCustomer({ ...c, tagLinks: c.tagLinks.filter((l: any) => !l.tag.deletedAt) })),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** GET /api/customers/:id — 360 profile (orders/payments empty for now). */
router.get("/customers/:id", async (req, res) => {
  try {
    if (!canView(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem khách hàng." });
      return;
    }
    const prisma = getPrisma();
    const customer = await loadCustomerForScope(prisma, req.params.id);
    if (!customer) {
      res.status(404).json({ status: "error", message: "Khách hàng không tồn tại." });
      return;
    }
    if (!inScope(customer, req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem khách hàng này." });
      return;
    }
    res.json({
      status: "ok",
      customer: serializeDetailCustomer({ ...customer, tagLinks: customer.tagLinks.filter((l: any) => !l.tag.deletedAt) }),
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* Customers — create / update                                         */
/* ------------------------------------------------------------------ */

async function validateTags(prisma: ReturnType<typeof getPrisma>, tagIds: unknown): Promise<{ ids: string[]; error?: string }> {
  if (tagIds === undefined) return { ids: [] };
  if (!Array.isArray(tagIds) || tagIds.some((t) => typeof t !== "string")) {
    return { ids: [], error: "tagIds phải là danh sách id của tag." };
  }
  const unique = [...new Set(tagIds)];
  if (unique.length === 0) return { ids: [] };
  const found = await prisma.customerTag.findMany({ where: { id: { in: unique }, deletedAt: null } });
  if (found.length !== unique.length) {
    return { ids: [], error: "Có tag không tồn tại hoặc đã ngừng hoạt động." };
  }
  return { ids: unique };
}

/** POST /api/customers — create customer + phones + tags + children in one transaction. */
router.post("/customers", authorize("customer.create"), async (req, res) => {
  try {
    const { fullName, gender, dateOfBirth, address, email, note, source, status, assignedToId, phones, tagIds, children } = req.body ?? {};
    const name = typeof fullName === "string" ? fullName.trim() : "";
    const phoneList = phones === undefined ? [] : phones;
    const normalized = normalizePhoneList(phoneList);
    if (normalized.error) {
      res.status(400).json({ status: "error", message: normalized.error });
      return;
    }
    // Docs 01 §6/§13: name OR at least one phone is required.
    if (!name && normalized.phones.length === 0) {
      res.status(400).json({ status: "error", message: "Vui lòng nhập họ tên hoặc số điện thoại khách hàng." });
      return;
    }
    if (email !== undefined && email !== null && email !== "" && (typeof email !== "string" || !validEmail(email.trim()))) {
      res.status(400).json({ status: "error", message: "Email không đúng định dạng." });
      return;
    }
    const dob = parseDate(dateOfBirth);
    if (dob.error) {
      res.status(400).json({ status: "error", message: dob.error });
      return;
    }
    const childList: { children: ChildInput[]; error?: string } =
      children === undefined ? { children: [] } : validateChildren(children);
    if (childList.error) {
      res.status(400).json({ status: "error", message: childList.error });
      return;
    }
    const prisma = getPrisma();
    const tags = await validateTags(prisma, tagIds);
    if (tags.error) {
      res.status(400).json({ status: "error", message: tags.error });
      return;
    }
    // Assignment needs customer.assign unless assigning to oneself.
    let assigneeId: string | null = null;
    if (typeof assignedToId === "string" && assignedToId) {
      if (assignedToId !== req.user!.id && !req.user!.permissions.includes("customer.assign")) {
        res.status(403).json({ status: "error", message: "Bạn không có quyền phân công khách hàng cho người khác." });
        return;
      }
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!assignee || assignee.deletedAt || assignee.status !== "active") {
        res.status(400).json({ status: "error", message: "Người phụ trách không tồn tại hoặc không hoạt động." });
        return;
      }
      assigneeId = assignedToId;
    }
    const conflict = await findDuplicatePhone(
      prisma,
      normalized.phones.map((p) => p.phoneNormalized),
      null,
    );
    if (conflict) {
      res.status(400).json({ status: "error", message: duplicateErrorMessage(conflict), conflict });
      return;
    }
    const created = await prisma.$transaction(async (tx: any) => {
      return tx.customer.create({
        data: {
          fullName: name,
          gender: typeof gender === "string" && gender.trim() ? gender.trim() : null,
          dateOfBirth: dob.date,
          address: typeof address === "string" && address.trim() ? address.trim() : null,
          email: typeof email === "string" && email.trim() ? email.trim() : null,
          note: typeof note === "string" && note.trim() ? note.trim() : null,
          source: typeof source === "string" && source.trim() ? source.trim() : null,
          status: status === "inactive" ? "inactive" : "active",
          createdById: req.user!.id,
          assignedToId: assigneeId,
          phones: {
            create: normalized.phones.map((p) => ({
              phone: p.phone,
              phoneNormalized: p.phoneNormalized,
              label: p.label,
              isPrimary: p.isPrimary,
              status: "active",
            })),
          },
          tagLinks: { create: tags.ids.map((tagId) => ({ tagId })) },
          children: {
            create: childList.children.map((ch, i) => ({
              fullName: ch.fullName,
              dateOfBirth: ch.dateOfBirth,
              gender: ch.gender,
              note: ch.note,
              sortOrder: i,
            })),
          },
        },
        include: {
          phones: { where: { status: "active", deletedAt: null } },
          tagLinks: { include: { tag: true } },
          children: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
          createdBy: { select: { fullName: true } },
          assignedTo: { select: { fullName: true } },
        },
      });
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "customer_created",
      entityType: "customer",
      entityId: created.id,
      newValue: { fullName: created.fullName, phoneCount: normalized.phones.length },
      ipAddress: req.ip ?? null,
    });
    res.status(201).json({ status: "ok", customer: serializeDetailCustomer(created) });
  } catch (err) {
    if (isPrismaUniqueError(err)) {
      res.status(400).json({ status: "error", message: "Số điện thoại này đã tồn tại ở một khách hàng khác. Vui lòng kiểm tra lại." });
      return;
    }
    dbUnavailable(res, err);
  }
});

/** PATCH /api/customers/:id — partial update; phones/tags/children only change when provided. */
router.patch("/customers/:id", authorize("customer.update"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const customer = await loadCustomerForScope(prisma, req.params.id);
    if (!customer) {
      res.status(404).json({ status: "error", message: "Khách hàng không tồn tại." });
      return;
    }
    if (!inScope(customer, req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền sửa khách hàng này." });
      return;
    }
    const { fullName, gender, dateOfBirth, address, email, note, source, status, assignedToId, phones, tagIds, children } = req.body ?? {};

    const name = fullName === undefined ? customer.fullName : typeof fullName === "string" ? fullName.trim() : "";
    const phonesProvided = phones !== undefined;
    const normalized = phonesProvided ? normalizePhoneList(phones) : { phones: [] as ReturnType<typeof normalizePhoneList>["phones"] };
    if (normalized.error) {
      res.status(400).json({ status: "error", message: normalized.error });
      return;
    }
    // Name-or-phone rule on the FINAL state, not just the patch payload.
    const finalPhoneCount = phonesProvided
      ? normalized.phones.length
      : customer.phones.filter((p: any) => p.status === "active" && !p.deletedAt).length;
    if (!name && finalPhoneCount === 0) {
      res.status(400).json({ status: "error", message: "Vui lòng nhập họ tên hoặc số điện thoại khách hàng." });
      return;
    }
    if (email !== undefined && email !== null && email !== "" && (typeof email !== "string" || !validEmail(email.trim()))) {
      res.status(400).json({ status: "error", message: "Email không đúng định dạng." });
      return;
    }
    const dob: { date: Date | null; error?: string } =
      dateOfBirth === undefined ? { date: customer.dateOfBirth } : parseDate(dateOfBirth);
    if (dob.error) {
      res.status(400).json({ status: "error", message: dob.error });
      return;
    }
    const childrenProvided = children !== undefined;
    const childList: { children: ChildInput[]; error?: string } = childrenProvided
      ? validateChildren(children)
      : { children: [] };
    if (childList.error) {
      res.status(400).json({ status: "error", message: childList.error });
      return;
    }
    // Existing child ids in the payload must belong to this customer.
    if (childrenProvided) {
      const existingIds = new Set(customer.children.map((c: any) => c.id));
      for (const ch of childList.children) {
        if (ch.id && !existingIds.has(ch.id)) {
          res.status(400).json({ status: "error", message: "Có con không thuộc khách hàng này." });
          return;
        }
      }
    }
    const tags = tagIds === undefined ? { ids: [] as string[] } : await validateTags(prisma, tagIds);
    if (tags.error) {
      res.status(400).json({ status: "error", message: tags.error });
      return;
    }
    let assigneeId: string | null | undefined = undefined;
    if (assignedToId !== undefined) {
      if (assignedToId === null || assignedToId === "") {
        assigneeId = null;
      } else if (typeof assignedToId === "string") {
        if (assignedToId !== customer.assignedToId && assignedToId !== req.user!.id && !req.user!.permissions.includes("customer.assign")) {
          res.status(403).json({ status: "error", message: "Bạn không có quyền phân công khách hàng cho người khác." });
          return;
        }
        const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
        if (!assignee || assignee.deletedAt || assignee.status !== "active") {
          res.status(400).json({ status: "error", message: "Người phụ trách không tồn tại hoặc không hoạt động." });
          return;
        }
        assigneeId = assignedToId;
      } else {
        res.status(400).json({ status: "error", message: "assignedToId không hợp lệ." });
        return;
      }
    }
    if (phonesProvided) {
      const conflict = await findDuplicatePhone(
        prisma,
        normalized.phones.map((p) => p.phoneNormalized),
        customer.id,
      );
      if (conflict) {
        res.status(400).json({ status: "error", message: duplicateErrorMessage(conflict), conflict });
        return;
      }
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          ...(fullName !== undefined ? { fullName: name } : {}),
          ...(gender !== undefined ? { gender: typeof gender === "string" && gender.trim() ? gender.trim() : null } : {}),
          ...(dateOfBirth !== undefined ? { dateOfBirth: dob.date } : {}),
          ...(address !== undefined ? { address: typeof address === "string" && address.trim() ? address.trim() : null } : {}),
          ...(email !== undefined ? { email: typeof email === "string" && email.trim() ? email.trim() : null } : {}),
          ...(note !== undefined ? { note: typeof note === "string" && note.trim() ? note.trim() : null } : {}),
          ...(source !== undefined ? { source: typeof source === "string" && source.trim() ? source.trim() : null } : {}),
          ...(status === "active" || status === "inactive" ? { status } : {}),
          ...(assigneeId !== undefined ? { assignedToId: assigneeId } : {}),
        },
      });
      if (phonesProvided) {
        const desired = new Map(normalized.phones.map((p) => [p.phoneNormalized, p]));
        const existingActive = await tx.customerPhone.findMany({
          where: { customerId: customer.id, status: "active", deletedAt: null },
        });
        const existingInactive = await tx.customerPhone.findMany({
          where: {
            customerId: customer.id,
            phoneNormalized: { in: [...desired.keys()] },
            OR: [{ status: "inactive" }, { deletedAt: { not: null } }],
          },
        });
        const inactiveByNorm = new Map<string, any>(
          existingInactive.map((p: any) => [p.phoneNormalized, p] as [string, any]),
        );
        for (const old of existingActive) {
          if (!desired.has(old.phoneNormalized)) {
            await tx.customerPhone.update({
              where: { id: old.id },
              data: { status: "inactive", isPrimary: false, deletedAt: new Date() },
            });
          }
        }
        for (const p of normalized.phones) {
          const activeMatch = existingActive.find((o: any) => o.phoneNormalized === p.phoneNormalized);
          if (activeMatch) {
            await tx.customerPhone.update({
              where: { id: activeMatch.id },
              data: { phone: p.phone, label: p.label, isPrimary: p.isPrimary },
            });
          } else if (inactiveByNorm.has(p.phoneNormalized)) {
            const row: any = inactiveByNorm.get(p.phoneNormalized);
            if (row) {
              await tx.customerPhone.update({
                where: { id: row.id },
                data: { phone: p.phone, label: p.label, isPrimary: p.isPrimary, status: "active", deletedAt: null },
              });
            }
          } else {
            await tx.customerPhone.create({
              data: {
                customerId: customer.id,
                phone: p.phone,
                phoneNormalized: p.phoneNormalized,
                label: p.label,
                isPrimary: p.isPrimary,
                status: "active",
              },
            });
          }
        }
      }
      if (childrenProvided) {
        const keepIds = new Set(childList.children.filter((c) => c.id).map((c) => c.id as string));
        for (const old of customer.children) {
          if (!keepIds.has(old.id)) {
            await tx.customerChild.update({ where: { id: old.id }, data: { deletedAt: new Date() } });
          }
        }
        for (let i = 0; i < childList.children.length; i++) {
          const ch = childList.children[i];
          if (ch.id) {
            await tx.customerChild.update({
              where: { id: ch.id },
              data: { fullName: ch.fullName, dateOfBirth: ch.dateOfBirth, gender: ch.gender, note: ch.note, sortOrder: i },
            });
          } else {
            await tx.customerChild.create({
              data: {
                customerId: customer.id,
                fullName: ch.fullName,
                dateOfBirth: ch.dateOfBirth,
                gender: ch.gender,
                note: ch.note,
                sortOrder: i,
              },
            });
          }
        }
      }
      if (tagIds !== undefined) {
        const existingLinks = await tx.customerTagAssignment.findMany({ where: { customerId: customer.id } });
        const existingTagIds = new Set(existingLinks.map((l: any) => l.tagId));
        for (const link of existingLinks) {
          if (!tags.ids.includes(link.tagId)) {
            await tx.customerTagAssignment.delete({ where: { id: link.id } });
          }
        }
        for (const tagId of tags.ids) {
          if (!existingTagIds.has(tagId)) {
            await tx.customerTagAssignment.create({ data: { customerId: customer.id, tagId } });
          }
        }
      }
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "customer_updated",
      entityType: "customer",
      entityId: customer.id,
      newValue: {
        fullName: name,
        ...(phonesProvided ? { phoneCount: normalized.phones.length } : {}),
        ...(childrenProvided ? { childrenCount: childList.children.length } : {}),
        ...(tagIds !== undefined ? { tagCount: tags.ids.length } : {}),
      },
      ipAddress: req.ip ?? null,
    });
    const updated = await loadCustomerForScope(prisma, customer.id);
    res.json({ status: "ok", customer: updated ? serializeDetailCustomer({ ...updated, tagLinks: updated.tagLinks.filter((l: any) => !l.tag.deletedAt) }) : null });
  } catch (err) {
    if (isPrismaUniqueError(err)) {
      res.status(400).json({ status: "error", message: "Số điện thoại này đã tồn tại ở một khách hàng khác. Vui lòng kiểm tra lại." });
      return;
    }
    dbUnavailable(res, err);
  }
});

/** DELETE /api/customers/:id — soft-delete by default; ?hard=true only for Admin with no related data. */
router.delete("/customers/:id", async (req, res) => {
  try {
    const hard = req.query.hard === "true";
    if (hard) {
      if (!req.user!.permissions.includes("customer.hard_delete") || req.user!.role !== "admin") {
        res.status(403).json({ status: "error", message: "Chỉ Admin mới được xóa cứng khách hàng." });
        return;
      }
    } else if (!req.user!.permissions.includes("customer.deactivate")) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền ngừng hoạt động khách hàng." });
      return;
    }
    const prisma = getPrisma();
    const customer = await loadCustomerForScope(prisma, req.params.id);
    if (!customer) {
      res.status(404).json({ status: "error", message: "Khách hàng không tồn tại." });
      return;
    }
    if (!inScope(customer, req) && !canViewAll(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xóa khách hàng này." });
      return;
    }
    if (hard) {
      const related = {
        orders: customer._count.orders,
        payments: customer._count.payments,
        activities: customer._count.activities,
        reminders: customer._count.reminders,
        phones: await prisma.customerPhone.count({ where: { customerId: customer.id } }),
        children: await prisma.customerChild.count({ where: { customerId: customer.id } }),
        tagLinks: await prisma.customerTagAssignment.count({ where: { customerId: customer.id } }),
      };
      const totalRelated = Object.values(related).reduce((a, b) => a + b, 0);
      if (totalRelated > 0) {
        res.status(400).json({
          status: "error",
          message: "Khách hàng này đã có dữ liệu liên quan nên không được xóa cứng. Chỉ được ngừng hoạt động (xóa mềm).",
          related,
        });
        return;
      }
      await prisma.customer.delete({ where: { id: customer.id } });
      await writeAudit(prisma, {
        actorId: req.user!.id,
        action: "customer_hard_deleted",
        entityType: "customer",
        entityId: customer.id,
        oldValue: { fullName: customer.fullName },
        ipAddress: req.ip ?? null,
      });
      res.json({ status: "ok", message: "Đã xóa cứng khách hàng (không có dữ liệu liên quan)." });
      return;
    }
    await prisma.customer.update({
      where: { id: customer.id },
      data: { status: "inactive", deletedAt: new Date() },
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "customer_deactivated",
      entityType: "customer",
      entityId: customer.id,
      oldValue: { fullName: customer.fullName, status: customer.status },
      newValue: { status: "inactive" },
      ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", message: "Đã ngừng hoạt động khách hàng (xóa mềm, dữ liệu vẫn được giữ lại)." });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* Phones — single-phone endpoints                                     */
/* ------------------------------------------------------------------ */

async function loadCustomerInScopeForWrite(prisma: ReturnType<typeof getPrisma>, req: import("express").Request, res: import("express").Response) {
  const customer = await loadCustomerForScope(prisma, req.params.id);
  if (!customer) {
    res.status(404).json({ status: "error", message: "Khách hàng không tồn tại." });
    return null;
  }
  if (!inScope(customer, req)) {
    res.status(403).json({ status: "error", message: "Bạn không có quyền sửa khách hàng này." });
    return null;
  }
  return customer;
}

/** POST /api/customers/:id/phones — add one phone, with full duplicate check. */
router.post("/customers/:id/phones", authorize("customer.update"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const customer = await loadCustomerInScopeForWrite(prisma, req, res);
    if (!customer) return;
    const normalized = normalizePhoneList([{ phone: req.body?.phone, label: req.body?.label, isPrimary: req.body?.isPrimary }]);
    if (normalized.error) {
      res.status(400).json({ status: "error", message: normalized.error });
      return;
    }
    const p = normalized.phones[0];
    if (!isValidPhoneNormalized(p.phoneNormalized)) {
      res.status(400).json({ status: "error", message: "Số điện thoại không hợp lệ." });
      return;
    }
    const conflict = await findDuplicatePhone(prisma, [p.phoneNormalized], customer.id);
    if (conflict) {
      res.status(400).json({ status: "error", message: duplicateErrorMessage(conflict), conflict });
      return;
    }
    const existingActive = customer.phones.find((x: any) => x.phoneNormalized === p.phoneNormalized);
    if (existingActive) {
      res.status(400).json({ status: "error", message: "Khách hàng này đã có số điện thoại đó." });
      return;
    }
    const hasPrimary = customer.phones.some((x: any) => x.isPrimary);
    const makePrimary = req.body?.isPrimary === true || !hasPrimary;
    const created = await prisma.$transaction(async (tx: any) => {
      if (makePrimary) {
        await tx.customerPhone.updateMany({ where: { customerId: customer.id, isPrimary: true }, data: { isPrimary: false } });
      }
      const inactive = await tx.customerPhone.findFirst({
        where: { customerId: customer.id, phoneNormalized: p.phoneNormalized, OR: [{ status: "inactive" }, { deletedAt: { not: null } }] },
      });
      if (inactive) {
        return tx.customerPhone.update({
          where: { id: inactive.id },
          data: { phone: p.phone, label: p.label, isPrimary: makePrimary, status: "active", deletedAt: null },
        });
      }
      return tx.customerPhone.create({
        data: { customerId: customer.id, phone: p.phone, phoneNormalized: p.phoneNormalized, label: p.label, isPrimary: makePrimary, status: "active" },
      });
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "customer_phone_added",
      entityType: "customer",
      entityId: customer.id,
      newValue: { phoneNormalized: p.phoneNormalized, isPrimary: makePrimary },
      ipAddress: req.ip ?? null,
    });
    res.status(201).json({ status: "ok", phone: created });
  } catch (err) {
    if (isPrismaUniqueError(err)) {
      res.status(400).json({ status: "error", message: "Số điện thoại này đã tồn tại ở một khách hàng khác." });
      return;
    }
    dbUnavailable(res, err);
  }
});

/** POST /api/customers/:id/phones/:phoneId/make-primary */
router.post("/customers/:id/phones/:phoneId/make-primary", authorize("customer.update"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const customer = await loadCustomerInScopeForWrite(prisma, req, res);
    if (!customer) return;
    const phone = customer.phones.find((x: any) => x.id === req.params.phoneId);
    if (!phone) {
      res.status(404).json({ status: "error", message: "Số điện thoại không tồn tại hoặc đã ngừng sử dụng." });
      return;
    }
    await prisma.$transaction(async (tx: any) => {
      await tx.customerPhone.updateMany({ where: { customerId: customer.id, isPrimary: true }, data: { isPrimary: false } });
      await tx.customerPhone.update({ where: { id: phone.id }, data: { isPrimary: true } });
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "customer_primary_changed",
      entityType: "customer",
      entityId: customer.id,
      newValue: { phoneNormalized: phone.phoneNormalized },
      ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", message: "Đã đổi số chính." });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** DELETE /api/customers/:id/phones/:phoneId — soft-delete a phone. */
router.delete("/customers/:id/phones/:phoneId", authorize("customer.update"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const customer = await loadCustomerInScopeForWrite(prisma, req, res);
    if (!customer) return;
    const phone = customer.phones.find((x: any) => x.id === req.params.phoneId);
    if (!phone) {
      res.status(404).json({ status: "error", message: "Số điện thoại không tồn tại hoặc đã ngừng sử dụng." });
      return;
    }
    const others = customer.phones.filter((x: any) => x.id !== phone.id);
    if (phone.isPrimary && others.length > 0) {
      // Promote the oldest remaining phone to primary, then soft-delete.
      const nextPrimary = [...others].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
      await prisma.$transaction(async (tx: any) => {
        await tx.customerPhone.update({ where: { id: nextPrimary.id }, data: { isPrimary: true } });
        await tx.customerPhone.update({ where: { id: phone.id }, data: { status: "inactive", isPrimary: false, deletedAt: new Date() } });
      });
    } else if (phone.isPrimary && others.length === 0 && req.body?.confirm_delete_last_phone !== true) {
      res.status(400).json({
        status: "error",
        message: "Đây là số chính duy nhất của khách hàng. Hãy thêm một số khác trước, hoặc xác nhận xóa số cuối cùng bằng confirm_delete_last_phone: true.",
      });
      return;
    } else {
      await prisma.customerPhone.update({
        where: { id: phone.id },
        data: { status: "inactive", isPrimary: false, deletedAt: new Date() },
      });
    }
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "customer_phone_removed",
      entityType: "customer",
      entityId: customer.id,
      oldValue: { phoneNormalized: phone.phoneNormalized, wasPrimary: phone.isPrimary },
      ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", message: "Đã ngừng sử dụng số điện thoại (xóa mềm, vẫn giữ dấu vết)." });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* Customer tags — assign / unassign                                     */
/* ------------------------------------------------------------------ */

/** POST /api/customers/:id/tags — assign a tag. */
router.post("/customers/:id/tags", authorize("customer.update"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const customer = await loadCustomerInScopeForWrite(prisma, req, res);
    if (!customer) return;
    const tag = await prisma.customerTag.findUnique({ where: { id: req.body?.tagId } });
    if (!tag || tag.deletedAt) {
      res.status(400).json({ status: "error", message: "Tag không tồn tại hoặc đã ngừng hoạt động." });
      return;
    }
    const existing = await prisma.customerTagAssignment.findUnique({
      where: { customerId_tagId: { customerId: customer.id, tagId: tag.id } },
    });
    if (!existing) {
      await prisma.customerTagAssignment.create({ data: { customerId: customer.id, tagId: tag.id } });
      await writeAudit(prisma, {
        actorId: req.user!.id,
        action: "customer_tag_added",
        entityType: "customer",
        entityId: customer.id,
        newValue: { tagId: tag.id, tagName: tag.name },
        ipAddress: req.ip ?? null,
      });
    }
    res.json({ status: "ok", message: "Đã gán tag." });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** DELETE /api/customers/:id/tags/:tagId — unassign a tag. */
router.delete("/customers/:id/tags/:tagId", authorize("customer.update"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const customer = await loadCustomerInScopeForWrite(prisma, req, res);
    if (!customer) return;
    await prisma.customerTagAssignment.deleteMany({ where: { customerId: customer.id, tagId: req.params.tagId } });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "customer_tag_removed",
      entityType: "customer",
      entityId: customer.id,
      newValue: { tagId: req.params.tagId },
      ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", message: "Đã bỏ gán tag." });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* Children — nested endpoints                                           */
/* ------------------------------------------------------------------ */

/** POST /api/customers/:id/children — add a child. */
router.post("/customers/:id/children", authorize("customer.update"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const customer = await loadCustomerInScopeForWrite(prisma, req, res);
    if (!customer) return;
    const validated = validateChildren([req.body ?? {}]);
    if (validated.error) {
      res.status(400).json({ status: "error", message: validated.error });
      return;
    }
    const ch = validated.children[0];
    const created = await prisma.customerChild.create({
      data: {
        customerId: customer.id,
        fullName: ch.fullName,
        dateOfBirth: ch.dateOfBirth,
        gender: ch.gender,
        note: ch.note,
        sortOrder: customer.children.length,
      },
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "child_created",
      entityType: "customer",
      entityId: customer.id,
      newValue: { childId: created.id, fullName: created.fullName },
      ipAddress: req.ip ?? null,
    });
    res.status(201).json({ status: "ok", child: { ...created, ageYears: ageYears(created.dateOfBirth) } });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** PATCH /api/customers/:id/children/:childId — edit a child. */
router.patch("/customers/:id/children/:childId", authorize("customer.update"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const customer = await loadCustomerInScopeForWrite(prisma, req, res);
    if (!customer) return;
    const child = customer.children.find((c: any) => c.id === req.params.childId);
    if (!child) {
      res.status(404).json({ status: "error", message: "Con không tồn tại hoặc đã xóa." });
      return;
    }
    const { fullName, dateOfBirth, gender, note, sortOrder } = req.body ?? {};
    if (fullName !== undefined && (typeof fullName !== "string" || !fullName.trim())) {
      res.status(400).json({ status: "error", message: "Tên con không được để trống." });
      return;
    }
    const dob: { date: Date | null; error?: string } =
      dateOfBirth === undefined ? { date: child.dateOfBirth } : parseDate(dateOfBirth);
    if (dob.error) {
      res.status(400).json({ status: "error", message: dob.error });
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dob.date && dob.date > today) {
      res.status(400).json({ status: "error", message: "Ngày sinh của bé không được là ngày tương lai." });
      return;
    }
    const updated = await prisma.customerChild.update({
      where: { id: child.id },
      data: {
        ...(fullName !== undefined ? { fullName: fullName.trim() } : {}),
        ...(dateOfBirth !== undefined ? { dateOfBirth: dob.date } : {}),
        ...(gender !== undefined ? { gender: typeof gender === "string" && gender.trim() ? gender.trim() : null } : {}),
        ...(note !== undefined ? { note: typeof note === "string" && note.trim() ? note.trim() : null } : {}),
        ...(typeof sortOrder === "number" ? { sortOrder } : {}),
      },
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "child_updated",
      entityType: "customer",
      entityId: customer.id,
      newValue: { childId: updated.id, fullName: updated.fullName },
      ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", child: { ...updated, ageYears: ageYears(updated.dateOfBirth) } });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** DELETE /api/customers/:id/children/:childId — soft-delete a child. */
router.delete("/customers/:id/children/:childId", authorize("customer.update"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const customer = await loadCustomerInScopeForWrite(prisma, req, res);
    if (!customer) return;
    const child = customer.children.find((c: any) => c.id === req.params.childId);
    if (!child) {
      res.status(404).json({ status: "error", message: "Con không tồn tại hoặc đã xóa." });
      return;
    }
    await prisma.customerChild.update({ where: { id: child.id }, data: { deletedAt: new Date() } });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "child_deleted",
      entityType: "customer",
      entityId: customer.id,
      oldValue: { childId: child.id, fullName: child.fullName },
      ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", message: "Đã xóa con (xóa mềm)." });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

export default router;
