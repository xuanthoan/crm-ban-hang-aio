/**
 * Import / Export API — Sprint Import/Export.
 *
 * MVP format is CSV UTF-8 only (see README/DEVELOPMENT_PLAN): .xlsx is
 * a later backlog item, not added here. Import is ALWAYS two steps:
 *  1. preview — validate every row (format, in-file duplicates, database
 *     duplicates) and return valid/invalid rows WITHOUT writing data;
 *  2. confirm — re-validate everything against the CURRENT database
 *     (never trust the preview), then write valid rows, skipping any
 *     row that became invalid in the meantime instead of rolling back
 *     the whole file for one row's sake.
 *
 * Locked rules applied here:
 *  §4.1 phones: unlimited phones per customer, normalized before
 *       comparison, duplicates across ALL phones (in-file + database
 *       + within one row) make the row invalid.
 *  §4.2 SKUs: user-entered duplicates are errors, never silently
 *       renamed; empty SKUs are system-generated (-002, -003, ...).
 *  §5   no hard delete anywhere in this sprint; import creates or
 *       adds variants, never deletes existing rows.
 *  §6   backend permission + scope checks on every route, and export
 *       columns are FILTERED server-side: a user without view_cost
 *       gets no import_price column at all (not a zero), a user with
 *       only view_own exports only their own customers/orders.
 *  Export cells starting with =, +, -, @, tab or newline are prefixed
 *  with ' so a spreadsheet cannot execute them (CSV injection guard,
 *  see lib/csv.ts).
 */

import express, { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { CsvError, decimalToString, isoDate, parseCsv, toCsv } from "../lib/csv";
import { MultipartError, parseMultipart } from "../lib/multipart";
import { duplicateErrorMessage, findDuplicatePhone } from "../lib/customers";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  PREVIEW_TTL_MS,
  findInFileBarcodeDuplicates,
  findInFilePhoneDuplicates,
  findInFileSkuDuplicates,
  groupProductRows,
  resolveGeneratedSku,
  validateCustomerRow,
  validateProductRow,
  type ValidatedCustomerRow,
  type ValidatedProductRow,
} from "../lib/importExport";
import { normalizeSku, variantSkuBase } from "../lib/products";
import { getPrisma } from "../lib/prisma";

type AnyTx = any;
type AnyReq = import("express").Request;
type AnyRes = import("express").Response;

const router = Router();
router.use(authenticate);

function dbUnavailable(res: AnyRes, err: unknown) {
  console.error("[import-export] database error:", err);
  res.status(503).json({
    status: "error",
    message: "Chưa kết nối được database. Hãy chạy PostgreSQL (docker compose up -d postgres) rồi thử lại.",
  });
}

function has(req: AnyReq, code: string): boolean {
  return req.user!.permissions.includes(code);
}

function prunePreviews() {
  const now = Date.now();
  for (const [id, preview] of previews) {
    if (now - preview.createdAt > PREVIEW_TTL_MS) previews.delete(id);
  }
}

/** In-memory preview store: preview_id -> validated valid rows. */
interface Preview {
  id: string;
  entity: "customers" | "products";
  userId: string;
  rows: (ValidatedCustomerRow | ValidatedProductRow)[];
  totalRows: number;
  createdAt: number;
}
const previews = new Map<string, Preview>();

function newPreviewId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const CUSTOMER_HEADERS = ["name", "phones", "email", "address", "source", "tags", "status", "note"];
const PRODUCT_HEADERS = ["product_name", "category", "sku", "variant_name", "attributes", "sell_price", "import_price", "barcode", "status"];

const CUSTOMER_TEMPLATE_ROWS: string[][] = [
  ["Nguyễn Văn A", "0987884244;0901234567", "a@example.com", "123 Đường Lớn, Quận 1", "facebook", "VIP;Mua sỉ", "active", "Khách quen"],
  ["Trần Thị B", "0912345678", "", "", "walk_in", "", "active", ""],
];
const PRODUCT_TEMPLATE_ROWS: (string | number)[][] = [
  ["Áo thun nữ 2027", "Áo thun", "AO-THUN-NU-2027-DEN-S", "Đen / S", "color:Đen;size:S", 150000, 90000, "", "active"],
  ["Sách thiếu nhi tập 1", "Sách", "", "Mặc định", "", 50000, 30000, "", "active"],
];

