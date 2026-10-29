/**
 * Audit Log API — Sprint Audit. READ-ONLY.
 *
 * There is deliberately NO POST / PATCH / DELETE route in this file:
 * audit rows are written only by writeAudit() inside other operations,
 * never through an API. A POST/DELETE to these paths falls through to
 * the app's catch-all and returns 404, so a log can never be edited
 * or deleted via the API (locked rules §5).
 *
 * Permission decision (documented in DEVELOPMENT_PLAN.md):
 * - audit.view_all (Admin, Manager): full audit, any actor, any entity.
 * - audit.view_own (Sales, Warehouse, Accountant): only rows where
 *   actorId is the requesting user. On the list endpoint an actorId
 *   filter for somebody else is rejected with 403 rather than silently
 *   rewritten, so a caller can never be misled about whose rows they
 *   are seeing. On the entity endpoint, view_own sees only their own
 *   actions on that entity, not other people's actions on it.
 * - Neither permission: 403 on every endpoint in this file.
 *
 * Sensitive values: writeAudit() already strips credential fields
 * (password / token / secret / codeHash) at write time. At read time
 * this file additionally strips importPrice/import_price for viewers
 * without product.view_cost, so a cost snapshot hiding inside an
 * oldValue/newValue cannot leak through the audit viewer.
 */
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { sanitizeAuditValueForViewer } from "../lib/audit";
import { getPrisma } from "../lib/prisma";

const router = Router();
router.use(authenticate);

function dbUnavailable(res: import("express").Response, err: unknown) {
  console.error("[audit] database error:", err);
  res.status(503).json({
    status: "error",
    message: "Chưa kết nối được database. Hãy chạy PostgreSQL (docker compose up -d postgres) rồi thử lại.",
  });
}

function canViewAll(req: import("express").Request): boolean {
  return req.user!.permissions.includes("audit.view_all");
}
function canViewOwn(req: import("express").Request): boolean {
  return req.user!.permissions.includes("audit.view_own");
}
function canViewCost(req: import("express").Request): boolean {
  return req.user!.permissions.includes("product.view_cost");
}

function parsePagination(req: import("express").Request): { page: number; pageSize: number } | { error: string } {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const pageSize = req.query.pageSize === undefined ? 20 : Number(req.query.pageSize);
  if (!Number.isInteger(page) || page < 1) return { error: "page phải là số nguyên >= 1." };
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return { error: "pageSize phải là số nguyên từ 1 đến 100." };
  }
  return { page, pageSize };
}

function parseDateParam(raw: unknown, endOfDay: boolean): Date | null | { error: string } {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string") return { error: "Ngày phải là chuỗi YYYY-MM-DD hoặc ISO." };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { error: `Ngày không hợp lệ: ${raw}.` };
  // A bare YYYY-MM-DD "to" date means the whole day, not midnight at its start.
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    d.setUTCHours(23, 59, 59, 999);
  }
  return d;
}

function serializeRow(req: import("express").Request, row: any) {
  const canCost = canViewCost(req);
  return {
    id: row.id,
    actorId: row.actorId,
    actorUsername: row.actor?.username ?? null,
    actorName: row.actor?.fullName ?? null,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    oldValue: sanitizeAuditValueForViewer(row.oldValue ?? null, canCost),
    newValue: sanitizeAuditValueForViewer(row.newValue ?? null, canCost),
    ipAddress: row.ipAddress,
    createdAt: row.createdAt,
  };
}

