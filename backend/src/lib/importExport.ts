/**
 * Import row validation — Sprint Import/Export.
 *
 * Pure module (no Prisma): normalizing and validating one CSV row, and
 * detecting duplicates WITHIN a file, can be tested without a database.
 * Duplicates AGAINST the database live in the route layer, which reuses
 * the same normalized values (phoneNormalized / normalized SKU) so a
 * preview and a confirm can never disagree about what "the same" means.
 *
 * Reused locked rules:
 *  - Phones: customers.ts normalizePhoneList (unlimited phones, exactly
 *    one primary, in-row duplicates blocked).
 *  - SKUs: products.ts normalizeSku / variantSkuBase / resolveAutoSku
 *    (user-entered duplicates are errors, never silently renamed;
 *    system-generated duplicates get -002, -003, ...).
 */

import { parseAttributesCell, parsePriceCell, splitListCell } from "./csv";
import { isValidPhoneNormalized, normalizePhone, normalizePhoneList } from "./customers";
import { combinationName, normalizeSku, resolveAutoSku, variantSkuBase } from "./products";

/** Limits (also enforced in the route, before any row is processed). */
export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** How long a preview stays confirmable (in-memory, per process). */
export const PREVIEW_TTL_MS = 15 * 60 * 1000;

export interface ValidatedCustomerRow {
  rowNumber: number;
  name: string;
  phones: { phone: string; phoneNormalized: string; label: string | null; isPrimary: boolean }[];
  email: string | null;
  address: string | null;
  source: string | null;
  tags: string[];
  status: "active" | "inactive";
  note: string | null;
  errors: string[];
}