/** GET /api/import/templates/:entity — CSV template (header + example rows). */
router.get("/import/templates/:entity", async (req: AnyReq, res: AnyRes) => {
  try {
    const entity = req.params.entity;
    if (entity !== "customers" && entity !== "products") {
      res.status(400).json({ status: "error", message: "Entity chỉ nhận customers hoặc products." });
      return;
    }
    if (entity === "customers" && !has(req, "customer.import")) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền import khách hàng." });
      return;
    }
    if (entity === "products" && !has(req, "product.import")) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền import sản phẩm." });
      return;
    }
    const headers = entity === "customers" ? CUSTOMER_HEADERS : PRODUCT_HEADERS;
    const rows = entity === "customers" ? CUSTOMER_TEMPLATE_ROWS : PRODUCT_TEMPLATE_ROWS;
    const csv = `\uFEFF${toCsv(headers, rows)}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="template-${entity}.csv"`);
    res.send(csv);
  } catch (err) {
    dbUnavailable(res, err);
  }
});

function readUploadedCsv(req: AnyReq): { text: string; filename: string } {
  const body = req.body as Buffer | undefined;
  if (!body || !Buffer.isBuffer(body)) {
    throw new MultipartError("Không nhận được file. Hãy gửi file CSV qua form multipart (field: file).");
  }
  if (body.length > MAX_IMPORT_BYTES) {
    throw new MultipartError(`File vượt giới hạn ${MAX_IMPORT_BYTES / 1024 / 1024}MB.`);
  }
  const files = parseMultipart(body, req.headers["content-type"]);
  const file = files.find((f) => f.fieldName === "file") ?? files[0];
  if (!file) throw new MultipartError("Không tìm thấy file trong form (field: file).");
  if (!file.filename.toLowerCase().endsWith(".csv")) {
    throw new MultipartError("Chỉ nhận file .csv (UTF-8).");
  }
  return { text: file.content.toString("utf8"), filename: file.filename };
}

function checkRowLimit(rows: unknown[]): void {
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new CsvError(`File vượt giới hạn ${MAX_IMPORT_ROWS} dòng dữ liệu (file có ${rows.length} dòng).`);
  }
}

function checkHeaders(headers: string[], required: string[], entity: string): void {
  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    throw new CsvError(
      `Thiếu cột bắt buộc trong file ${entity}: ${missing.join(", ")}. ` +
        `Header cần có: ${headers.join(", ")} (tải file mẫu tại GET /api/import/templates/${entity}).`,
    );
  }
}

