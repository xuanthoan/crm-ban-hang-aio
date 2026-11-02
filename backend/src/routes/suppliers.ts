/**
 * Supplier API — Sprint NCC-1 (directory only).
 *
 * Mirrors Sprint Customer, adapted for suppliers (design 13 §1, §2.1,
 * §2.2, §5, §7.3, §7.4):
 *  §1.4 unlimited phones via SupplierPhone, exactly one primary,
 *       duplicate check across ALL phones (other suppliers + within
 *       the same request), whole operation blocked on a match.
 *       Phones are NOT checked against customer phones: one number may
 *       belong to both a customer and a supplier.
 *  §1.4 tax code: optional, but unique when provided.
 *  §5   no hard delete of data with transactions: DELETE deactivates
 *       (status inactive) by default; hard delete is Admin-only and
 *       audit-logged. NCC-1 has no purchase orders yet, so hard delete
 *       is allowed here — NCC-2 MUST add a guard blocking hard delete
 *       for any supplier that has purchase orders.
 *  §6   backend permission + data-scope checks on every route.
 *
 * Data scope: supplier.view_all sees all suppliers. supplier.view_own
 * sees only suppliers the user created (createdById). There is no
 * assigned-to field for suppliers in NCC-1.
 *
 * NOTE on types: this file deliberately uses `any` / ReturnType instead
 * of importing the PrismaClient type, so `tsc --noEmit` in a checkout
 * without a generated client reports no new errors (the same convention
 * as backend/src/routes/customers.ts).
 */

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { isValidPhoneNormalized, normalizePhone } from "../lib/customers";
import { getPrisma } from "../lib/prisma";
import {
  duplicateErrorMessage,
  findDuplicatePhone,
  normalizePhoneList,
} from "../lib/suppliers";

const router = Router();
router.use(authenticate);

function dbUnavailable(res: import("express").Response, err: unknown) {
  console.error("[suppliers] database error:", err);
  res.status(503).json({
    status: "error",
    message: "Chưa kết nối được database. Hãy chạy PostgreSQL (docker compose up -d postgres) rồi thử lại.",
  });
}

function isPrismaUniqueError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

function canViewAll(req: import("express").Request): boolean {
  return req.user!.permissions.includes("supplier.view_all");
}

function canView(req: import("express").Request): boolean {
  return canViewAll(req) || req.user!.permissions.includes("supplier.view_own");
}

function scopeWhere(req: import("express").Request): Record<string, unknown> {
  if (canViewAll(req)) return {};
  return { createdById: req.user!.id };
}

function inScope(supplier: { createdById: string | null }, req: import("express").Request): boolean {
  if (canViewAll(req)) return true;
  return supplier.createdById === req.user!.id;
}

