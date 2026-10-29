import { Router } from "express";
import { hashPassword } from "../lib/auth";
import { authenticate, authorize, publicUser } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { isOtpDevLogEnabled, isSmtpConfigured } from "../lib/config";
import { getPrisma } from "../lib/prisma";

const router = Router();
router.use(authenticate);

function dbUnavailable(res: import("express").Response, err: unknown) {
  console.error("[admin] database error:", err);
  res.status(503).json({
    status: "error",
    message: "Chưa kết nối được database. Hãy chạy PostgreSQL (docker compose up -d postgres) rồi thử lại.",
  });
}

function validPassword(pw: unknown): pw is string {
  return typeof pw === "string" && pw.length >= 8;
}

/** GET /api/admin/users — list users, never passwordHash. */
router.get("/users", authorize("user.view"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const { search, role, status } = req.query;
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(typeof search === "string" && search
          ? { OR: [{ username: { contains: search, mode: "insensitive" } }, { fullName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] }
          : {}),
        ...(typeof role === "string" && role ? { role: { code: role } } : {}),
        ...(typeof status === "string" && status ? { status: status as never } : {}),
      },
      include: { role: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ status: "ok", users: users.map((u: Parameters<typeof publicUser>[0]) => publicUser(u)) });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** POST /api/admin/users — admin creates a user with an initial password. */
router.post("/users", authorize("user.create"), async (req, res) => {
  try {
    const { username, email, phone, fullName, password, role, requireOtp } = req.body ?? {};
    if (typeof username !== "string" || !username.trim() || typeof email !== "string" || !email.trim() || typeof fullName !== "string" || !fullName.trim()) {
      res.status(400).json({ status: "error", message: "Vui lòng nhập tên đăng nhập, email và họ tên." });
      return;
    }
    if (!validPassword(password)) {
      res.status(400).json({ status: "error", message: "Mật khẩu ban đầu phải có ít nhất 8 ký tự." });
      return;
    }
    if (requireOtp !== undefined && requireOtp !== null && typeof requireOtp !== "boolean") {
      res.status(400).json({ status: "error", message: "requireOtp phải là true, false hoặc null (theo hệ thống)." });
      return;
    }
    const prisma = getPrisma();
    const roleRow = await prisma.role.findUnique({ where: { code: typeof role === "string" ? role : "sales" } });
    if (!roleRow) {
      res.status(400).json({ status: "error", message: "Vai trò không tồn tại." });
      return;
    }
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username: username.trim() }, { email: email.trim() }], deletedAt: null },
    });
    if (existing) {
      res.status(409).json({ status: "error", message: "Tên đăng nhập hoặc email này đã tồn tại." });
      return;
    }
    const created = await prisma.user.create({
      data: {
        username: username.trim(),
        email: email.trim(),
        phone: typeof phone === "string" ? phone : null,
        fullName: fullName.trim(),
        passwordHash: hashPassword(password),
        roleId: roleRow.id,
        requireOtp: requireOtp ?? null,
      },
      include: { role: true },
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "user_created",
      entityType: "user",
      entityId: created.id,
      newValue: { username: created.username, role: roleRow.code },
      ipAddress: req.ip ?? null,
    });
    res.status(201).json({ status: "ok", user: publicUser(created) });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** PATCH /api/admin/users/:id — fullName, role, requireOtp (not username/email). */
router.patch("/users/:id", authorize("user.update"), async (req, res) => {
  try {
    const { fullName, phone, role, requireOtp, status } = req.body ?? {};
    const prisma = getPrisma();
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, include: { role: true } });
    if (!target || target.deletedAt) {
      res.status(404).json({ status: "error", message: "Người dùng không tồn tại." });
      return;
    }
    if (requireOtp !== undefined && !req.user!.permissions.includes("user.set_require_otp")) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền đặt yêu cầu OTP cho người dùng." });
      return;
    }
    if (requireOtp !== undefined && requireOtp !== null && typeof requireOtp !== "boolean") {
      res.status(400).json({ status: "error", message: "requireOtp phải là true, false hoặc null (theo hệ thống)." });
      return;
    }
    let roleId: string | undefined;
    if (typeof role === "string" && role) {
      const roleRow = await prisma.role.findUnique({ where: { code: role } });
      if (!roleRow) {
        res.status(400).json({ status: "error", message: "Vai trò không tồn tại." });
        return;
      }
      roleId = roleRow.id;
    }
    // Never lock out the system: the last active admin cannot be demoted
    // or deactivated through this endpoint (use lock endpoint guard too).
    if (target.role.code === "admin" && ((roleId && roleId !== target.roleId) || status === "inactive" || status === "locked")) {
      const otherAdmins = await prisma.user.count({
        where: { role: { code: "admin" }, status: "active", deletedAt: null, id: { not: target.id } },
      });
      if (otherAdmins === 0) {
        res.status(400).json({ status: "error", message: "Không thể đổi vai trò / trạng thái của admin đang hoạt động duy nhất." });
        return;
      }
    }
    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(typeof fullName === "string" && fullName.trim() ? { fullName: fullName.trim() } : {}),
        ...(typeof phone === "string" ? { phone } : {}),
        ...(roleId ? { roleId } : {}),
        ...(requireOtp !== undefined ? { requireOtp } : {}),
        ...(status === "active" || status === "inactive" || status === "locked" ? { status } : {}),
      },
      include: { role: true },
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: roleId && roleId !== target.roleId ? "role_changed" : "user_updated",
      entityType: "user",
      entityId: target.id,
      oldValue: { role: target.role.code, status: target.status, requireOtp: target.requireOtp },
      newValue: { role: updated.role.code, status: updated.status, requireOtp: updated.requireOtp },
      ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", user: publicUser(updated) });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** POST /api/admin/users/:id/lock and /unlock — locked/inactive users cannot log in. */
