import { DEFAULT_ROLE_PERMISSIONS, DEFAULT_ROLES, PERMISSIONS } from "./permissions";
import { getPrisma } from "./prisma";

/** Idempotent: roles + permission codes + assignments + otp_mode=off. */
export async function seedRolesAndSettings(): Promise<void> {
  const prisma = getPrisma();
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      create: { code: p.code, module: p.module, description: p.description },
      update: { module: p.module, description: p.description },
    });
  }
  for (const role of DEFAULT_ROLES) {
    const saved = await prisma.role.upsert({
      where: { code: role.code },
      create: { code: role.code, name: role.name, description: role.description, isSystemRole: true },
      update: { name: role.name, description: role.description, isSystemRole: true },
    });
    for (const code of DEFAULT_ROLE_PERMISSIONS[role.code] ?? []) {
      const perm = await prisma.permission.findUnique({ where: { code } });
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: saved.id, permissionId: perm.id } },
        create: { roleId: saved.id, permissionId: perm.id },
        update: {},
      });
    }
  }
  await prisma.systemSetting.upsert({
    where: { key: "otp_mode" },
    create: { key: "otp_mode", value: "off", description: "Chế độ OTP đăng nhập: off (mặc định) hoặc email" },
    update: {},
  });
}