export interface ValidatedProductRow {
  rowNumber: number;
  productName: string;
  categoryName: string | null;
  sku: string;
  skuEntered: boolean;
  variantName: string;
  attributes: { name: string; value: string }[];
  sellingPrice: number;
  importPrice: number | null;
  barcode: string | null;
  status: "active" | "inactive";
  errors: string[];
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseStatus(value: string | undefined, fallback: "active" | "inactive"): { status: "active" | "inactive"; error?: string } {
  if (!value || !value.trim()) return { status: fallback };
  const v = value.trim().toLowerCase();
  if (v === "active" || v === "inactive") return { status: v };
  return { status: fallback, error: `Trạng thái "${value}" không hợp lệ, chỉ nhận active/inactive.` };
}

/**
 * Validate one customer CSV row (columns: name, phones, email, address,
 * source, tags, status, note). Phones are separated by ';' or '|'.
 * A row is valid when it has a name OR at least one phone, every phone
 * is valid after normalization, and no phone repeats within the row.
 */
export function validateCustomerRow(row: Record<string, string>, rowNumber: number): ValidatedCustomerRow {
  const errors: string[] = [];
  const name = (row.name ?? "").trim();
  const phoneList = splitListCell(row.phones);
  const normalized = normalizePhoneList(phoneList.map((phone) => ({ phone })));
  if (normalized.error) errors.push(normalized.error);
  if (!name && normalized.phones.length === 0) {
    errors.push("Khách hàng cần có họ tên hoặc ít nhất một số điện thoại.");
  }
  const email = (row.email ?? "").trim() || null;
  if (email && !validEmail(email)) errors.push(`Email "${email}" không đúng định dạng.`);
  const statusRes = parseStatus(row.status, "active");
  if (statusRes.error) errors.push(statusRes.error);
  const tags: string[] = [];
  const seenTags = new Set<string>();
  for (const tag of splitListCell(row.tags)) {
    if (!seenTags.has(tag.toLowerCase())) {
      seenTags.add(tag.toLowerCase());
      tags.push(tag);
    }
  }
  return {
    rowNumber,
    name,
    phones: normalized.phones,
    email,
    address: (row.address ?? "").trim() || null,
    source: (row.source ?? "").trim() || null,
    tags,
    status: statusRes.status,
    note: (row.note ?? "").trim() || null,
    errors,
  };
}

/**
 * Validate one product CSV row (columns: product_name, category, sku,
 * variant_name, attributes, sell_price, import_price, barcode, status).
 * attributes: "color:Đen;size:S" or empty for the default variant.
 * An empty sku means "generate it" (not an error); a filled sku is
 * normalized (trim + upper-case) and checked for duplicates by the
 * route layer, never renamed by the system.
 */
export function validateProductRow(row: Record<string, string>, rowNumber: number): ValidatedProductRow {
  const errors: string[] = [];
  const productName = (row.product_name ?? "").trim();
  if (!productName) errors.push("Tên sản phẩm (product_name) không được để trống.");
  const categoryName = (row.category ?? "").trim() || null;
  const attrRes = parseAttributesCell(row.attributes);
  if (attrRes.error) errors.push(attrRes.error);
  const sellRes = parsePriceCell(row.sell_price);
  if (sellRes.error) errors.push(`Giá bán: ${sellRes.error}`);
  if (sellRes.value === null) errors.push("Giá bán (sell_price) là bắt buộc.");
  if (sellRes.value !== null && sellRes.value < 0) errors.push("Giá bán không được âm.");
  const importRes = parsePriceCell(row.import_price);
  if (importRes.error) errors.push(`Giá nhập: ${importRes.error}`);
  if (importRes.value !== null && importRes.value < 0) errors.push("Giá nhập không được âm.");
  const statusRes = parseStatus(row.status, "active");
  if (statusRes.error) errors.push(statusRes.error);
  const skuRaw = (row.sku ?? "").trim();
  const skuEntered = skuRaw.length > 0;
  const sku = skuEntered ? normalizeSku(skuRaw) : "";
  const variantName = (row.variant_name ?? "").trim() || (attrRes.attributes.length > 0 ? combinationName(attrRes.attributes) : "Mặc định");
  return {
    rowNumber,
    productName,
    categoryName,
    sku,
    skuEntered,
    variantName,
    attributes: attrRes.attributes,
    sellingPrice: sellRes.value ?? 0,
    importPrice: importRes.value,
    barcode: (row.barcode ?? "").trim() || null,
    status: statusRes.status,
    errors,
  };
}

/** Detect in-file duplicate phones across customer rows (normalized). */
export function findInFilePhoneDuplicates(rows: ValidatedCustomerRow[]): Map<string, number[]> {
  const byPhone = new Map<string, number[]>();
  for (const row of rows) {
    for (const phone of row.phones) {
      const list = byPhone.get(phone.phoneNormalized) ?? [];
      list.push(row.rowNumber);
      byPhone.set(phone.phoneNormalized, list);
    }
  }
  const dup = new Map<string, number[]>();
  for (const [phone, lines] of byPhone) if (lines.length > 1) dup.set(phone, lines);
  return dup;
}

/** Detect in-file duplicate SKUs (entered SKUs only; generated SKUs are resolved later). */
export function findInFileSkuDuplicates(rows: ValidatedProductRow[]): Map<string, number[]> {
  const bySku = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.skuEntered) continue;
    const list = bySku.get(row.sku) ?? [];
    list.push(row.rowNumber);
    bySku.set(row.sku, list);
  }
  const dup = new Map<string, number[]>();
  for (const [sku, lines] of bySku) if (lines.length > 1) dup.set(sku, lines);
  return dup;
}

/** Detect in-file duplicate barcodes. */
export function findInFileBarcodeDuplicates(rows: ValidatedProductRow[]): Map<string, number[]> {
  const byBarcode = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.barcode) continue;
    const list = byBarcode.get(row.barcode) ?? [];
    list.push(row.rowNumber);
    byBarcode.set(row.barcode, list);
  }
  const dup = new Map<string, number[]>();
  for (const [barcode, lines] of byBarcode) if (lines.length > 1) dup.set(barcode, lines);
  return dup;
}

export interface ProductGroup {
  key: string;
  productName: string;
  categoryName: string | null;
  rows: ValidatedProductRow[];
}

/**
 * Group product rows into parent products: rows with the same
 * product_name + category (case-insensitive after trim) belong to one
 * parent product with many variants. The first row's casing wins for
 * display; grouping itself is case-insensitive.
 */
export function groupProductRows(rows: ValidatedProductRow[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  for (const row of rows) {
    const key = `${row.productName.toLowerCase()}|${(row.categoryName ?? "").toLowerCase()}`;
    const existing = groups.get(key);
    if (existing) existing.rows.push(row);
    else groups.set(key, { key, productName: row.productName, categoryName: row.categoryName, rows: [row] });
  }
  return [...groups.values()];
}

/** Resolve a generated SKU for a row with no entered SKU. */
export function resolveGeneratedSku(productName: string, attributes: { name: string; value: string }[], taken: Set<string>): string {
  return resolveAutoSku(variantSkuBase(productName, attributes), taken);
}

export { isValidPhoneNormalized, normalizePhone };