router.post("/users/:id/lock", authorize("user.lock"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, include: { role: true } });
    if (!target || target.deletedAt) {
      res.status(404).json({ status: "error", message: "Người dùng không tồn tại." });
      return;
    }
    if (target.role.code === "admin") {
      const otherAdmins = await prisma.user.count({
        where: { role: { code: "admin" }, status: "active", deletedAt: null, id: { not: target.id } },
      });
      if (otherAdmins === 0) {
        res.status(400).json({ status: "error", message: "Không thể khóa admin đang hoạt động duy nhất." });
        return;
      }
    }
    const updated = await prisma.user.update({ where: { id: target.id }, data: { status: "locked" }, include: { role: true } });
    await writeAudit(prisma, { actorId: req.user!.id, action: "user_locked", entityType: "user", entityId: target.id, oldValue: { status: target.status }, newValue: { status: "locked" }, ipAddress: req.ip ?? null });
    res.json({ status: "ok", user: publicUser(updated) });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

router.post("/users/:id/unlock", authorize("user.lock"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, include: { role: true } });
    if (!target || target.deletedAt) {
      res.status(404).json({ status: "error", message: "Người dùng không tồn tại." });
      return;
    }
    const updated = await prisma.user.update({ where: { id: target.id }, data: { status: "active" }, include: { role: true } });
    await writeAudit(prisma, { actorId: req.user!.id, action: "user_unlocked", entityType: "user", entityId: target.id, oldValue: { status: target.status }, newValue: { status: "active" }, ipAddress: req.ip ?? null });
    res.json({ status: "ok", user: publicUser(updated) });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** POST /api/admin/users/:id/reset-password — admin sets a new password (min 8). */
router.post("/users/:id/reset-password", authorize("user.reset_password"), async (req, res) => {
  try {
    const { new_password } = req.body ?? {};
    if (!validPassword(new_password)) {
      res.status(400).json({ status: "error", message: "Mật khẩu mới phải có ít nhất 8 ký tự." });
      return;
    }
    const prisma = getPrisma();
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target || target.deletedAt) {
      res.status(404).json({ status: "error", message: "Người dùng không tồn tại." });
      return;
    }
    await prisma.user.update({ where: { id: target.id }, data: { passwordHash: hashPassword(new_password) } });
    await writeAudit(prisma, { actorId: req.user!.id, action: "password_reset", entityType: "user", entityId: target.id, ipAddress: req.ip ?? null });
    res.json({ status: "ok", message: "Đã đặt lại mật khẩu." });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** GET /api/admin/roles — roles with their permission codes. */
router.get("/roles", authorize("role.view"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const roles = await prisma.role.findMany({
      where: { deletedAt: null },
      include: { permissions: { include: { permission: true } } },
      orderBy: { code: "asc" },
    });
    res.json({
      status: "ok",
      roles: roles.map((r: { id: string; code: string; name: string; description: string | null; isSystemRole: boolean; permissions: { permission: { code: string } }[] }) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        isSystemRole: r.isSystemRole,
        permissions: r.permissions.map((p: { permission: { code: string } }) => p.permission.code),
      })),
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** GET /api/admin/settings — currently only otp_mode + delivery capability (no secrets). */
router.get("/settings", authorize("settings.view"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const row = await prisma.systemSetting.findUnique({ where: { key: "otp_mode" } });
    res.json({
      status: "ok",
      settings: {
        otp_mode: row?.value ?? "off",
        smtp_configured: isSmtpConfigured(),
        otp_dev_log: isOtpDevLogEnabled(),
        otp_phone_supported: false,
      },
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/**
 * PUT /api/admin/settings/otp-mode — admin-only.
 * 'phone' is REJECTED: no SMS provider exists in this sprint, so accepting
 * it would silently break login for everyone. 'email' is rejected unless
 * SMTP is configured or OTP_DEV_LOG is on, for the same reason.
 */
router.put("/settings/otp-mode", authorize("settings.update_otp"), async (req, res) => {
  try {
    const { otp_mode } = req.body ?? {};
    if (otp_mode === "phone") {
      res.status(400).json({
        status: "error",
        message: "OTP qua điện thoại/SMS chưa được hỗ trợ trong sprint này vì chưa có nhà cung cấp SMS. Chỉ dùng 'off' hoặc 'email'.",
      });
      return;
    }
    if (otp_mode !== "off" && otp_mode !== "email") {
      res.status(400).json({ status: "error", message: "otp_mode chỉ nhận 'off' hoặc 'email'." });
      return;
    }
    if (otp_mode === "email" && !isSmtpConfigured() && !isOtpDevLogEnabled()) {
      res.status(400).json({
        status: "error",
        message: "Chưa cấu hình SMTP và chế độ dev OTP đang tắt nên không thể bật OTP qua email — nếu đổi, không ai nhận được mã. Hãy cấu hình SMTP_HOST/SMTP_USER/SMTP_PASS trước, hoặc bật OTP_DEV_LOG=true chỉ để dev local.",
      });
      return;
    }
    const prisma = getPrisma();
    const old = await prisma.systemSetting.findUnique({ where: { key: "otp_mode" } });
    const saved = await prisma.systemSetting.upsert({
      where: { key: "otp_mode" },
      create: { key: "otp_mode", value: otp_mode, description: "Chế độ OTP đăng nhập: off (mặc định) hoặc email", updatedById: req.user!.id },
      update: { value: otp_mode, updatedById: req.user!.id },
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "settings_changed",
      entityType: "system_setting",
      entityId: "otp_mode",
      oldValue: { otp_mode: old?.value ?? "off" },
      newValue: { otp_mode: saved.value },
      ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", settings: { otp_mode: saved.value } });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

export default router;