async function previewCustomers(req: AnyReq, text: string): Promise<{ total: number; rows: { row_number: number; valid: boolean; errors: string[]; data: ValidatedCustomerRow }[]; validRows: ValidatedCustomerRow[] }> {
  const parsed = parseCsv(text);
  checkHeaders(parsed.headers, ["name", "phones"], "customers");
  checkRowLimit(parsed.rows);
  const prisma = getPrisma();
  const validated = parsed.rows.map((row, idx) => validateCustomerRow(row, idx + 2));
  // In-file duplicates.
  const inFile = findInFilePhoneDuplicates(validated);
  for (const row of validated) {
    for (const phone of row.phones) {
      const lines = inFile.get(phone.phoneNormalized);
      if (lines && lines.length > 1) {
        row.errors.push(`Số ${phone.phoneNormalized} bị trùng với dòng ${lines.filter((l) => l !== row.rowNumber).join(", ")} trong cùng file.`);
      }
    }
  }
  // Database duplicates (active phones of non-deleted customers only,
  // same rule as Sprint Customer).
  const allPhones = [...new Set(validated.flatMap((r) => r.phones.map((p) => p.phoneNormalized)))];
  if (allPhones.length > 0) {
    const existing = await prisma.customerPhone.findMany({
      where: { phoneNormalized: { in: allPhones }, status: "active", deletedAt: null, customer: { deletedAt: null } },
      include: { customer: { select: { id: true, fullName: true } } },
    });
    const byPhone = new Map<string, any>(existing.map((e: any) => [e.phoneNormalized, e]));
    for (const row of validated) {
      for (const phone of row.phones) {
        const hit = byPhone.get(phone.phoneNormalized);
        if (hit) row.errors.push(duplicateErrorMessage({ phone: hit.phone, phoneNormalized: hit.phoneNormalized, customerId: hit.customer.id, customerName: hit.customer.fullName || "(chưa có tên)" }));
      }
    }
  }
  // Tags: unknown tags need tag_manage, otherwise the row is invalid.
  const allTags = [...new Set(validated.flatMap((r) => r.tags.map((t) => t.toLowerCase())))];
  let existingTags = new Set<string>();
  if (allTags.length > 0) {
    const tags = await prisma.customerTag.findMany({ where: { deletedAt: null } });
    existingTags = new Set(tags.map((t: any) => String(t.name).toLowerCase()));
  }
  const canManageTags = has(req, "customer.tag_manage");
  for (const row of validated) {
    for (const tag of row.tags) {
      if (!existingTags.has(tag.toLowerCase()) && !canManageTags) {
        row.errors.push(`Tag "${tag}" chưa tồn tại và bạn không có quyền tạo tag mới (customer.tag_manage).`);
      }
    }
  }
  const rows = validated.map((row) => ({ row_number: row.rowNumber, valid: row.errors.length === 0, errors: [...new Set(row.errors)], data: { ...row, errors: [...new Set(row.errors)] } }));
  return { total: validated.length, rows, validRows: validated.filter((r) => r.errors.length === 0) };
}

async function previewProducts(req: AnyReq, text: string): Promise<{ total: number; rows: { row_number: number; valid: boolean; errors: string[]; data: ValidatedProductRow }[]; validRows: ValidatedProductRow[] }> {
  const parsed = parseCsv(text);
  checkHeaders(parsed.headers, ["product_name", "sell_price"], "products");
  checkRowLimit(parsed.rows);
  const prisma = getPrisma();
  const validated = parsed.rows.map((row, idx) => validateProductRow(row, idx + 2));
  const inFileSku = findInFileSkuDuplicates(validated);
  const inFileBarcode = findInFileBarcodeDuplicates(validated);
  for (const row of validated) {
    if (row.skuEntered) {
      const lines = inFileSku.get(row.sku);
      if (lines && lines.length > 1) row.errors.push(`SKU ${row.sku} bị trùng với dòng ${lines.filter((l) => l !== row.rowNumber).join(", ")} trong cùng file.`);
    }
    if (row.barcode) {
      const lines = inFileBarcode.get(row.barcode);
      if (lines && lines.length > 1) row.errors.push(`Mã vạch ${row.barcode} bị trùng với dòng ${lines.filter((l) => l !== row.rowNumber).join(", ")} trong cùng file.`);
    }
  }
  const enteredSkus = [...new Set(validated.filter((r) => r.skuEntered).map((r) => r.sku))];
  if (enteredSkus.length > 0) {
    const existing = await prisma.productVariant.findMany({
      where: { sku: { in: enteredSkus } },
      include: { product: { select: { name: true } } },
    });
    const bySku = new Map<string, any>(existing.map((e: any) => [e.sku, e]));
    for (const row of validated) {
      if (!row.skuEntered) continue;
      const hit = bySku.get(row.sku);
      if (hit) row.errors.push(`SKU ${row.sku} đã tồn tại ở sản phẩm "${hit.product?.name ?? ""}" (biến thể "${hit.variantName}"). Hệ thống không tự đổi mã của bạn.`);
    }
  }
  const barcodes = [...new Set(validated.filter((r) => r.barcode).map((r) => r.barcode as string))];
  if (barcodes.length > 0) {
    const existing = await prisma.productVariant.findMany({ where: { barcode: { in: barcodes } } });
    const byBarcode = new Set(existing.map((e: any) => e.barcode));
    for (const row of validated) {
      if (row.barcode && byBarcode.has(row.barcode)) row.errors.push(`Mã vạch ${row.barcode} đã tồn tại trong hệ thống.`);
    }
  }
  const rows = validated.map((row) => ({ row_number: row.rowNumber, valid: row.errors.length === 0, errors: [...new Set(row.errors)], data: { ...row, errors: [...new Set(row.errors)] } }));
  return { total: validated.length, rows, validRows: validated.filter((r) => r.errors.length === 0) };
}

