import { Router } from "express";
import { generateOtpCode, hashOtpCode, hashPassword, maskEmail, signToken, verifyOtpCode, verifyPassword } from "../lib/auth";
import { authenticate, publicUser } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_SECONDS, OTP_TTL_MINUTES, isOtpDevLogEnabled, isSmtpConfigured } from "../lib/config";
import { canSendOtpEmail, sendOtpEmail } from "../lib/mail";
import { getPrisma } from "../lib/prisma";

const router = Router();

function dbUnavailable(res: import("express").Response, err: unknown) {
  console.error("[auth] database error:", err);
  res.status(503).json({
    status: "error",
    message: "Chưa kết nối được database. Hãy chạy PostgreSQL (docker compose up -d postgres) rồi thử lại.",
  });
}

async function getOtpMode(prisma: ReturnType<typeof getPrisma>): Promise<"off" | "email"> {
  const row = await prisma.systemSetting.findUnique({ where: { key: "otp_mode" } });
  return row?.value === "email" ? "email" : "off";
}

/**
 * Per-user override wins over the system setting, except that a null
 * override follows the system setting (task B). true = always require
 * email OTP; false = never require OTP.
 */
function otpRequiredFor(user: { requireOtp: boolean | null }, mode: "off" | "email"): boolean {
  if (user.requireOtp === true) return true;
  if (user.requireOtp === false) return false;
  return mode === "email";
}

async function issueJwt(prisma: ReturnType<typeof getPrisma>, user: { id: string; username: string; roleId: string; role: { code: string } }, ip: string | null) {
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAudit(prisma, {
    actorId: user.id,
    action: "login_success",
    entityType: "user",
    entityId: user.id,
    ipAddress: ip,
  });
  return signToken({ userId: user.id, username: user.username, role: user.role.code });
}

async function createOtpChallenge(prisma: ReturnType<typeof getPrisma>, user: { id: string; email: string }) {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  const challenge = await prisma.otpChallenge.create({
    data: {
      userId: user.id,
      codeHash: hashOtpCode(code),
      channel: "email",
      expiresAt,
      maxAttempts: OTP_MAX_ATTEMPTS,
    },
  });
  await sendOtpEmail(user.email, code);
  return { challenge, expiresAt };
}

const GENERIC_LOGIN_ERROR = "Tài khoản hoặc mật khẩu không đúng.";
const LOCKED_MESSAGE = "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.";

/** POST /api/auth/login — username + password; OTP step if required. */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      res.status(400).json({ status: "error", message: "Vui lòng nhập tên đăng nhập và mật khẩu." });
      return;
    }
    const prisma = getPrisma();
    const user = await prisma.user.findFirst({
      where: { OR: [{ username: username.trim() }, { email: username.trim() }], deletedAt: null },
      include: { role: true },
    });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      await writeAudit(prisma, {
        actorId: user?.id ?? null,
        action: "login_failed",
        entityType: "user",
        entityId: user?.id ?? username.trim(),
        newValue: { reason: "wrong_credentials" },
        ipAddress: req.ip ?? null,
      });
      res.status(401).json({ status: "error", message: GENERIC_LOGIN_ERROR });
      return;
    }
    if (user.status !== "active") {
      await writeAudit(prisma, {
        actorId: user.id,
        action: "login_failed",
        entityType: "user",
        entityId: user.id,
        newValue: { reason: `account_${user.status}` },
        ipAddress: req.ip ?? null,
      });
      res.status(403).json({ status: "error", message: LOCKED_MESSAGE });
      return;
    }

    const mode = await getOtpMode(prisma);
    if (!otpRequiredFor(user, mode)) {
      const token = await issueJwt(prisma, user, req.ip ?? null);
      res.json({ status: "ok", token, user: publicUser({ ...user, permissions: undefined }) });
      return;
    }

    // OTP required: refuse to start the challenge if no channel can deliver it,
    // so enabling OTP can never lock every user out silently.
    if (!user.email) {
      res.status(400).json({ status: "error", message: "Tài khoản chưa có email để nhận mã OTP. Vui lòng liên hệ quản trị viên." });
      return;
    }
    if (!canSendOtpEmail()) {
      res.status(503).json({
        status: "error",
        message: "Chưa cấu hình gửi email OTP (SMTP) và chế độ dev OTP đang tắt. Vui lòng liên hệ quản trị viên.",
      });
      return;
    }
    const { challenge, expiresAt } = await createOtpChallenge(prisma, user);
    res.json({
      status: "ok",
      otp_required: true,
      otp_challenge_id: challenge.id,
      channel: "email",
      masked_email: maskEmail(user.email),
      expires_at: expiresAt.toISOString(),
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** POST /api/auth/verify-otp — exchanges a valid challenge + 6-digit code for a JWT. */
router.post("/verify-otp", async (req, res) => {
  try {
    const { otp_challenge_id, code } = req.body ?? {};
    if (typeof otp_challenge_id !== "string" || typeof code !== "string" || !/^\d{6}$/.test(code)) {
      res.status(400).json({ status: "error", message: "Mã OTP phải gồm 6 chữ số." });
      return;
    }
    const prisma = getPrisma();
    const challenge = await prisma.otpChallenge.findUnique({
      where: { id: otp_challenge_id },
      include: { user: { include: { role: true } } },
    });
    if (!challenge || challenge.usedAt) {
      res.status(400).json({ status: "error", message: "Phiên OTP không hợp lệ hoặc đã được sử dụng." });
      return;
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });
      res.status(400).json({ status: "error", message: "Mã OTP đã hết hạn (5 phút). Vui lòng đăng nhập lại để nhận mã mới." });
      return;
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });
      res.status(400).json({ status: "error", message: "Bạn đã nhập sai mã quá 5 lần. Vui lòng đăng nhập lại để nhận mã mới." });
      return;
    }
    if (!verifyOtpCode(code, challenge.codeHash)) {
      const attempts = challenge.attempts + 1;
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts, usedAt: attempts >= challenge.maxAttempts ? new Date() : null },
      });
      await writeAudit(prisma, {
        actorId: challenge.userId,
        action: "login_failed",
        entityType: "user",
        entityId: challenge.userId,
        newValue: { reason: "wrong_otp", attempts },
        ipAddress: req.ip ?? null,
      });
      res.status(400).json({
        status: "error",
        message: "Mã OTP không đúng.",
        attempts_remaining: Math.max(0, challenge.maxAttempts - attempts),
      });
      return;
    }
    if (challenge.user.status !== "active" || challenge.user.deletedAt) {
      res.status(403).json({ status: "error", message: LOCKED_MESSAGE });
      return;
    }
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });
    const token = await issueJwt(prisma, challenge.user, req.ip ?? null);
    res.json({ status: "ok", token, user: publicUser({ ...challenge.user, permissions: undefined }) });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** POST /api/auth/resend-otp — new code for the same login, 60s cooldown. */
