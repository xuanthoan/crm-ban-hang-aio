import "dotenv/config";
import { hashPassword } from "./lib/auth";
import { getPrisma } from "./lib/prisma";
import { seedRolesAndSettings } from "./lib/seedRoles";

/**
 * Creates the FIRST admin user, and only if no admin user exists yet.
 * Credentials come ONLY from environment variables — never from code:
 *   ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD (min 8 chars)
 * If any is missing, or an admin already exists, the script fails/does
 * nothing with a clear message instead of inventing a default password.
 */
async function main() {
  const username = process.env.ADMIN_USERNAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !email || !password) {
    console.error(
      "[seed:admin] Missing ADMIN_USERNAME, ADMIN_EMAIL or ADMIN_PASSWORD. " +
        "Set them in backend/.env (or Compose environment) and run again. " +
        "No admin was created.",
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("[seed:admin] ADMIN_PASSWORD must be at least 8 characters. No admin was created.");
    process.exit(1);
  }
  const prisma = getPrisma();
  try {
    // Ensure roles/permissions exist first (idempotent).
    await seedRolesAndSettings();
    const adminRole = await prisma.role.findUnique({ where: { code: "admin" } });
    if (!adminRole) {
      console.error("[seed:admin] Admin role not found after seeding. Aborting.");
      process.exit(1);
    }
    const existingAdmin = await prisma.user.findFirst({
      where: { roleId: adminRole.id, deletedAt: null },
    });
    if (existingAdmin) {
      console.log(`[seed:admin] An admin already exists (${existingAdmin.username}). No new admin created.`);
      return;
    }
    const clash = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }], deletedAt: null },
    });
    if (clash) {
      console.error(`[seed:admin] Username or email already used by a non-admin user (${clash.username}). No admin was created.`);
      process.exit(1);
    }
    await prisma.user.create({
      data: {
        username,
        email,
        fullName: "Admin",
        passwordHash: hashPassword(password),
        roleId: adminRole.id,
        status: "active",
      },
    });
    console.log(`[seed:admin] Admin user created: ${username} (password from ADMIN_PASSWORD, not stored in code).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[seed:admin] Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