const rawBody = express.raw({ type: "multipart/form-data", limit: "5mb" });

/** POST /api/import/:entity/preview — validate only, writes nothing. */
router.post(
  "/import/:entity/preview",
  (req: AnyReq, res: AnyRes, next: (err?: unknown) => void) => {
    const entity = req.params.entity;
    if (entity === "customers" && !has(req, "customer.import")) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền import khách hàng." });
      return;
    }
    if (entity === "products" && !has(req, "product.import")) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền import sản phẩm." });
      return;
    }
    if (entity !== "customers" && entity !== "products") {
      res.status(400).json({ status: "error", message: "Entity chỉ nhận customers hoặc products." });
      return;
    }
    next();
  },
  rawBody,
  async (req: AnyReq, res: AnyRes) => {
    try {
      const entity = req.params.entity as "customers" | "products";
      const { text } = readUploadedCsv(req);
      const result = entity === "customers" ? await previewCustomers(req, text) : await previewProducts(req, text);
      prunePreviews();
      const preview: Preview = {
        id: newPreviewId(),
        entity,
        userId: req.user!.id,
        rows: result.validRows,
        totalRows: result.total,
        createdAt: Date.now(),
      };
      previews.set(preview.id, preview);
      res.json({
        status: "ok",
        preview_id: preview.id,
        entity,
        total_rows: result.total,
        valid_count: result.validRows.length,
        invalid_count: result.total - result.validRows.length,
        expires_in_seconds: Math.floor(PREVIEW_TTL_MS / 1000),
        note: "Đây chỉ là preview, chưa ghi dữ liệu. Gửi preview_id tới POST /api/import/:entity/confirm để nhập các dòng valid.",
        rows: result.rows,
      });
    } catch (err) {
      if (err instanceof CsvError || err instanceof MultipartError) {
        res.status(400).json({ status: "error", message: err.message });
        return;
      }
      dbUnavailable(res, err);
    }
  },
);

/** Re-check one stored customer row against the CURRENT database. */
async function revalidateCustomerRow(prisma: AnyTx, row: ValidatedCustomerRow, canManageTags: boolean): Promise<string[]> {
  const errors: string[] = [];
  if (!row.name && row.phones.length === 0) errors.push("Khách hàng cần có họ tên hoặc ít nhất một số điện thoại.");
  const conflict = await findDuplicatePhone(prisma, row.phones.map((p) => p.phoneNormalized));
  if (conflict) errors.push(duplicateErrorMessage(conflict));
  if (row.tags.length > 0) {
    const tags = await prisma.customerTag.findMany({ where: { deletedAt: null } });
    const existing = new Set(tags.map((t: any) => String(t.name).toLowerCase()));
    for (const tag of row.tags) {
      if (!existing.has(tag.toLowerCase()) && !canManageTags) errors.push(`Tag "${tag}" chưa tồn tại và bạn không có quyền tạo tag mới.`);
    }
  }
  return errors;
}

