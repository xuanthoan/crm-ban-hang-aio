import nodemailer from "nodemailer";
import { getSmtpFrom, isOtpDevLogEnabled, isSmtpConfigured } from "./config";

export function canSendOtpEmail(): boolean {
  return isSmtpConfigured() || isOtpDevLogEnabled();
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  if (isOtpDevLogEnabled()) {
    // DEV ONLY. Never enable OTP_DEV_LOG in production: it would print
    // login codes into server logs. See README.md.
    console.warn(
      `[otp-dev] OTP_DEV_LOG is ON — code for ${to} is ${code}. ` +
        "Disable OTP_DEV_LOG in production.",
    );
    return;
  }
  if (!isSmtpConfigured()) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in " +
        "backend/.env (or Compose environment) before enabling email OTP.",
    );
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: getSmtpFrom(),
    to,
    subject: "Mã đăng nhập CRM_Ban_Hang",
    text:
      `Mã đăng nhập của bạn là: ${code}\n` +
      "Mã có hiệu lực 5 phút. Không chia sẻ mã này cho bất kỳ ai.",
  });
}
