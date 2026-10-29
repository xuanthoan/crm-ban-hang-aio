import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getJwtExpiresIn, getJwtSecret } from "./config";

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 12);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function hashOtpCode(code: string): string {
  return bcrypt.hashSync(code, 10);
}

export function verifyOtpCode(code: string, hash: string): boolean {
  return bcrypt.compareSync(code, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: getJwtExpiresIn() } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
  if (!decoded || typeof decoded.userId !== "string") {
    throw new Error("Invalid token payload");
  }
  return decoded;
}

export function generateOtpCode(): string {
  // 6 digits, first digit never 0 so the code is always 6 characters long.
  const n = 100000 + Math.floor(Math.random() * 900000);
  return String(n);
}

export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return "***";
  const local = email.slice(0, at);
  const shown = local.length <= 2 ? `${local[0]}*` : `${local[0]}***${local[local.length - 1]}`;
  return `${shown}${email.slice(at)}`;
}