async function confirmCustomers(req: AnyReq, preview: Preview): Promise<{ imported: { id: string; name: string }[]; skipped: { row_number: number; name: string; errors: string[] }[] }> {
  const prisma = getPrisma();
  const canManageTags = has(req, "customer.tag_manage");
  const imported: { id: string; name: string }[] = [];
  const skipped: { row_number: number; name: string; errors: string[] }[] = [];
  for (const row of preview.rows as ValidatedCustomerRow[]) {
    const errors = await revalidateCustomerRow(prisma, row, canManageTags);
    if (errors.length > 0) {
      skipped.push({ row_number: row.rowNumber, name: row.name, errors });
      continue;
    }
    try {
      const created = await prisma.$transaction(async (tx: AnyTx) => {
        const tagIds: string[] = [];
        for (const tagName of row.tags) {
          const existing = await tx.customerTag.findMany({ where: { deletedAt: null } });
          const hit = existing.find((t: any) => String(t.name).toLowerCase() === tagName.toLowerCase());
          if (hit) tagIds.push(hit.id);
          else if (canManageTags) {
            const createdTag = await tx.customerTag.create({ data: { name: tagName } });
            tagIds.push(createdTag.id);
          }
        }
        return tx.customer.create({
          data: {
            fullName: row.name,
            email: row.email,
            address: row.address,
            source: row.source,
            status: row.status,
            note: row.note,
            createdById: req.user!.id,
            phones: { create: row.phones.map((p) => ({ phone: p.phone, phoneNormalized: p.phoneNormalized, label: p.label, isPrimary: p.isPrimary, status: "active" })) },
            tagLinks: { create: tagIds.map((tagId) => ({ tagId })) },
          },
        });
      });
      imported.push({ id: created.id, name: created.fullName });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002") {
        skipped.push({ row_number: row.rowNumber, name: row.name, errors: ["Dữ liệu bị trùng với database (số điện thoại/tag) tại thời điểm xác nhận."] });
      } else {
        console.error("[import] customer row failed:", err);
        skipped.push({ row_number: row.rowNumber, name: row.name, errors: ["Lỗi hệ thống khi nhập dòng này, dòng đã bị bỏ qua."] });
      }
    }
  }
  return { imported, skipped };
}

function combinationKeyOf(attributes: { name: string; value: string }[]): string {
  return attributes.map((a) => `${a.name.trim().toLowerCase()}=${a.value.trim().toLowerCase()}`).join("|");
}

async function confirmProducts(req: AnyReq, preview: Preview): Promise<{ imported: { product: string; sku: string }[]; skipped: { row_number: number; name: string; errors: string[] }[] }> {
  const prisma = getPrisma();
  const imported: { product: string; sku: string }[] = [];
  const skipped: { row_number: number; name: string; errors: string[] }[] = [];
  const groups = groupProductRows(preview.rows as ValidatedProductRow[]);
  for (const group of groups) {
    // Find an existing parent product (same name + category, case-insensitive).
    const candidates = await prisma.product.findMany({ where: { deletedAt: null }, include: { category: true, variants: true } });
    let product: any = candidates.find((p: any) => {
      const nameMatch = String(p.name).toLowerCase() === group.productName.toLowerCase();
      const catName = p.category ? String(p.category.name).toLowerCase() : "";
      return nameMatch && catName === (group.categoryName ?? "").toLowerCase();
    });
    if (!product) {
      let categoryId: string | null = null;
      if (group.categoryName) {
        const cats = await prisma.category.findMany({ where: { deletedAt: null } });
        const hit = cats.find((c: any) => String(c.name).toLowerCase() === group.categoryName!.toLowerCase());
        if (hit) categoryId = hit.id;
        else {
          const createdCat = await prisma.category.create({ data: { name: group.categoryName } });
          categoryId = createdCat.id;
        }
      }
      product = await prisma.product.create({
        data: { name: group.productName, categoryId, status: group.rows[0].status },
        include: { category: true, variants: true } as never,
      });
      product.variants = [];
    }
    const existingKeys = new Set((product.variants ?? []).map((v: any) => combinationKeyOf(Array.isArray(v.attributes) ? v.attributes : [])));
    const hasDefault = (product.variants ?? []).some((v: any) => v.isDefault);
    let createdInGroup = 0;
    for (const row of group.rows) {
      const key = combinationKeyOf(row.attributes);
      if (existingKeys.has(key)) {
        skipped.push({ row_number: row.rowNumber, name: row.productName, errors: [`Biến thể "${row.variantName}" (thuộc tính ${key || "mặc định"}) đã tồn tại ở sản phẩm này.`] });
        continue;
      }
      try {
        let sku: string;
        if (row.skuEntered) {
          const hit = await prisma.productVariant.findUnique({ where: { sku: normalizeSku(row.sku) } });
          if (hit) {
            skipped.push({ row_number: row.rowNumber, name: row.productName, errors: [`SKU ${row.sku} đã tồn tại trong database tại thời điểm xác nhận.`] });
            continue;
          }
          sku = normalizeSku(row.sku);
        } else {
          const like = await prisma.productVariant.findMany({ where: { sku: { startsWith: normalizeSku(variantSkuBase(group.productName, row.attributes)) } } });
          const taken = new Set<string>(like.map((v: any) => String(v.sku)));
          sku = resolveGeneratedSku(group.productName, row.attributes, taken);
        }
        const isDefault = row.attributes.length === 0 && !hasDefault && createdInGroup === 0 && (product.variants ?? []).length === 0;
        const variant = await prisma.$transaction(async (tx: AnyTx) => {
          const created = await tx.productVariant.create({
            data: {
              productId: product.id,
              sku,
              variantName: row.variantName,
              attributes: row.attributes.length > 0 ? row.attributes : undefined,
              sellingPrice: row.sellingPrice,
              importPrice: row.importPrice,
              barcode: row.barcode,
              status: row.status,
              isDefault,
            },
          });
          await tx.inventoryItem.create({ data: { variantId: created.id, quantity: 0, reservedQuantity: 0 } });
          return created;
        });
        existingKeys.add(key);
        createdInGroup += 1;
        imported.push({ product: group.productName, sku: variant.sku });
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "P2002") {
          skipped.push({ row_number: row.rowNumber, name: row.productName, errors: ["SKU hoặc mã vạch bị trùng với database tại thời điểm xác nhận."] });
        } else {
          console.error("[import] product row failed:", err);
          skipped.push({ row_number: row.rowNumber, name: row.productName, errors: ["Lỗi hệ thống khi nhập dòng này, dòng đã bị bỏ qua."] });
        }
      }
    }
  }
  return { imported, skipped };
}