function parsePagination(req: import("express").Request): { page: number; pageSize: number } {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
  return { page, pageSize };
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Empty tax-code input means "no tax code" (null), so the unique index never blocks two suppliers without one. */
function normalizeTaxCode(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function serializeListSupplier(s: any) {
  const phones = (s.phones ?? []).filter((p: any) => p.status === "active" && !p.deletedAt);
  const primary = phones.find((p: any) => p.isPrimary) ?? phones[0] ?? null;
  return {
    id: s.id,
    name: s.name,
    taxCode: s.taxCode,
    email: s.email,
    address: s.address,
    note: s.note,
    status: s.status,
    primaryPhone: primary ? primary.phone : null,
    primaryPhoneNormalized: primary ? primary.phoneNormalized : null,
    phoneCount: phones.length,
    createdById: s.createdById,
    createdByName: s.createdBy?.fullName ?? null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function serializeDetailSupplier(s: any) {
  const phones = (s.phones ?? [])
    .filter((p: any) => p.status === "active" && !p.deletedAt)
    .sort((a: any, b: any) => Number(b.isPrimary) - Number(a.isPrimary));
  return {
    ...serializeListSupplier(s),
    phones: phones.map((p: any) => ({
      id: p.id,
      phone: p.phone,
      phoneNormalized: p.phoneNormalized,
      isPrimary: p.isPrimary,
      label: p.label,
      status: p.status,
      createdAt: p.createdAt,
    })),
  };
}

async function loadSupplierForScope(prisma: ReturnType<typeof getPrisma>, id: string) {
  return prisma.supplier.findUnique({
    where: { id },
    include: {
      phones: { where: { status: "active", deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      createdBy: { select: { id: true, fullName: true, username: true } },
    },
  });
}

async function findTaxCodeConflict(
  prisma: ReturnType<typeof getPrisma>,
  taxCode: string | null,
  excludeSupplierId?: string | null,
): Promise<{ id: string; name: string } | null> {
  if (!taxCode) return null;
  const existing = await prisma.supplier.findFirst({
    where: { taxCode, ...(excludeSupplierId ? { id: { not: excludeSupplierId } } : {}) },
  });
  return existing ? { id: existing.id, name: existing.name } : null;
}

/* ------------------------------------------------------------------ */
/* Suppliers — list / detail                                           */
/* ------------------------------------------------------------------ */

/** GET /api/suppliers — paginated, searchable by name or ANY phone. */
router.get("/suppliers", async (req, res) => {
  try {
    if (!canView(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem nhà cung cấp." });
      return;
    }
    const prisma = getPrisma();
    const { page, pageSize } = parsePagination(req);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";

    const and: Record<string, unknown>[] = [scopeWhere(req)];
    if (q) {
      const normalizedQ = normalizePhone(q);
      const looksLikePhone = /[\d+][\d\s.\-()]*\d/.test(q) && normalizedQ.replace(/\D/g, "").length >= 3;
      and.push({
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          // Search by ANY phone, normalized the same way as stored phones,
          // so "0987 884 244", "098-788-4244" and "+84987884244" all match.
          ...(looksLikePhone
            ? [{ phones: { some: { phoneNormalized: { contains: normalizedQ }, status: "active", deletedAt: null } } }]
            : []),
        ],
      });
    }
    if (status === "active" || status === "inactive") and.push({ status });

    const where = { AND: and };
    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          phones: { where: { status: "active", deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
          createdBy: { select: { fullName: true } },
        },
      }),
    ]);
    res.json({
      status: "ok",
      data: suppliers.map((s: any) => serializeListSupplier(s)),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** GET /api/suppliers/:id — detail with phones. */
router.get("/suppliers/:id", async (req, res) => {
  try {
    if (!canView(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem nhà cung cấp." });
      return;
    }
    const prisma = getPrisma();
    const supplier = await loadSupplierForScope(prisma, req.params.id);
    if (!supplier) {
      res.status(404).json({ status: "error", message: "Nhà cung cấp không tồn tại." });
      return;
    }
    if (!inScope(supplier, req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem nhà cung cấp này." });
      return;
    }
    res.json({ status: "ok", supplier: serializeDetailSupplier(supplier) });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* Suppliers — create / update                                         */
/* ------------------------------------------------------------------ */

/** POST /api/suppliers — create supplier + phones in one transaction. */
router.post("/suppliers", authorize("supplier.create"), async (req, res) => {
  try {
    const { name, taxCode, email, address, note, status, phones } = req.body ?? {};
    const supplierName = typeof name === "string" ? name.trim() : "";
    if (!supplierName) {
      res.status(400).json({ status: "error", message: "Tên nhà cung cấp không được để trống." });
      return;
    }
    if (email !== undefined && email !== null && email !== "" && (typeof email !== "string" || !validEmail(email.trim()))) {
      res.status(400).json({ status: "error", message: "Email không đúng định dạng." });
      return;
    }
    const normalizedTaxCode = normalizeTaxCode(taxCode);
    const phoneList = phones === undefined ? [] : phones;
    const normalized = normalizePhoneList(phoneList);
    if (normalized.error) {
      res.status(400).json({ status: "error", message: normalized.error });
      return;
    }
    const prisma = getPrisma();
    const taxConflict = await findTaxCodeConflict(prisma, normalizedTaxCode, null);
    if (taxConflict) {
      res.status(409).json({
        status: "error",
        message: `Mã số thuế ${normalizedTaxCode} đã tồn tại ở nhà cung cấp "${taxConflict.name}".`,
      });
      return;
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
      return tx.supplier.create({
        data: {
          name: supplierName,
          taxCode: normalizedTaxCode,
          email: typeof email === "string" && email.trim() ? email.trim() : null,
          address: typeof address === "string" && address.trim() ? address.trim() : null,
          note: typeof note === "string" && note.trim() ? note.trim() : null,
          status: status === "inactive" ? "inactive" : "active",
          createdById: req.user!.id,
          phones: {
            create: normalized.phones.map((p) => ({
              phone: p.phone,
              phoneNormalized: p.phoneNormalized,
              label: p.label,
              isPrimary: p.isPrimary,
              status: "active",
            })),
          },
        },
        include: {
          phones: { where: { status: "active", deletedAt: null } },
          createdBy: { select: { fullName: true } },
        },
      });
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "supplier_created",
      entityType: "supplier",
      entityId: created.id,
      newValue: { name: created.name, taxCode: created.taxCode, phoneCount: normalized.phones.length },
      ipAddress: req.ip ?? null,
    });
    res.status(201).json({ status: "ok", supplier: serializeDetailSupplier(created) });
  } catch (err) {
    if (isPrismaUniqueError(err)) {
      res.status(409).json({ status: "error", message: "Mã số thuế hoặc số điện thoại này đã tồn tại ở một nhà cung cấp khác. Vui lòng kiểm tra lại." });
      return;
    }
    dbUnavailable(res, err);
  }
});

/** PATCH /api/suppliers/:id — partial update; phones only change when provided. */
router.patch("/suppliers/:id", authorize("supplier.update"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const supplier = await loadSupplierForScope(prisma, req.params.id);
    if (!supplier) {
      res.status(404).json({ status: "error", message: "Nhà cung cấp không tồn tại." });
      return;
    }
    if (!inScope(supplier, req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền sửa nhà cung cấp này." });
      return;
    }
    const { name, taxCode, email, address, note, status, phones } = req.body ?? {};

    const supplierName = name === undefined ? supplier.name : typeof name === "string" ? name.trim() : "";
    if (name !== undefined && !supplierName) {
      res.status(400).json({ status: "error", message: "Tên nhà cung cấp không được để trống." });
      return;
    }
    if (email !== undefined && email !== null && email !== "" && (typeof email !== "string" || !validEmail(email.trim()))) {
      res.status(400).json({ status: "error", message: "Email không đúng định dạng." });
      return;
    }
    const normalizedTaxCode = taxCode === undefined ? supplier.taxCode : normalizeTaxCode(taxCode);
    const phonesProvided = phones !== undefined;
    const normalized = phonesProvided ? normalizePhoneList(phones) : { phones: [] as ReturnType<typeof normalizePhoneList>["phones"] };
    if (normalized.error) {
      res.status(400).json({ status: "error", message: normalized.error });
      return;
    }
    const taxConflict = await findTaxCodeConflict(prisma, normalizedTaxCode, supplier.id);
    if (taxConflict) {
      res.status(409).json({
        status: "error",
        message: `Mã số thuế ${normalizedTaxCode} đã tồn tại ở nhà cung cấp "${taxConflict.name}".`,
      });
      return;
    }
    if (phonesProvided) {
      const conflict = await findDuplicatePhone(
        prisma,
        normalized.phones.map((p) => p.phoneNormalized),
        supplier.id,
      );
      if (conflict) {
        res.status(400).json({ status: "error", message: duplicateErrorMessage(conflict), conflict });
        return;
      }
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.supplier.update({
        where: { id: supplier.id },
        data: {
          ...(name !== undefined ? { name: supplierName } : {}),
          ...(taxCode !== undefined ? { taxCode: normalizedTaxCode } : {}),
          ...(email !== undefined ? { email: typeof email === "string" && email.trim() ? email.trim() : null } : {}),
          ...(address !== undefined ? { address: typeof address === "string" && address.trim() ? address.trim() : null } : {}),
          ...(note !== undefined ? { note: typeof note === "string" && note.trim() ? note.trim() : null } : {}),
          ...(status === "active" || status === "inactive" ? { status } : {}),
        },
      });
      if (phonesProvided) {
        const desired = new Map(normalized.phones.map((p) => [p.phoneNormalized, p]));
        const existingActive = await tx.supplierPhone.findMany({
          where: { supplierId: supplier.id, status: "active", deletedAt: null },
        });
        const existingInactive = await tx.supplierPhone.findMany({
          where: {
            supplierId: supplier.id,
            phoneNormalized: { in: [...desired.keys()] },
            OR: [{ status: "inactive" }, { deletedAt: { not: null } }],
          },
        });
        const inactiveByNorm = new Map<string, any>(
          existingInactive.map((p: any) => [p.phoneNormalized, p] as [string, any]),
        );
        for (const old of existingActive) {
          if (!desired.has(old.phoneNormalized)) {
            await tx.supplierPhone.update({
              where: { id: old.id },
              data: { status: "inactive", isPrimary: false, deletedAt: new Date() },
            });
          }
        }
        for (const p of normalized.phones) {
          const activeMatch = existingActive.find((o: any) => o.phoneNormalized === p.phoneNormalized);
          if (activeMatch) {
            await tx.supplierPhone.update({
              where: { id: activeMatch.id },
              data: { phone: p.phone, label: p.label, isPrimary: p.isPrimary },
            });
          } else if (inactiveByNorm.has(p.phoneNormalized)) {
            const row: any = inactiveByNorm.get(p.phoneNormalized);
            if (row) {
              await tx.supplierPhone.update({
                where: { id: row.id },
                data: { phone: p.phone, label: p.label, isPrimary: p.isPrimary, status: "active", deletedAt: null },
              });
            }
          } else {
            await tx.supplierPhone.create({
              data: {
                supplierId: supplier.id,
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
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "supplier_updated",
      entityType: "supplier",
      entityId: supplier.id,
      newValue: {
        name: supplierName,
        ...(phonesProvided ? { phoneCount: normalized.phones.length } : {}),
      },
      ipAddress: req.ip ?? null,
    });
    const updated = await loadSupplierForScope(prisma, supplier.id);
    res.json({ status: "ok", supplier: updated ? serializeDetailSupplier(updated) : null });
  } catch (err) {
    if (isPrismaUniqueError(err)) {
      res.status(409).json({ status: "error", message: "Mã số thuế hoặc số điện thoại này đã tồn tại ở một nhà cung cấp khác. Vui lòng kiểm tra lại." });
      return;
    }
    dbUnavailable(res, err);
  }
});

/** DELETE /api/suppliers/:id — deactivate by default; ?hard=true only for Admin. */
router.delete("/suppliers/:id", async (req, res) => {
  try {
    const hard = req.query.hard === "true";
    if (hard) {
      if (!req.user!.permissions.includes("supplier.hard_delete") || req.user!.role !== "admin") {
        res.status(403).json({ status: "error", message: "Chỉ Admin mới được xóa cứng nhà cung cấp." });
        return;
      }
    } else if (!req.user!.permissions.includes("supplier.deactivate")) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền ngừng hợp tác nhà cung cấp." });
      return;
    }
    const prisma = getPrisma();
    const supplier = await loadSupplierForScope(prisma, req.params.id);
    if (!supplier) {
      res.status(404).json({ status: "error", message: "Nhà cung cấp không tồn tại." });
      return;
    }
    if (!inScope(supplier, req) && !canViewAll(req)) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xóa nhà cung cấp này." });
      return;
    }
    if (hard) {
      // NCC-1 has no purchase orders yet, so hard delete is allowed for
      // Admin. NCC-2 MUST add a guard here: block hard delete for any
      // supplier that has purchase orders (locked rules §5 — no hard
      // delete of data with transactions).
      await prisma.$transaction(async (tx: any) => {
        await tx.supplierPhone.deleteMany({ where: { supplierId: supplier.id } });
        await tx.supplier.delete({ where: { id: supplier.id } });
      });
      await writeAudit(prisma, {
        actorId: req.user!.id,
        action: "supplier_hard_deleted",
        entityType: "supplier",
        entityId: supplier.id,
        oldValue: { name: supplier.name },
        ipAddress: req.ip ?? null,
      });
      res.json({ status: "ok", message: "Đã xóa cứng nhà cung cấp (chưa có đơn nhập nào)." });
      return;
    }
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { status: "inactive" },
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "supplier_deactivated",
      entityType: "supplier",
      entityId: supplier.id,
      oldValue: { name: supplier.name, status: supplier.status },
      newValue: { status: "inactive" },
      ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", message: "Đã ngừng hợp tác nhà cung cấp (dữ liệu vẫn được giữ lại)." });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* Phones — single-phone endpoints                                     */
/* ------------------------------------------------------------------ */

async function loadSupplierInScopeForWrite(prisma: ReturnType<typeof getPrisma>, req: import("express").Request, res: import("express").Response) {
  const supplier = await loadSupplierForScope(prisma, req.params.id);
  if (!supplier) {
    res.status(404).json({ status: "error", message: "Nhà cung cấp không tồn tại." });
    return null;
  }
  if (!inScope(supplier, req)) {
    res.status(403).json({ status: "error", message: "Bạn không có quyền sửa nhà cung cấp này." });
    return null;
  }
  return supplier;
}

/** POST /api/suppliers/:id/phones — add one phone, with full duplicate check. */
router.post("/suppliers/:id/phones", authorize("supplier.update"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const supplier = await loadSupplierInScopeForWrite(prisma, req, res);
    if (!supplier) return;
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
    const conflict = await findDuplicatePhone(prisma, [p.phoneNormalized], supplier.id);
    if (conflict) {
      res.status(400).json({ status: "error", message: duplicateErrorMessage(conflict), conflict });
      return;
    }
    const existingActive = supplier.phones.find((x: any) => x.phoneNormalized === p.phoneNormalized);
    if (existingActive) {
      res.status(400).json({ status: "error", message: "Nhà cung cấp này đã có số điện thoại đó." });
      return;
    }
    const hasPrimary = supplier.phones.some((x: any) => x.isPrimary);
    const makePrimary = req.body?.isPrimary === true || !hasPrimary;
    const created = await prisma.$transaction(async (tx: any) => {
      if (makePrimary) {
        await tx.supplierPhone.updateMany({ where: { supplierId: supplier.id, isPrimary: true }, data: { isPrimary: false } });
      }
      const inactive = await tx.supplierPhone.findFirst({
        where: { supplierId: supplier.id, phoneNormalized: p.phoneNormalized, OR: [{ status: "inactive" }, { deletedAt: { not: null } }] },
      });
      if (inactive) {
        return tx.supplierPhone.update({
          where: { id: inactive.id },
          data: { phone: p.phone, label: p.label, isPrimary: makePrimary, status: "active", deletedAt: null },
        });
      }
      return tx.supplierPhone.create({
        data: { supplierId: supplier.id, phone: p.phone, phoneNormalized: p.phoneNormalized, label: p.label, isPrimary: makePrimary, status: "active" },
      });
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "supplier_phone_added",
      entityType: "supplier",
      entityId: supplier.id,
      newValue: { phoneNormalized: p.phoneNormalized, isPrimary: makePrimary },
      ipAddress: req.ip ?? null,
    });
    res.status(201).json({ status: "ok", phone: created });
  } catch (err) {
    if (isPrismaUniqueError(err)) {
      res.status(400).json({ status: "error", message: "Số điện thoại này đã tồn tại ở một nhà cung cấp khác." });
      return;
    }
    dbUnavailable(res, err);
  }
});

/** POST /api/suppliers/:id/phones/:phoneId/make-primary */
router.post("/suppliers/:id/phones/:phoneId/make-primary", authorize("supplier.update"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const supplier = await loadSupplierInScopeForWrite(prisma, req, res);
    if (!supplier) return;
    const phone = supplier.phones.find((x: any) => x.id === req.params.phoneId);
    if (!phone) {
      res.status(404).json({ status: "error", message: "Số điện thoại không tồn tại hoặc đã ngừng sử dụng." });
      return;
    }
    await prisma.$transaction(async (tx: any) => {
      await tx.supplierPhone.updateMany({ where: { supplierId: supplier.id, isPrimary: true }, data: { isPrimary: false } });
      await tx.supplierPhone.update({ where: { id: phone.id }, data: { isPrimary: true } });
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "supplier_primary_changed",
      entityType: "supplier",
      entityId: supplier.id,
      newValue: { phoneNormalized: phone.phoneNormalized },
      ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", message: "Đã đổi số chính." });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** DELETE /api/suppliers/:id/phones/:phoneId — soft-delete a phone. */
router.delete("/suppliers/:id/phones/:phoneId", authorize("supplier.update"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const supplier = await loadSupplierInScopeForWrite(prisma, req, res);
    if (!supplier) return;
    const phone = supplier.phones.find((x: any) => x.id === req.params.phoneId);
    if (!phone) {
      res.status(404).json({ status: "error", message: "Số điện thoại không tồn tại hoặc đã ngừng sử dụng." });
      return;
    }
    const others = supplier.phones.filter((x: any) => x.id !== phone.id);
    if (phone.isPrimary && others.length > 0) {
      // Promote the oldest remaining phone to primary, then soft-delete.
      const nextPrimary = [...others].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
      await prisma.$transaction(async (tx: any) => {
        await tx.supplierPhone.update({ where: { id: nextPrimary.id }, data: { isPrimary: true } });
        await tx.supplierPhone.update({ where: { id: phone.id }, data: { status: "inactive", isPrimary: false, deletedAt: new Date() } });
      });
    } else if (phone.isPrimary && others.length === 0 && req.body?.confirm_delete_last_phone !== true) {
      res.status(400).json({
        status: "error",
        message: "Đây là số chính duy nhất của nhà cung cấp. Hãy thêm một số khác trước, hoặc xác nhận xóa số cuối cùng bằng confirm_delete_last_phone: true.",
      });
      return;
    } else {
      await prisma.supplierPhone.update({
        where: { id: phone.id },
        data: { status: "inactive", isPrimary: false, deletedAt: new Date() },
      });
    }
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "supplier_phone_removed",
      entityType: "supplier",
      entityId: supplier.id,
      oldValue: { phoneNormalized: phone.phoneNormalized, wasPrimary: phone.isPrimary },
      ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", message: "Đã ngừng sử dụng số điện thoại (xóa mềm, vẫn giữ dấu vết)." });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

export default router;
