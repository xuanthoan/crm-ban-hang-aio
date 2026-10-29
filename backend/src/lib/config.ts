/**
 * Environment configuration for Sprint Auth.
 * No production secret is ever hard-coded here: if JWT_SECRET is missing,
 * the server refuses to start (see src/index.ts) instead of falling back
 * to a default secret.
 */

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set. Set JWT_SECRET in backend/.env (or in the " +
        "Docker Compose environment) before starting the backend. " +
        "Never commit a real secret to the repository.",
    );
  }
  return secret;
}

export function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN || "8h";
}

export type OtpMode = "off" | "email";

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

/** Dev-only OTP logging. MUST stay false in production (see README.md). */
export function isOtpDevLogEnabled(): boolean {
  return process.env.OTP_DEV_LOG === "true";
}

export function getSmtpFrom(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@crm-ban-hang.local";
}

export const OTP_CODE_LENGTH = 6;
export const OTP_TTL_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