function buildWhere(req: import("express").Request): Record<string, unknown> | { error: string } {
  const viewAll = canViewAll(req);
  const viewOwn = canViewOwn(req);
  if (!viewAll && !viewOwn) return { error: "forbidden" };

  const actorId = (req.query.actorId ?? req.query.user_id) as string | undefined;
  const action = req.query.action as string | undefined;
  const entityType = (req.query.entityType ?? req.query.entity_type) as string | undefined;
  const entityId = (req.query.entityId ?? req.query.entity_id) as string | undefined;
  const q = req.query.q as string | undefined;

  // view_own callers may only ever see their own rows.
  if (!viewAll && actorId && actorId !== req.user!.id) return { error: "forbidden" };

  const where: Record<string, unknown> = {};
  if (!viewAll) where.actorId = req.user!.id;
  else if (actorId) where.actorId = actorId;
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (q) {
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { entityType: { contains: q, mode: "insensitive" } },
      { entityId: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

/** GET /api/audit-logs — paginated, filterable audit list, newest first. */
router.get("/audit-logs", async (req, res) => {
  try {
    const pagination = parsePagination(req);
    if ("error" in pagination) {
      res.status(400).json({ status: "error", message: pagination.error });
      return;
    }
    const fromRaw = req.query.from ?? req.query.date_from;
    const toRaw = req.query.to ?? req.query.date_to;
    const from = parseDateParam(fromRaw, false);
    const to = parseDateParam(toRaw, true);
    if (from && typeof from === "object" && "error" in from) {
      res.status(400).json({ status: "error", message: from.error });
      return;
    }
    if (to && typeof to === "object" && "error" in to) {
      res.status(400).json({ status: "error", message: to.error });
      return;
    }
    const whereOrError = buildWhere(req);
    if (whereOrError && typeof whereOrError === "object" && "error" in whereOrError) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem nhật ký audit này." });
      return;
    }
    const where = whereOrError as Record<string, unknown>;
    const createdAt: Record<string, unknown> = {};
    if (from) createdAt.gte = from;
    if (to) createdAt.lte = to;
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;

    const prisma: any = getPrisma();
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { username: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({
      status: "ok",
      scope: canViewAll(req) ? "all" : "own",
      data: rows.map((r: any) => serializeRow(req, r)),
      pagination: { page: pagination.page, pageSize: pagination.pageSize, total, totalPages: Math.ceil(total / pagination.pageSize) },
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** GET /api/audit-logs/entity/:entityType/:entityId — timeline of one entity. */
router.get("/audit-logs/entity/:entityType/:entityId", async (req, res) => {
  try {
    const pagination = parsePagination(req);
    if ("error" in pagination) {
      res.status(400).json({ status: "error", message: pagination.error });
      return;
    }
    if (!canViewAll(req) && !canViewOwn(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem nhật ký audit." });
      return;
    }
    const where: Record<string, unknown> = {
      entityType: req.params.entityType,
      entityId: req.params.entityId,
    };
    // view_own on an entity timeline sees only their own actions on
    // that entity — never other people's actions on it.
    if (!canViewAll(req)) where.actorId = req.user!.id;
    const prisma: any = getPrisma();
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { username: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({
      status: "ok",
      scope: canViewAll(req) ? "all" : "own",
      entityType: req.params.entityType,
      entityId: req.params.entityId,
      data: rows.map((r: any) => serializeRow(req, r)),
      pagination: { page: pagination.page, pageSize: pagination.pageSize, total, totalPages: Math.ceil(total / pagination.pageSize) },
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** GET /api/audit-logs/:id — one audit row in full (credentials stripped). */
router.get("/audit-logs/:id", async (req, res) => {
  try {
    if (!canViewAll(req) && !canViewOwn(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem nhật ký audit." });
      return;
    }
    const prisma: any = getPrisma();
    const row = await prisma.auditLog.findUnique({
      where: { id: req.params.id },
      include: { actor: { select: { username: true, fullName: true } } },
    });
    if (!row) {
      res.status(404).json({ status: "error", message: "Không tìm thấy dòng audit." });
      return;
    }
    if (!canViewAll(req) && row.actorId !== req.user!.id) {
      res.status(403).json({ status: "error", message: "Bạn chỉ xem được audit do chính mình thực hiện." });
      return;
    }
    res.json({ status: "ok", data: serializeRow(req, row) });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

export default router;
