import "dotenv/config";
import { getPrisma } from "./lib/prisma";
import { seedRolesAndSettings } from "./lib/seedRoles";

/**
 * Idempotent seed: 5 default roles + all system permission codes +
 * their role assignments + otp_mode=off. Safe to run repeatedly.
 * Requires DATABASE_URL. Does NOT create any user — see seedAdmin.ts.
 */
async function main() {
  await seedRolesAndSettings();
  console.log("[seed] Done: 5 roles, permissions, otp_mode=off (existing values kept).");
}

main()
  .catch((err) => {
    console.error("[seed] Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await getPrisma().$disconnect();
    } catch {
      // ignore disconnect errors on failure path
    }
  });