router.post("/resend-otp", async (req, res) => {
  try {
    const { otp_challenge_id } = req.body ?? {};
    if (typeof otp_challenge_id !== "string") {
      res.status(400).json({ status: "error", message: "Thiếu otp_challenge_id." });
      return;
    }
    const prisma = getPrisma();
    const old = await prisma.otpChallenge.findUnique({
      where: { id: otp_challenge_id },
      include: { user: true },
    });
    if (!old || old.usedAt) {
      res.status(400).json({ status: "error", message: "Phiên OTP không hợp lệ hoặc đã được sử dụng. Vui lòng đăng nhập lại." });
      return;
    }
    const cooldownMs = OTP_RESEND_COOLDOWN_SECONDS * 1000;
    const waited = Date.now() - old.lastSentAt.getTime();
    if (waited < cooldownMs) {
      res.status(429).json({
        status: "error",
        message: `Vui lòng chờ ${Math.ceil((cooldownMs - waited) / 1000)} giây trước khi gửi lại mã.`,
        retry_after_seconds: Math.ceil((cooldownMs - waited) / 1000),
      });
      return;
    }
    if (!canSendOtpEmail()) {
      res.status(503).json({ status: "error", message: "Chưa cấu hình gửi email OTP (SMTP) và chế độ dev OTP đang tắt." });
      return;
    }
    await prisma.otpChallenge.update({ where: { id: old.id }, data: { usedAt: new Date() } });
    const { challenge, expiresAt } = await createOtpChallenge(prisma, old.user);
    // Sprint Audit supplement: OTP resend was previously unlogged.
    // Only the fact of resending is logged — never the code itself.
    await writeAudit(prisma, {
      actorId: old.userId,
      action: "otp_resent",
      entityType: "user",
      entityId: old.userId,
      newValue: { channel: "email" },
      ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", otp_challenge_id: challenge.id, expires_at: expiresAt.toISOString() });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** GET /api/auth/me — current user, never includes passwordHash. */
router.get("/me", authenticate, async (req, res) => {
  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { role: true },
    });
    if (!user) {
      res.status(401).json({ status: "error", message: "Tài khoản không còn tồn tại." });
      return;
    }
    res.json({ status: "ok", user: publicUser({ ...user, permissions: req.user!.permissions }) });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/**
 * POST /api/auth/logout — MVP: JWT is stateless, so logout is clearing the
 * token on the client. No server-side revocation list in this sprint;
 * a stolen token stays valid until its 8h expiry. Documented in README.
 */
router.post("/logout", authenticate, async (req, res) => {
  // Sprint Audit supplement: logout was previously unlogged. It is
  // still client-side token removal (no server revocation), but the
  // event itself is now traceable. Audit failure must never break
  // logout, so failures are swallowed here (writeAudit also catches).
  try {
    const prisma = getPrisma();
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "logout",
      entityType: "user",
      entityId: req.user!.id,
      ipAddress: req.ip ?? null,
    });
  } catch {
    // Ignore: logout must succeed even if audit storage is unavailable.
  }
  res.json({ status: "ok", message: "Đã đăng xuất ở phía client. Hãy xóa token đã lưu." });
});

/** POST /api/auth/change-password — requires login + correct old password. */
router.post("/change-password", authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body ?? {};
    if (typeof new_password !== "string" || new_password.length < 8) {
      res.status(400).json({ status: "error", message: "Mật khẩu mới phải có ít nhất 8 ký tự." });
      return;
    }
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || typeof current_password !== "string" || !verifyPassword(current_password, user.passwordHash)) {
      res.status(400).json({ status: "error", message: "Mật khẩu hiện tại không đúng." });
      return;
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(new_password) } });
    await writeAudit(prisma, {
      actorId: user.id,
      action: "password_changed",
      entityType: "user",
      entityId: user.id,
      ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", message: "Đã đổi mật khẩu." });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

// Re-exported for the admin settings route's SMTP/OTP checks.
export const _otpDevInfo = { isOtpDevLogEnabled, isSmtpConfigured };

export default router;
