import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/auth";
import { getPrisma } from "../lib/prisma";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  status: string;
  role: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Public shape of a user — NEVER includes passwordHash. */
export function publicUser(u: {
  id: string;
  username: string;
  email: string;
  phone?: string | null;
  fullName: string;
  status: string;
  roleId: string;
  requireOtp?: boolean | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  role?: { code: string; name: string };
  permissions?: string[];
}) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    phone: u.phone ?? null,
    fullName: u.fullName,
    status: u.status,
    roleId: u.roleId,
    role: u.role?.code ?? null,
    roleName: u.role?.name ?? null,
    requireOtp: u.requireOtp ?? null,
    lastLoginAt: u.lastLoginAt ?? null,
    permissions: u.permissions ?? [],
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

async function loadPermissions(prisma: ReturnType<typeof getPrisma>, roleId: string): Promise<string[]> {
  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });
  return rows.map((r: { permission: { code: string } }) => r.permission.code);
}

/**
 * authenticate: missing/invalid/expired token -> 401, no data.
 * A locked or inactive user cannot use an old token either (locked rules §6).
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ status: "error", message: "Chưa đăng nhập. Vui lòng đăng nhập lại." });
      return;
    }
    const payload = verifyToken(header.slice("Bearer ".length));
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });
    if (!user || user.deletedAt) {
      res.status(401).json({ status: "error", message: "Tài khoản không còn tồn tại." });
      return;
    }
    if (user.status !== "active") {
      res.status(401).json({ status: "error", message: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên." });
      return;
    }
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      role: user.role.code,
      permissions: await loadPermissions(prisma, user.roleId),
    };
    next();
  } catch {
    res.status(401).json({ status: "error", message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });
  }
}

/**
 * authorize: the user must hold ALL listed permissions, otherwise 403
 * and no data is returned. Frontend hiding is never a substitute.
 */
export function authorize(...codes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ status: "error", message: "Chưa đăng nhập." });
      return;
    }
    const missing = codes.filter((c) => !req.user!.permissions.includes(c));
    if (missing.length > 0) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền thực hiện thao tác này." });
      return;
    }
    next();
  };
}
