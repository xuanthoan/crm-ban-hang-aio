import { PrismaClient } from "@prisma/client";

// Lazy singleton: importing this module must NOT connect to the database,
// so /api/health keeps working without DATABASE_URL (Sprint 0.1 behaviour).
let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy backend/.env.example to backend/.env " +
        "and set DATABASE_URL (see README.md).",
    );
  }
  if (!client) {
    client = new PrismaClient();
  }
  return client;
}
