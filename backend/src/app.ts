import express, { NextFunction, Request, Response } from "express";
import adminRouter from "./routes/admin";
import auditRouter from "./routes/audit";
import authRouter from "./routes/auth";
import customersRouter from "./routes/customers";
import inventoryRouter from "./routes/inventory";
import ordersRouter from "./routes/orders";
import paymentsRouter from "./routes/payments";
import productsRouter from "./routes/products";
import careRouter from "./routes/care";
import dashboardRouter from "./routes/dashboard";
import importExportRouter from "./routes/importExport";

/**
 * Sprint Auth app.
 * Health stays database-free. Auth/admin routes return a clear 503 when
 * DATABASE_URL is missing instead of crashing, so operators can tell
 * a missing-database problem apart from a code problem.
 */
export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  // Health endpoint: must work WITHOUT a database connection.
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", auditRouter);
  app.use("/api", customersRouter);
  app.use("/api", productsRouter);
  app.use("/api", inventoryRouter);
  app.use("/api", ordersRouter);
  app.use("/api", paymentsRouter);
  app.use("/api", careRouter);
  app.use("/api", dashboardRouter);
  app.use("/api", importExportRouter);

  // Catch-all for unknown API routes (not a business error).
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ status: "error", message: "Route not found" });
  });

  // Basic error middleware. Never leak stack traces / secrets in responses.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  });

  return app;
}

export default createApp;