/** POST /api/import/:entity/confirm — re-validate, then write valid rows. */
router.post("/import/:entity/confirm", async (req: AnyReq, res: AnyRes) => {
  try {
    const entity = req.params.entity;
    if (entity !== "customers" && entity !== "products") {
      res.status(400).json({ status: "error", message: "Entity chỉ nhận customers hoặc products." });
      return;
    }
    if (entity === "customers" && !has(req, "customer.import")) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền import khách hàng." });
      return;
    }
    if (entity === "products" && !has(req, "product.import")) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền import sản phẩm." });
      return;
    }
    const previewId = typeof req.body?.preview_id === "string" ? req.body.preview_id : "";
    if (!previewId) {
      res.status(400).json({ status: "error", message: "Thiếu preview_id. Hãy gọi preview trước rồi mới confirm." });
      return;
    }
    prunePreviews();
    const preview = previews.get(previewId);
    if (!preview || preview.entity !== entity) {
      res.status(404).json({ status: "error", message: "Preview không tồn tại hoặc đã hết hạn. Vui lòng tải lại file và preview lại." });
      return;
    }
    if (preview.userId !== req.user!.id) {
      res.status(403).json({ status: "error", message: "Preview này thuộc về người dùng khác." });
      return;
    }
    const result = entity === "customers" ? await confirmCustomers(req, preview) : await confirmProducts(req, preview);
    previews.delete(previewId);
    const prisma = getPrisma();
    await writeAudit(prisma, {
      actorId: req.user!.id,
      action: "import.confirm",
      entityType: "import",
      entityId: previewId,
      newValue: { entity, totalRows: preview.totalRows, imported: result.imported.length, skipped: result.skipped.length },
      ipAddress: req.ip ?? null,
    });
    res.json({
      status: "ok",
      entity,
      total_rows: preview.totalRows,
      imported_count: result.imported.length,
      skipped_count: result.skipped.length,
      imported: result.imported,
      skipped: result.skipped,
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

function sendCsv(res: AnyRes, filename: string, headers: string[], rows: (string | number | null | undefined)[][]): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(`\uFEFF${toCsv(headers, rows)}`);
}

function exportDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** GET /api/export/customers — full-customer export is a sensitive op: customer.export only. */
router.get("/export/customers", authorize("customer.export"), async (req: AnyReq, res: AnyRes) => {
  try {
    const prisma = getPrisma();
    const viewAll = has(req, "customer.view_all");
    const viewOwn = has(req, "customer.view_own");
    if (!viewAll && !viewOwn) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem khách hàng." });
      return;
    }
    const scope = viewAll ? {} : { OR: [{ createdById: req.user!.id }, { assignedToId: req.user!.id }] };
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const where: Record<string, unknown> = { deletedAt: null, ...scope };
    if (q) where.OR = [{ fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }];
    if (typeof req.query.status === "string" && req.query.status) where.status = req.query.status;
    const customers = await prisma.customer.findMany({
      where,
      include: {
        phones: { where: { status: "active", deletedAt: null } },
        tagLinks: { include: { tag: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const showDebt = has(req, "debt.view_all") || has(req, "debt.view_own");
    let debtByCustomer = new Map<string, number>();
    if (showDebt) {
      const orders = await prisma.order.findMany({
        where: { customerId: { in: customers.map((c: any) => c.id) }, status: { in: ["confirmed", "completed"] }, deletedAt: null },
        select: { customerId: true, debtTotal: true },
      });
      for (const o of orders) {
        debtByCustomer.set(o.customerId, (debtByCustomer.get(o.customerId) ?? 0) + Number(o.debtTotal));
      }
    }
    const headers = ["name", "phones", "email", "address", "source", "tags", "status", ...(showDebt ? ["debt_total"] : []), "created_at"];
    const rows = customers.map((c: any) => [
      c.fullName,
      c.phones.map((p: any) => p.phone).join(";"),
      c.email ?? "",
      c.address ?? "",
      c.source ?? "",
      c.tagLinks.map((l: any) => l.tag?.name).filter(Boolean).join(";"),
      c.status,
      ...(showDebt ? [debtByCustomer.get(c.id) ?? 0] : []),
      isoDate(c.createdAt),
    ]);
    await writeAudit(prisma, { actorId: req.user!.id, action: "export", entityType: "export", entityId: "customers", newValue: { entity: "customers", filters: { q, status: req.query.status ?? null }, rowCount: rows.length }, ipAddress: req.ip ?? null });
    sendCsv(res, `customers-${exportDate()}.csv`, headers, rows);
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** GET /api/export/products — import_price column omitted entirely without view_cost. */
router.get("/export/products", authorize("product.export"), async (req: AnyReq, res: AnyRes) => {
  try {
    const prisma = getPrisma();
    const canCost = has(req, "product.view_cost");
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const where: Record<string, unknown> = { deletedAt: null };
    if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { variants: { some: { sku: { contains: q, mode: "insensitive" } } } }];
    if (typeof req.query.categoryId === "string" && req.query.categoryId) where.categoryId = req.query.categoryId;
    if (typeof req.query.status === "string" && req.query.status) where.status = req.query.status;
    const products = await prisma.product.findMany({
      where,
      include: { category: true, variants: { where: { deletedAt: null }, include: { inventoryItem: true } } },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const headers = ["product_name", "category", "sku", "variant_name", "attributes", "sell_price", ...(canCost ? ["import_price"] : []), "stock_quantity", "status"];
    const rows: (string | number | null | undefined)[][] = [];
    for (const p of products) {
      for (const v of p.variants) {
        const attrs = Array.isArray(v.attributes) ? v.attributes.map((a: any) => `${a.name}:${a.value}`).join(";") : "";
        rows.push([
          p.name,
          p.category?.name ?? "",
          v.sku,
          v.variantName,
          attrs,
          decimalToString(v.sellingPrice),
          ...(canCost ? [decimalToString(v.importPrice)] : []),
          v.inventoryItem?.quantity ?? 0,
          v.status,
        ]);
      }
    }
    await writeAudit(prisma, { actorId: req.user!.id, action: "export", entityType: "export", entityId: "products", newValue: { entity: "products", filters: { q }, rowCount: rows.length }, ipAddress: req.ip ?? null });
    sendCsv(res, `products-${exportDate()}.csv`, headers, rows);
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** GET /api/export/orders — money columns omitted without debt/revenue view rights. */
router.get("/export/orders", authorize("order.export"), async (req: AnyReq, res: AnyRes) => {
  try {
    const prisma = getPrisma();
    const viewAll = has(req, "order.view_all");
    const viewOwn = has(req, "order.view_own");
    if (!viewAll && !viewOwn) {
      res.status(403).json({ status: "error", message: "Bạn không có quyền xem đơn hàng." });
      return;
    }
    const moneyAllowed = has(req, "debt.view_all") || has(req, "report.view_revenue") || viewAll;
    const where: Record<string, unknown> = { deletedAt: null, ...(viewAll ? {} : { createdById: req.user!.id }) };
    if (typeof req.query.status === "string" && req.query.status) where.status = req.query.status;
    if (typeof req.query.customerId === "string" && req.query.customerId) where.customerId = req.query.customerId;
    if (typeof req.query.from === "string" && req.query.from) where.createdAt = { ...(where.createdAt as object ?? {}), gte: new Date(req.query.from) };
    if (typeof req.query.to === "string" && req.query.to) where.createdAt = { ...(where.createdAt as object ?? {}), lte: new Date(req.query.to) };
    const orders = await prisma.order.findMany({ where, include: { customer: true }, orderBy: { createdAt: "desc" }, take: 10000 });
    const headers = ["order_code", "customer_name", "order_date", "status", ...(moneyAllowed ? ["grand_total", "paid_total", "debt_total", "payment_status"] : [])];
    const rows = orders.map((o: any) => [
      o.orderCode,
      o.customer?.fullName ?? "",
      isoDate(o.createdAt),
      o.status,
      ...(moneyAllowed ? [decimalToString(o.grandTotal), decimalToString(o.paidTotal), decimalToString(o.debtTotal), o.paymentStatus] : []),
    ]);
    await writeAudit(prisma, { actorId: req.user!.id, action: "export", entityType: "export", entityId: "orders", newValue: { entity: "orders", rowCount: rows.length }, ipAddress: req.ip ?? null });
    sendCsv(res, `orders-${exportDate()}.csv`, headers, rows);
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** GET /api/export/inventory — value column only with inventory value rights. */
router.get("/export/inventory", authorize("inventory.view"), async (req: AnyReq, res: AnyRes) => {
  try {
    const prisma = getPrisma();
    const canValue = has(req, "inventory.view_value") || has(req, "report.view_inventory_value");
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const where: Record<string, unknown> = { deletedAt: null };
    if (q) where.OR = [{ sku: { contains: q, mode: "insensitive" } }, { product: { name: { contains: q, mode: "insensitive" } } }];
    if (typeof req.query.categoryId === "string" && req.query.categoryId) where.product = { categoryId: req.query.categoryId };
    const variants = await prisma.productVariant.findMany({
      where,
      include: { product: true, inventoryItem: true },
      orderBy: { sku: "asc" },
      take: 10000,
    });
    const maxQuantity = typeof req.query.maxQuantity === "string" ? Number(req.query.maxQuantity) : NaN;
    const headers = ["sku", "product_name", "variant_name", "quantity", "reserved_quantity", "status", ...(canValue ? ["inventory_value"] : [])];
    const rows: (string | number | null | undefined)[][] = [];
    for (const v of variants) {
      const qty = v.inventoryItem?.quantity ?? 0;
      if (!Number.isNaN(maxQuantity) && qty > maxQuantity) continue;
      const importPrice = v.importPrice === null || v.importPrice === undefined ? 0 : Number(v.importPrice);
      rows.push([
        v.sku,
        v.product?.name ?? "",
        v.variantName,
        qty,
        v.inventoryItem?.reservedQuantity ?? 0,
        v.status,
        ...(canValue ? [qty * importPrice] : []),
      ]);
    }
    await writeAudit(prisma, { actorId: req.user!.id, action: "export", entityType: "export", entityId: "inventory", newValue: { entity: "inventory", rowCount: rows.length }, ipAddress: req.ip ?? null });
    sendCsv(res, `inventory-${exportDate()}.csv`, headers, rows);
  } catch (err) {
    dbUnavailable(res, err);
  }
});

// File-size / body-parser errors from the preview upload: 413, not a generic 500.
router.use((err: any, _req: AnyReq, res: AnyRes, next: (err?: unknown) => void) => {
  if (err && (err.status === 413 || err.type === "entity.too.large")) {
    res.status(413).json({ status: "error", message: "File vượt giới hạn 5MB." });
    return;
  }
  next(err);
});

export default router;
