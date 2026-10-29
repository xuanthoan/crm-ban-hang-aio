import "dotenv/config";
import { getJwtSecret } from "./lib/config";

const PORT = Number(process.env.PORT) || 3001;
const DATABASE_URL = process.env.DATABASE_URL;

// Dynamic import on purpose: the JWT_SECRET check must run BEFORE any
// module that imports @prisma/client is loaded, so a missing secret is
// always reported clearly instead of being masked by another import error.
// No hard-coded fallback secret: refusing to start is safer than running
// with a guessable token secret.
async function main() {
  try {
    getJwtSecret();
  } catch (err) {
    console.error(`[backend] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  if (!DATABASE_URL) {
    // Health check does not need the database, so this is only a warning.
    // Auth/admin routes return 503 with a clear message until DATABASE_URL
    // is set and PostgreSQL is reachable.
    console.warn("[backend] DATABASE_URL is not set (see backend/.env.example). /api/health still works, /api/auth and /api/admin will return 503.");
  }

  const { createApp } = await import("./app");
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[backend] CRM_Ban_Hang API listening on http://localhost:${PORT}`);
    console.log(`[backend] Health: http://localhost:${PORT}/api/health`);
  });
}

main();
