/**
 * Product / SKU API — Sprint Product/SKU.
 *
 * Reuses Sprint Auth: authenticate() + authorize() middleware, never a
 * second auth mechanism. Frontend hiding is never a substitute (locked
 * rules §6). All SKU normalization, duplicate checks and price-permission
 * filtering run again on the backend, even if the frontend already did them.
 *
 * Locked rules applied here:
 *  §1  The parent Product is NEVER the selling unit; only ProductVariant /
 *      SKU is. A product with no variants gets exactly ONE default variant.
 *      An inactive product or inactive variant must not be sold later —
 *      the API exposes isSellable (product active AND variant active) so
 *      the Order sprint can block it, but this sprint creates no orders.
 *  §4.2 SKU is stored trimmed + upper-cased, unique across the whole
 *      system (DB unique constraint). A user-entered duplicate SKU is a
 *      400 error and is NEVER silently renamed. A system-generated
 *      duplicate gets suffixes -002, -003, ... A SKU is never reused
 *      while its variant row exists, even if inactive / soft-deleted.
 *  §5  No hard delete of data with transactions: DELETE soft-deletes
 *      (status inactive + deletedAt) by default; hard delete only for
 *      Admin, only when there are no order items, no inventory
 *      transactions and no stock left, and it is audited.
 *  §6  Backend permission checks on every route. importPrice is only
 *      returned to users with product.view_cost; everyone else never
 *      sees the field at all (not even as null).
 *
 * Deliberately NOT in this sprint (see DEVELOPMENT_PLAN.md):
 *  - Initial stock: every new variant gets an InventoryItem with
 *    quantity 0 and NO inventory transaction. Entering initial stock
 *    belongs to the Inventory sprint, which owns InventoryTransaction
 *    creation (locked rules §2.1: no stock change without a transaction,
 *    and transactions go through the inventory service). A payload that
 *    tries to set initialQuantity > 0 is rejected with a clear message
 *    instead of being silently dropped or stored without a transaction.
 *  - Orders, payments, import/export of products (later sprints).
 *  - Product fields the schema does not have yet (brand, product_code,
 *    unit, sale_price, low_stock_threshold, image_url, internal_note):
 *    recorded as backlog, not invented as untyped columns.
 *  - Product status "draft" from spec 02 §8/§15: the schema enum only
 *    has active/inactive, so this sprint accepts only those two.
 */

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import {
  combinationKey,
  combinationName,
  generateCombinations,
  isValidPrice,
  MAX_OPTION_GROUPS,
  normalizeSku,
  resolveAutoSku,
  slugify,
  validateAttributes,
  validateOptionGroups,
  variantSkuBase,
  type OptionGroup,
  type VariantAttribute,
} from "../lib/products";
import { getPrisma } from "../lib/prisma";

const router = Router();
router.use(authenticate);

type AnyTx = any;
type AnyReq = import("express").Request;
type AnyRes = import("express").Response;

function dbUnavailable(res: AnyRes, err: unknown) {
  console.error("[products] database error:", err);
  res.status(503).json({
    status: "error",
    message: "Chưa kết nối được database. Hãy chạy PostgreSQL (docker compose up -d postgres) rồi thử lại.",
  });
}

function isPrismaUniqueError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

function parsePagination(req: AnyReq): { page: number; pageSize: number } {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
  return { page, pageSize };
}

function canViewCost(req: AnyReq): boolean {
  return req.user!.permissions.includes("product.view_cost");
}

function parseDecimal(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : null;
}

/** Error that carries the existing product/variant owning a duplicate SKU. */
class SkuConflict extends Error {
  conflict: { sku: string; productId: string; productName: string; variantId: string; variantName: string };
  constructor(conflict: SkuConflict["conflict"]) {
    super(
      `Mã SKU ${conflict.sku} đã tồn tại ở sản phẩm "${conflict.productName}" (biến thể "${conflict.variantName}"). Vui lòng nhập mã khác — hệ thống không tự đổi mã do bạn nhập.`,
    );
    this.conflict = conflict;
  }
}

class BadRequest extends Error {}

/* ------------------------------------------------------------------ */
/* Serialization                                                       */
/* ------------------------------------------------------------------ */

function serializeVariant(v: any, canCost: boolean, product?: any) {
  const parent = product ?? v.product;
  const out: Record<string, unknown> = {
    id: v.id,
    productId: v.productId,
    productName: parent?.name ?? null,
    categoryId: parent?.categoryId ?? null,
    sku: v.sku,
    variantName: v.variantName,
    attributes: v.attributes ?? [],
    isDefault: v.isDefault ?? false,
    sellingPrice: parseDecimal(v.sellingPrice) ?? 0,
    barcode: v.barcode ?? null,
    status: v.status,
    // A variant is sellable only when both it and its parent are active.
    // The Order sprint must re-check this server-side before selling.
    isSellable: v.status === "active" && parent?.status === "active" && !parent?.deletedAt,
    stockQuantity: v.inventoryItem?.quantity ?? 0,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
  // importPrice is omitted entirely (not null) for users without the right.
  if (canCost) out.importPrice = parseDecimal(v.importPrice);
  return out;
}

function serializeProduct(p: any, canCost: boolean) {
  const variants = (p.variants ?? []).filter((v: any) => !v.deletedAt);
  const totalStock = variants.reduce((acc: number, v: any) => acc + (v.inventoryItem?.quantity ?? 0), 0);
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    categoryId: p.categoryId ?? null,
    category: p.category ? { id: p.category.id, name: p.category.name } : null,
    status: p.status,
    variantCount: variants.length,
    activeVariantCount: variants.filter((v: any) => v.status === "active").length,
    defaultVariantCount: variants.filter((v: any) => v.isDefault).length,
    totalStock,
    variants: variants.map((v: any) => serializeVariant(v, canCost, p)),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

const variantInclude = { inventoryItem: true };
const productInclude = {
  category: true,
  variants: { where: { deletedAt: null }, orderBy: { createdAt: "asc" as const }, include: variantInclude },
};

/* ------------------------------------------------------------------ */
/* SKU helpers (DB-backed)                                             */
/* ------------------------------------------------------------------ */

/** All variants owning any of the given normalized SKUs (any status, incl. soft-deleted). */
async function findSkuOwners(tx: AnyTx, skus: string[]): Promise<any[]> {
  if (skus.length === 0) return [];
  return tx.productVariant.findMany({
    where: { sku: { in: skus } },
    include: { product: { select: { id: true, name: true } } },
  });
}

/** Existing SKUs sharing a base prefix (base, base-002, ...), for auto-generation. */
async function findSkuPrefixOwners(tx: AnyTx, base: string): Promise<string[]> {
  const rows = await tx.productVariant.findMany({
    where: { OR: [{ sku: base }, { sku: { startsWith: `${base}-` } }] },
    select: { sku: true },
  });
  return rows.map((r: any) => r.sku);
}

/**
 * Resolve one variant's SKU.
 * - User-entered (sku non-empty): normalized; a collision is a SkuConflict.
 * - Auto-generated (sku empty): base from product + attributes, suffixed
 *   -002/-003 until free, considering DB owners and `takenInRequest`.
 * The resolved SKU is added to takenInRequest by the caller.
 */
async function resolveVariantSku(
  tx: AnyTx,
  opts: { rawSku?: unknown; base: string; takenInRequest: Set<string> },
): Promise<{ sku: string; userEntered: boolean }> {
  const raw = typeof opts.rawSku === "string" ? opts.rawSku.trim() : "";
  if (raw) {
    const sku = normalizeSku(raw);
    if (!sku) throw new BadRequest("Mã SKU không được để trống.");
    if (opts.takenInRequest.has(sku)) {
      throw new BadRequest(`Mã SKU ${sku} bị trùng trong cùng một lần gửi.`);
    }
    const owners = await findSkuOwners(tx, [sku]);
    if (owners.length > 0) {
      const o = owners[0];
      throw new SkuConflict({
        sku,
        productId: o.product.id,
        productName: o.product.name,
        variantId: o.id,
        variantName: o.variantName,
      });
    }
    return { sku, userEntered: true };
  }
  const base = normalizeSku(opts.base) || "SP";
  const dbTaken = new Set<string>(await findSkuPrefixOwners(tx, base));
  const taken = new Set<string>([...dbTaken, ...opts.takenInRequest]);
  return { sku: resolveAutoSku(base, taken), userEntered: false };
}

/** Barcode owners among the given barcodes (non-deleted variants only). */
async function findBarcodeOwners(tx: AnyTx, barcodes: string[], excludeId?: string): Promise<any[]> {
  if (barcodes.length === 0) return [];
  const rows = await tx.productVariant.findMany({
    where: { barcode: { in: barcodes }, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    include: { product: { select: { id: true, name: true } } },
  });
  return rows;
}

/* ------------------------------------------------------------------ */
/* Variant input validation                                            */
/* ------------------------------------------------------------------ */

interface PreparedVariant {
  variantName: string;
  attributes: VariantAttribute[];
  sku: string;
  userEnteredSku: boolean;
  isDefault: boolean;
  sellingPrice: number;
  importPrice: number | null;
  barcode: string | null;
  status: "active" | "inactive";
}

function checkPricePermissions(req: AnyReq, item: Record<string, unknown>) {
  if (item.sellingPrice !== undefined && item.sellingPrice !== null && !req.user!.permissions.includes("product.update_price")) {
    throw new BadRequest("Bạn không có quyền đổi giá bán (product.update_price).");
  }
  if (item.importPrice !== undefined && item.importPrice !== null && !req.user!.permissions.includes("product.update_cost")) {
    throw new BadRequest("Bạn không có quyền đổi giá nhập (product.update_cost).");
  }
}

function rejectInitialStock(item: Record<string, unknown>) {
  const q = item.initialQuantity;
  if (q !== undefined && q !== null && Number(q) !== 0) {
    throw new BadRequest(
      "Tồn kho ban đầu được nhập ở Sprint Kho (kèm transaction loại initial), không nhập trong màn hình sản phẩm. Biến thể mới được tạo với tồn 0.",
    );
  }
}

/** Validate + resolve one manual variant input. Does NOT write anything. */
async function prepareVariant(
  tx: AnyTx,
  req: AnyReq,
  productName: string,
  item: unknown,
  takenInRequest: Set<string>,
): Promise<PreparedVariant> {
  if (!item || typeof item !== "object") throw new BadRequest("Mỗi biến thể phải là một đối tượng.");
  const v = item as Record<string, unknown>;
  rejectInitialStock(v);
  checkPricePermissions(req, v);
  const attr = validateAttributes(v.attributes);
  if (attr.error) throw new BadRequest(attr.error);
  const attributes = attr.attributes;
  let variantName = typeof v.variantName === "string" ? v.variantName.trim() : "";
  if (!variantName) {
    if (attributes.length > 0) variantName = combinationName(attributes);
    else throw new BadRequest("Tên biến thể không được để trống.");
  }
  let sellingPrice = 0;
  if (v.sellingPrice !== undefined && v.sellingPrice !== null) {
    if (!isValidPrice(v.sellingPrice)) throw new BadRequest(`Giá bán của biến thể "${variantName}" không hợp lệ (phải là số >= 0).`);
    sellingPrice = v.sellingPrice as number;
  }
  let importPrice: number | null = null;
  if (v.importPrice !== undefined && v.importPrice !== null) {
    if (!isValidPrice(v.importPrice)) throw new BadRequest(`Giá nhập của biến thể "${variantName}" không hợp lệ (phải là số >= 0).`);
    importPrice = v.importPrice as number;
  }
  const barcode = typeof v.barcode === "string" && v.barcode.trim() ? v.barcode.trim() : null;
  if (barcode) {
    const owners = await findBarcodeOwners(tx, [barcode]);
    if (owners.length > 0) {
      throw new BadRequest(`Mã vạch ${barcode} đã tồn tại ở sản phẩm "${owners[0].product.name}" (biến thể "${owners[0].variantName}").`);
    }
  }
  const status = v.status === undefined || v.status === null ? "active" : v.status;
  if (status !== "active" && status !== "inactive") {
    throw new BadRequest(`Trạng thái biến thể "${variantName}" không hợp lệ (chỉ nhận active/inactive).`);
  }
  const resolved = await resolveVariantSku(tx, {
    rawSku: v.sku,
    base: variantSkuBase(productName, attributes),
    takenInRequest,
  });
  takenInRequest.add(resolved.sku);
  return {
    variantName,
    attributes,
    sku: resolved.sku,
    userEnteredSku: resolved.userEntered,
    isDefault: v.isDefault === true,
    sellingPrice,
    importPrice,
    barcode,
    status: status as "active" | "inactive",
  };
}

async function createVariantRow(tx: AnyTx, productId: string, pv: PreparedVariant): Promise<any> {
  const variant = await tx.productVariant.create({
    data: {
      productId,
      sku: pv.sku,
      variantName: pv.variantName,
      attributes: pv.attributes.length > 0 ? pv.attributes : undefined,
      isDefault: pv.isDefault,
      sellingPrice: pv.sellingPrice,
      importPrice: pv.importPrice,
      barcode: pv.barcode,
      status: pv.status,
    },
  });
  // Every variant gets a stock row at 0. No transaction here: initial
  // stock is entered in the Inventory sprint (see header comment).
  await tx.inventoryItem.create({ data: { variantId: variant.id, quantity: 0 } });
  return variant;
}

async function auditVariant(tx: AnyTx, req: AnyReq, action: string, variantId: string, oldValue: unknown, newValue: unknown) {
  await writeAudit(tx, {
    actorId: req.user!.id,
    action,
    entityType: "variant",
    entityId: variantId,
    oldValue,
    newValue,
    ipAddress: req.ip ?? null,
  });
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

/** GET /api/categories — list categories (product viewers). */
router.get("/categories", authorize("product.view"), async (_req, res) => {
  try {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
    res.json({
      status: "ok",
      categories: categories.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description ?? null,
        productCount: c._count?.products ?? 0,
      })),
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** POST /api/categories — create (or reactivate) a category. */
router.post("/categories", authorize("product.create"), async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).json({ status: "error", message: "Tên danh mục không được để trống." });
      return;
    }
    const prisma = getPrisma();
    const product = await prisma.$transaction(async (tx: AnyTx) => {
      const existing = await tx.category.findMany({ where: { name: { equals: name, mode: "insensitive" } } });
      const live = existing.find((c: any) => !c.deletedAt);
      if (live) {
        res.status(400).json({ status: "error", message: `Danh mục "${live.name}" đã tồn tại.` });
        return null;
      }
      const soft = existing.find((c: any) => c.deletedAt);
      if (soft) {
        return tx.category.update({ where: { id: soft.id }, data: { deletedAt: null, description: req.body?.description ?? soft.description } });
      }
      return tx.category.create({
        data: { name, description: typeof req.body?.description === "string" ? req.body.description : null },
      });
    });
    if (!product) return;
    await writeAudit(getPrisma(), {
      actorId: req.user!.id, action: "category.create", entityType: "category", entityId: product.id,
      newValue: { name: product.name }, ipAddress: req.ip ?? null,
    });
    res.status(201).json({ status: "ok", category: { id: product.id, name: product.name, description: product.description ?? null } });
  } catch (err) {
    if (err instanceof BadRequest) {
      res.status(400).json({ status: "error", message: err.message });
      return;
    }
    if (isPrismaUniqueError(err)) {
      res.status(400).json({ status: "error", message: "Tên danh mục đã tồn tại." });
      return;
    }
    dbUnavailable(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* Products: list / detail                                             */
/* ------------------------------------------------------------------ */

/** GET /api/products — paginated list with variants + stock summary. */
router.get("/products", authorize("product.view"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const { page, pageSize } = parsePagination(req);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const skuParam = typeof req.query.sku === "string" ? req.query.sku.trim() : "";
    const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const variantStatus = typeof req.query.variantStatus === "string" ? req.query.variantStatus : "";
    const minPrice = req.query.minPrice !== undefined ? Number(req.query.minPrice) : NaN;
    const maxPrice = req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : NaN;
    const canCost = canViewCost(req);

    const variantMatch: Record<string, unknown> = { deletedAt: null };
    if (variantStatus) variantMatch.status = variantStatus;
    if (!Number.isNaN(minPrice) || !Number.isNaN(maxPrice)) {
      variantMatch.sellingPrice = {
        ...(Number.isNaN(minPrice) ? {} : { gte: minPrice }),
        ...(Number.isNaN(maxPrice) ? {} : { lte: maxPrice }),
      };
    }
    const hasVariantFilter = Boolean(variantStatus || !Number.isNaN(minPrice) || !Number.isNaN(maxPrice));

    const where: Record<string, unknown> = { deletedAt: null };
    if (categoryId) where.categoryId = categoryId;
    if (status) {
      if (status !== "active" && status !== "inactive") {
        res.status(400).json({ status: "error", message: "Trạng thái sản phẩm chỉ nhận active/inactive." });
        return;
      }
      where.status = status;
    }
    if (skuParam) {
      where.variants = { some: { sku: normalizeSku(skuParam), deletedAt: null } };
    } else if (q) {
      const normalizedQ = normalizeSku(q);
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        {
          variants: {
            some: {
              deletedAt: null,
              OR: [
                { sku: { contains: normalizedQ, mode: "insensitive" } },
                { variantName: { contains: q, mode: "insensitive" } },
                { barcode: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }
    if (hasVariantFilter) {
      where.variants = { some: { ...variantMatch, ...(skuParam ? { sku: normalizeSku(skuParam) } : {}) } };
    }

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: productInclude,
      }),
    ]);
    res.json({
      status: "ok",
      page, pageSize, total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      products: products.map((p: any) => serializeProduct(p, canCost)),
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/** GET /api/products/:id — detail with all variants + stock. */
router.get("/products/:id", authorize("product.view"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const product = await prisma.product.findUnique({
      where: { id: req.params.id, deletedAt: null },
      include: productInclude,
    });
    if (!product) {
      res.status(404).json({ status: "error", message: "Không tìm thấy sản phẩm." });
      return;
    }
    res.json({
      status: "ok",
      product: serializeProduct(product, canViewCost(req)),
      inventoryNote: "Tồn kho ban đầu được nhập ở Sprint Kho (kèm transaction loại initial). Biến thể mới luôn bắt đầu với tồn 0.",
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* Products: create / update / delete                                  */
/* ------------------------------------------------------------------ */

/** Resolve a category for create/update: categoryId wins, else find-or-create by name. */
async function resolveCategory(tx: AnyTx, body: Record<string, unknown>): Promise<string | null> {
  if (typeof body.categoryId === "string" && body.categoryId.trim()) {
    const cat = await tx.category.findUnique({ where: { id: body.categoryId.trim(), deletedAt: null } });
    if (!cat) throw new BadRequest("Danh mục đã chọn không tồn tại.");
    return cat.id;
  }
  if (typeof body.categoryName === "string" && body.categoryName.trim()) {
    const name = body.categoryName.trim();
    const existing = await tx.category.findMany({ where: { name: { equals: name, mode: "insensitive" } } });
    const live = existing.find((c: any) => !c.deletedAt);
    if (live) return live.id;
    const soft = existing.find((c: any) => c.deletedAt);
    if (soft) {
      const revived = await tx.category.update({ where: { id: soft.id }, data: { deletedAt: null } });
      return revived.id;
    }
    const created = await tx.category.create({ data: { name } });
    return created.id;
  }
  return null;
}

/** Build the variant plan for a brand-new product. Returns prepared variants + report. */
async function planNewProductVariants(
  tx: AnyTx,
  req: AnyReq,
  productName: string,
  body: Record<string, unknown>,
): Promise<{ variants: PreparedVariant[]; generated: string[]; skipped: string[] }> {
  const variantsInput = body.variants;
  const optionsInput = body.variantOptions;
  const hasVariants = Array.isArray(variantsInput) && variantsInput.length > 0;
  const hasOptions = Array.isArray(optionsInput) && optionsInput.length > 0;
  if (Array.isArray(variantsInput) && variantsInput.length === 0) {
    throw new BadRequest("Danh sách biến thể trống. Hãy bỏ trường variants để tạo SKU mặc định, hoặc nhập ít nhất 1 biến thể.");
  }
  if (hasVariants && hasOptions) {
    throw new BadRequest("Chỉ chọn một trong hai: nhập danh sách biến thể (variants) hoặc sinh từ nhóm thuộc tính (variantOptions).");
  }
  const taken = new Set<string>();

  if (hasVariants) {
    const prepared: PreparedVariant[] = [];
    for (const item of variantsInput as unknown[]) {
      prepared.push(await prepareVariant(tx, req, productName, item, taken));
    }
    if (prepared.filter((p) => p.isDefault).length > 1) {
      throw new BadRequest("Một sản phẩm chỉ được có tối đa 1 SKU mặc định (isDefault).");
    }
    return { variants: prepared, generated: [], skipped: [] };
  }

  if (hasOptions) {
    const validated = validateOptionGroups(optionsInput);
    if (validated.error) throw new BadRequest(validated.error);
    const combos = generateCombinations(validated.groups);
    const defaultSelling = body.defaultSellingPrice !== undefined && body.defaultSellingPrice !== null
      ? body.defaultSellingPrice : 0;
    const defaultImport = body.defaultImportPrice !== undefined && body.defaultImportPrice !== null
      ? body.defaultImportPrice : null;
    if (!isValidPrice(defaultSelling)) throw new BadRequest("Giá bán mặc định cho biến thể sinh ra không hợp lệ (phải là số >= 0).");
    if (defaultImport !== null && !isValidPrice(defaultImport)) throw new BadRequest("Giá nhập mặc định cho biến thể sinh ra không hợp lệ (phải là số >= 0).");
    if (defaultImport !== null && !req.user!.permissions.includes("product.update_cost")) {
      throw new BadRequest("Bạn không có quyền nhập giá nhập (product.update_cost).");
    }
    if (!req.user!.permissions.includes("product.update_price")) {
      throw new BadRequest("Bạn không có quyền nhập giá bán (product.update_price).");
    }
    const defaultStatus = body.defaultVariantStatus === undefined || body.defaultVariantStatus === null
      ? "active" : body.defaultVariantStatus;
    if (defaultStatus !== "active" && defaultStatus !== "inactive") {
      throw new BadRequest("Trạng thái biến thể mặc định chỉ nhận active/inactive.");
    }
    const prepared: PreparedVariant[] = [];
    for (const combo of combos) {
      const base = variantSkuBase(productName, combo);
      const resolved = await resolveVariantSku(tx, { base, takenInRequest: taken });
      taken.add(resolved.sku);
      prepared.push({
        variantName: combinationName(combo),
        attributes: combo,
        sku: resolved.sku,
        userEnteredSku: false,
        isDefault: false,
        sellingPrice: defaultSelling as number,
        importPrice: defaultImport as number | null,
        barcode: null,
        status: defaultStatus as "active" | "inactive",
      });
    }
    return { variants: prepared, generated: prepared.map((p) => p.sku), skipped: [] };
  }

  // Simple product: exactly one default variant.
  const dv = (body.defaultVariant && typeof body.defaultVariant === "object" ? body.defaultVariant : {}) as Record<string, unknown>;
  rejectInitialStock(dv);
  checkPricePermissions(req, dv);
  const selling = dv.sellingPrice !== undefined && dv.sellingPrice !== null ? dv.sellingPrice : (body.defaultSellingPrice ?? 0);
  const importing = dv.importPrice !== undefined && dv.importPrice !== null ? dv.importPrice : (body.defaultImportPrice ?? null);
  if (!isValidPrice(selling)) throw new BadRequest("Giá bán của SKU mặc định không hợp lệ (phải là số >= 0).");
  if (importing !== null && !isValidPrice(importing)) throw new BadRequest("Giá nhập của SKU mặc định không hợp lệ (phải là số >= 0).");
  const dvBarcode = typeof dv.barcode === "string" && dv.barcode.trim() ? dv.barcode.trim() : null;
  if (dvBarcode) {
    const owners = await findBarcodeOwners(tx, [dvBarcode]);
    if (owners.length > 0) throw new BadRequest(`Mã vạch ${dvBarcode} đã tồn tại ở sản phẩm "${owners[0].product.name}".`);
  }
  const dvStatus = dv.status === undefined || dv.status === null ? "active" : dv.status;
  if (dvStatus !== "active" && dvStatus !== "inactive") throw new BadRequest("Trạng thái SKU mặc định chỉ nhận active/inactive.");
  const resolved = await resolveVariantSku(tx, {
    rawSku: dv.sku,
    base: slugify(productName),
    takenInRequest: taken,
  });
  return {
    variants: [{
      variantName: typeof dv.variantName === "string" && dv.variantName.trim() ? dv.variantName.trim() : "Mặc định",
      attributes: [],
      sku: resolved.sku,
      userEnteredSku: resolved.userEntered,
      isDefault: true,
      sellingPrice: selling as number,
      importPrice: importing as number | null,
      barcode: dvBarcode,
      status: dvStatus as "active" | "inactive",
    }],
    generated: [],
    skipped: [],
  };
}

/** POST /api/products — create a product with its variants in one transaction. */
router.post("/products", authorize("product.create"), async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      res.status(400).json({ status: "error", message: "Tên sản phẩm không được để trống." });
      return;
    }
    const status = body.status === undefined || body.status === null ? "active" : body.status;
    if (status !== "active" && status !== "inactive") {
      res.status(400).json({ status: "error", message: "Trạng thái sản phẩm chỉ nhận active/inactive (trạng thái draft của đặc tả 02 chưa có trong schema enum)." });
      return;
    }
    const prisma = getPrisma();
    const created = await prisma.$transaction(async (tx: AnyTx) => {
      const categoryId = await resolveCategory(tx, body);
      const plan = await planNewProductVariants(tx, req, name, body);
      const product = await tx.product.create({
        data: {
          name,
          description: typeof body.description === "string" ? body.description : null,
          categoryId,
          status: status as "active" | "inactive",
        },
      });
      for (const pv of plan.variants) {
        const variant = await createVariantRow(tx, product.id, pv);
        await auditVariant(tx, req, "variant.create", variant.id, null, {
          sku: pv.sku, variantName: pv.variantName, sellingPrice: pv.sellingPrice, isDefault: pv.isDefault,
        });
      }
      await writeAudit(tx, {
        actorId: req.user!.id, action: "product.create", entityType: "product", entityId: product.id,
        newValue: { name, status, variantCount: plan.variants.length }, ipAddress: req.ip ?? null,
      });
      return { product, plan };
    });
    const full = await prisma.product.findUnique({ where: { id: created.product.id }, include: productInclude });
    res.status(201).json({
      status: "ok",
      product: serializeProduct(full, canViewCost(req)),
      generatedSkus: created.plan.generated,
      skippedCombinations: created.plan.skipped,
    });
  } catch (err) {
    if (err instanceof SkuConflict) {
      res.status(400).json({ status: "error", message: err.message, conflict: err.conflict });
      return;
    }
    if (err instanceof BadRequest) {
      res.status(400).json({ status: "error", message: err.message });
      return;
    }
    if (isPrismaUniqueError(err)) {
      const target = String((err as any).meta?.target ?? "");
      if (target.includes("sku")) {
        res.status(400).json({ status: "error", message: "Mã SKU đã tồn tại trong hệ thống. Vui lòng nhập mã khác." });
        return;
      }
      if (target.includes("barcode")) {
        res.status(400).json({ status: "error", message: "Mã vạch đã tồn tại trong hệ thống." });
        return;
      }
      res.status(400).json({ status: "error", message: "Dữ liệu bị trùng (unique constraint)." });
      return;
    }
    dbUnavailable(res, err);
  }
});

/** Update one existing variant inside a transaction. Returns the updated row. */
async function updateVariantRow(tx: AnyTx, req: AnyReq, product: any, item: Record<string, unknown>): Promise<any> {
  const id = typeof item.id === "string" ? item.id : "";
  const existing = (product.variants ?? []).find((v: any) => v.id === id);
  if (!existing) throw new BadRequest(`Biến thể có id ${id || "(trống)"} không thuộc sản phẩm này.`);
  rejectInitialStock(item);
  checkPricePermissions(req, item);
  const data: Record<string, unknown> = {};
  const oldPrices: Record<string, unknown> = {};
  const newPrices: Record<string, unknown> = {};
  if (item.variantName !== undefined) {
    if (typeof item.variantName !== "string" || !item.variantName.trim()) throw new BadRequest("Tên biến thể không được để trống.");
    data.variantName = item.variantName.trim();
  }
  if (item.attributes !== undefined) {
    const attr = validateAttributes(item.attributes);
    if (attr.error) throw new BadRequest(attr.error);
    data.attributes = attr.attributes.length > 0 ? attr.attributes : undefined;
  }
  if (item.sellingPrice !== undefined && item.sellingPrice !== null) {
    if (!isValidPrice(item.sellingPrice)) throw new BadRequest("Giá bán không hợp lệ (phải là số >= 0).");
    oldPrices.sellingPrice = parseDecimal(existing.sellingPrice);
    newPrices.sellingPrice = item.sellingPrice;
    data.sellingPrice = item.sellingPrice;
  }
  if (item.importPrice !== undefined) {
    if (item.importPrice !== null && !isValidPrice(item.importPrice)) throw new BadRequest("Giá nhập không hợp lệ (phải là số >= 0).");
    oldPrices.importPrice = parseDecimal(existing.importPrice);
    newPrices.importPrice = item.importPrice;
    data.importPrice = item.importPrice;
  }
  if (item.barcode !== undefined) {
    const barcode = typeof item.barcode === "string" && item.barcode.trim() ? item.barcode.trim() : null;
    if (barcode) {
      const owners = await findBarcodeOwners(tx, [barcode], existing.id);
      if (owners.length > 0) throw new BadRequest(`Mã vạch ${barcode} đã tồn tại ở sản phẩm "${owners[0].product.name}".`);
    }
    data.barcode = barcode;
  }
  if (item.status !== undefined) {
    if (item.status !== "active" && item.status !== "inactive") throw new BadRequest("Trạng thái biến thể chỉ nhận active/inactive.");
    data.status = item.status;
  }
  if (item.sku !== undefined && item.sku !== null) {
    const raw = typeof item.sku === "string" ? item.sku.trim() : "";
    if (!raw) throw new BadRequest("Mã SKU không được để trống khi đổi mã.");
    const sku = normalizeSku(raw);
    if (sku !== existing.sku) {
      // A SKU that already sold must keep its code: old orders carry a
      // snapshot of this SKU, so renaming would break traceability.
      const orderCount = await tx.orderItem.count({ where: { productVariantId: existing.id } });
      if (orderCount > 0) {
        throw new BadRequest(`Không thể đổi mã SKU của biến thể "${existing.variantName}" vì đã có ${orderCount} dòng đơn hàng dùng SKU này.`);
      }
      const owners = await findSkuOwners(tx, [sku]);
      const other = owners.find((o: any) => o.id !== existing.id);
      if (other) {
        throw new SkuConflict({
          sku, productId: other.product.id, productName: other.product.name,
          variantId: other.id, variantName: other.variantName,
        });
      }
      data.sku = sku;
    }
  }
  if (item.isDefault === true && !existing.isDefault) {
    await tx.productVariant.updateMany({ where: { productId: product.id, id: { not: existing.id } }, data: { isDefault: false } });
    data.isDefault = true;
  } else if (item.isDefault === false && existing.isDefault) {
    const siblings = (product.variants ?? []).filter((v: any) => v.id !== existing.id);
    if (siblings.length === 0) {
      throw new BadRequest("Không thể bỏ cờ mặc định của SKU duy nhất của sản phẩm. Hãy ngừng bán cả sản phẩm thay vì bỏ SKU mặc định.");
    }
    data.isDefault = false;
  }
  const updated = await tx.productVariant.update({ where: { id: existing.id }, data });
  await auditVariant(tx, req, "variant.update", existing.id, { ...existing, sellingPrice: parseDecimal(existing.sellingPrice), importPrice: parseDecimal(existing.importPrice) }, updated);
  if (Object.keys(newPrices).length > 0) {
    await auditVariant(tx, req, "product.price_change", existing.id, oldPrices, newPrices);
  }
  return updated;
}

/** PATCH /api/products/:id — update parent + optionally variants / generated combinations. */
router.patch("/products/:id", authorize("product.update"), async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const prisma = getPrisma();
    const existing = await prisma.product.findUnique({
      where: { id: req.params.id, deletedAt: null },
      include: { variants: { where: { deletedAt: null }, include: variantInclude } },
    });
    if (!existing) {
      res.status(404).json({ status: "error", message: "Không tìm thấy sản phẩm." });
      return;
    }
    const result = await prisma.$transaction(async (tx: AnyTx) => {
      const oldProduct = { name: existing.name, description: existing.description, categoryId: existing.categoryId, status: existing.status };
      const data: Record<string, unknown> = {};
      if (body.name !== undefined) {
        if (typeof body.name !== "string" || !body.name.trim()) throw new BadRequest("Tên sản phẩm không được để trống.");
        data.name = body.name.trim();
      }
      if (body.description !== undefined) data.description = typeof body.description === "string" ? body.description : null;
      if (body.status !== undefined) {
        if (body.status !== "active" && body.status !== "inactive") throw new BadRequest("Trạng thái sản phẩm chỉ nhận active/inactive.");
        data.status = body.status;
      }
      if (body.categoryId !== undefined || body.categoryName !== undefined) {
        data.categoryId = await resolveCategory(tx, body);
      }
      const product = Object.keys(data).length > 0
        ? await tx.product.update({ where: { id: existing.id }, data })
        : existing;

      const generated: string[] = [];
      const skipped: string[] = [];
      // Variant updates / additions (an empty array means "no variant change").
      if (Array.isArray(body.variants) && body.variants.length > 0) {
        const taken = new Set<string>();
        for (const item of body.variants as unknown[]) {
          if (!item || typeof item !== "object") throw new BadRequest("Mỗi biến thể phải là một đối tượng.");
          const v = item as Record<string, unknown>;
          if (typeof v.id === "string" && v.id) {
            await updateVariantRow(tx, req, existing, v);
          } else {
            const prepared = await prepareVariant(tx, req, product.name, v, taken);
            const all = await tx.productVariant.findMany({ where: { productId: existing.id, deletedAt: null }, select: { isDefault: true } });
            if (prepared.isDefault && all.some((r: any) => r.isDefault)) {
              await tx.productVariant.updateMany({ where: { productId: existing.id }, data: { isDefault: false } });
            }
            const created = await createVariantRow(tx, existing.id, prepared);
            await auditVariant(tx, req, "variant.create", created.id, null, { sku: prepared.sku, variantName: prepared.variantName });
          }
        }
        const defaults = await tx.productVariant.findMany({ where: { productId: existing.id, deletedAt: null, isDefault: true }, select: { id: true } });
        if (defaults.length > 1) throw new BadRequest("Một sản phẩm chỉ được có tối đa 1 SKU mặc định (isDefault).");
      }
      // Generate additional combinations, skipping ones that already exist.
      if (Array.isArray(body.variantOptions) && body.variantOptions.length > 0) {
        const validated = validateOptionGroups(body.variantOptions);
        if (validated.error) throw new BadRequest(validated.error);
        const combos = generateCombinations(validated.groups);
        const current = await tx.productVariant.findMany({
          where: { productId: existing.id, deletedAt: null }, select: { attributes: true, variantName: true },
        });
        const existingKeys = new Set(current.map((c: any) => combinationKey(Array.isArray(c.attributes) ? c.attributes : [])));
        const taken = new Set<string>();
        const defaultSelling = body.defaultSellingPrice !== undefined && body.defaultSellingPrice !== null ? body.defaultSellingPrice : 0;
        const defaultImport = body.defaultImportPrice !== undefined && body.defaultImportPrice !== null ? body.defaultImportPrice : null;
        if (!isValidPrice(defaultSelling)) throw new BadRequest("Giá bán mặc định cho biến thể sinh ra không hợp lệ (phải là số >= 0).");
        if (defaultImport !== null && !isValidPrice(defaultImport)) throw new BadRequest("Giá nhập mặc định cho biến thể sinh ra không hợp lệ (phải là số >= 0).");
        for (const combo of combos) {
          const key = combinationKey(combo);
          if (existingKeys.has(key)) {
            skipped.push(combinationName(combo));
            continue;
          }
          const resolved = await resolveVariantSku(tx, { base: variantSkuBase(product.name, combo), takenInRequest: taken });
          taken.add(resolved.sku);
          const created = await createVariantRow(tx, existing.id, {
            variantName: combinationName(combo), attributes: combo, sku: resolved.sku, userEnteredSku: false,
            isDefault: false, sellingPrice: defaultSelling as number, importPrice: defaultImport as number | null,
            barcode: null, status: "active",
          });
          await auditVariant(tx, req, "variant.create", created.id, null, { sku: resolved.sku, variantName: combinationName(combo) });
          generated.push(resolved.sku);
        }
      }
      if (Object.keys(data).length > 0) {
        await writeAudit(tx, {
          actorId: req.user!.id, action: "product.update", entityType: "product", entityId: existing.id,
          oldValue: oldProduct, newValue: data, ipAddress: req.ip ?? null,
        });
      }
      return { generated, skipped };
    });
    const full = await prisma.product.findUnique({ where: { id: req.params.id }, include: productInclude });
    res.json({
      status: "ok",
      product: serializeProduct(full, canViewCost(req)),
      generatedSkus: result.generated,
      skippedCombinations: result.skipped,
    });
  } catch (err) {
    if (err instanceof SkuConflict) {
      res.status(400).json({ status: "error", message: err.message, conflict: err.conflict });
      return;
    }
    if (err instanceof BadRequest) {
      res.status(400).json({ status: "error", message: err.message });
      return;
    }
    if (isPrismaUniqueError(err)) {
      res.status(400).json({ status: "error", message: "Mã SKU hoặc mã vạch đã tồn tại trong hệ thống." });
      return;
    }
    dbUnavailable(res, err);
  }
});

/** Count related history for a variant (orders, inventory transactions, stock). */
async function variantHistory(tx: AnyTx, variantId: string) {
  const [orderItems, transactions, stock] = await Promise.all([
    tx.orderItem.count({ where: { productVariantId: variantId } }),
    tx.inventoryTransaction.count({ where: { productVariantId: variantId } }),
    tx.inventoryItem.findUnique({ where: { variantId } }),
  ]);
  return { orderItems, transactions, stockQuantity: stock?.quantity ?? 0 };
}

/** DELETE /api/products/:id — soft-deactivate by default; hard delete only for Admin with no history. */
router.delete("/products/:id", authorize("product.deactivate"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const product = await prisma.product.findUnique({
      where: { id: req.params.id, deletedAt: null },
      include: { variants: { where: { deletedAt: null }, include: variantInclude } },
    });
    if (!product) {
      res.status(404).json({ status: "error", message: "Không tìm thấy sản phẩm." });
      return;
    }
    const hard = req.query.hard === "true";
    if (hard) {
      if (!req.user!.permissions.includes("product.hard_delete")) {
        res.status(403).json({ status: "error", message: "Chỉ Admin mới được xóa cứng sản phẩm." });
        return;
      }
      const blockers: string[] = [];
      for (const v of product.variants as any[]) {
        const h = await variantHistory(prisma, v.id);
        if (h.orderItems > 0 || h.transactions > 0 || h.stockQuantity !== 0) {
          blockers.push(`${v.sku} (đơn: ${h.orderItems}, lịch sử kho: ${h.transactions}, tồn: ${h.stockQuantity})`);
        }
      }
      if (blockers.length > 0) {
        res.status(400).json({
          status: "error",
          message: `Không thể xóa cứng sản phẩm vì các SKU sau đã có dữ liệu liên quan: ${blockers.join("; ")}. Hãy chuyển sang Ngừng bán.`,
        });
        return;
      }
      await prisma.$transaction(async (tx: AnyTx) => {
        for (const v of product.variants as any[]) {
          await tx.inventoryItem.deleteMany({ where: { variantId: v.id } });
          await tx.productVariant.delete({ where: { id: v.id } });
        }
        await tx.product.delete({ where: { id: product.id } });
      });
      await writeAudit(prisma, {
        actorId: req.user!.id, action: "product.hard_delete", entityType: "product", entityId: product.id,
        oldValue: { name: product.name }, ipAddress: req.ip ?? null,
      });
      res.json({ status: "ok", message: "Đã xóa cứng sản phẩm (không còn dữ liệu liên quan)." });
      return;
    }
    await prisma.$transaction(async (tx: AnyTx) => {
      await tx.product.update({ where: { id: product.id }, data: { status: "inactive", deletedAt: new Date() } });
      await tx.productVariant.updateMany({ where: { productId: product.id, deletedAt: null }, data: { status: "inactive", deletedAt: new Date() } });
    });
    await writeAudit(prisma, {
      actorId: req.user!.id, action: "product.deactivate", entityType: "product", entityId: product.id,
      oldValue: { status: product.status }, newValue: { status: "inactive" }, ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", message: "Đã chuyển sản phẩm và toàn bộ SKU sang Ngừng bán (xóa mềm)." });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* Variants: add / update / generate / delete                          */
/* ------------------------------------------------------------------ */

/** POST /api/products/:id/variants — add one manual variant. */
router.post("/products/:id/variants", authorize("product.update"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const product = await prisma.product.findUnique({
      where: { id: req.params.id, deletedAt: null },
      include: { variants: { where: { deletedAt: null } } },
    });
    if (!product) {
      res.status(404).json({ status: "error", message: "Không tìm thấy sản phẩm." });
      return;
    }
    const created = await prisma.$transaction(async (tx: AnyTx) => {
      const prepared = await prepareVariant(tx, req, product.name, req.body ?? {}, new Set<string>());
      if (prepared.isDefault) {
        const hasDefault = (product.variants as any[]).some((v) => v.isDefault);
        if (hasDefault) await tx.productVariant.updateMany({ where: { productId: product.id }, data: { isDefault: false } });
      }
      const variant = await createVariantRow(tx, product.id, prepared);
      await auditVariant(tx, req, "variant.create", variant.id, null, { sku: prepared.sku, variantName: prepared.variantName });
      return variant;
    });
    res.status(201).json({ status: "ok", variant: serializeVariant({ ...created, product }, canViewCost(req), product) });
  } catch (err) {
    if (err instanceof SkuConflict) {
      res.status(400).json({ status: "error", message: err.message, conflict: err.conflict });
      return;
    }
    if (err instanceof BadRequest) {
      res.status(400).json({ status: "error", message: err.message });
      return;
    }
    if (isPrismaUniqueError(err)) {
      res.status(400).json({ status: "error", message: "Mã SKU hoặc mã vạch đã tồn tại trong hệ thống." });
      return;
    }
    dbUnavailable(res, err);
  }
});

/** POST /api/products/:id/variants/generate — generate combinations, skipping existing ones. */
router.post("/products/:id/variants/generate", authorize("product.update"), async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const prisma = getPrisma();
    const product = await prisma.product.findUnique({
      where: { id: req.params.id, deletedAt: null },
      include: { variants: { where: { deletedAt: null } } },
    });
    if (!product) {
      res.status(404).json({ status: "error", message: "Không tìm thấy sản phẩm." });
      return;
    }
    const validated = validateOptionGroups(body.variantOptions);
    if (validated.error) {
      res.status(400).json({ status: "error", message: validated.error });
      return;
    }
    const defaultSelling = body.defaultSellingPrice !== undefined && body.defaultSellingPrice !== null ? body.defaultSellingPrice : 0;
    const defaultImport = body.defaultImportPrice !== undefined && body.defaultImportPrice !== null ? body.defaultImportPrice : null;
    if (!isValidPrice(defaultSelling) || (defaultImport !== null && !isValidPrice(defaultImport))) {
      res.status(400).json({ status: "error", message: "Giá mặc định cho biến thể sinh ra không hợp lệ (phải là số >= 0)." });
      return;
    }
    const result = await prisma.$transaction(async (tx: AnyTx) => {
      const combos = generateCombinations(validated.groups);
      const existingKeys = new Set((product.variants as any[]).map((v) => combinationKey(Array.isArray(v.attributes) ? v.attributes : [])));
      const taken = new Set<string>();
      const created: string[] = [];
      const skipped: string[] = [];
      for (const combo of combos) {
        if (existingKeys.has(combinationKey(combo))) {
          skipped.push(combinationName(combo));
          continue;
        }
        const resolved = await resolveVariantSku(tx, { base: variantSkuBase(product.name, combo), takenInRequest: taken });
        taken.add(resolved.sku);
        const row = await createVariantRow(tx, product.id, {
          variantName: combinationName(combo), attributes: combo, sku: resolved.sku, userEnteredSku: false,
          isDefault: false, sellingPrice: defaultSelling as number, importPrice: defaultImport as number | null,
          barcode: null, status: "active",
        });
        await auditVariant(tx, req, "variant.create", row.id, null, { sku: resolved.sku, variantName: combinationName(combo) });
        created.push(resolved.sku);
      }
      return { created, skipped };
    });
    res.status(201).json({ status: "ok", createdSkus: result.created, skippedCombinations: result.skipped });
  } catch (err) {
    if (err instanceof SkuConflict) {
      res.status(400).json({ status: "error", message: err.message, conflict: err.conflict });
      return;
    }
    if (err instanceof BadRequest) {
      res.status(400).json({ status: "error", message: err.message });
      return;
    }
    if (isPrismaUniqueError(err)) {
      res.status(400).json({ status: "error", message: "Mã SKU hoặc mã vạch đã tồn tại trong hệ thống." });
      return;
    }
    dbUnavailable(res, err);
  }
});

/** PATCH /api/products/:id/variants/:variantId — update one variant. */
router.patch("/products/:id/variants/:variantId", authorize("product.update"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const product = await prisma.product.findUnique({
      where: { id: req.params.id, deletedAt: null },
      include: { variants: { where: { deletedAt: null }, include: variantInclude } },
    });
    if (!product) {
      res.status(404).json({ status: "error", message: "Không tìm thấy sản phẩm." });
      return;
    }
    const updated = await prisma.$transaction(async (tx: AnyTx) => {
      return updateVariantRow(tx, req, product, { ...(req.body ?? {}), id: req.params.variantId });
    });
    const full = await prisma.productVariant.findUnique({
      where: { id: updated.id }, include: { product: true, inventoryItem: true },
    });
    res.json({ status: "ok", variant: serializeVariant(full, canViewCost(req)) });
  } catch (err) {
    if (err instanceof SkuConflict) {
      res.status(400).json({ status: "error", message: err.message, conflict: err.conflict });
      return;
    }
    if (err instanceof BadRequest) {
      res.status(400).json({ status: "error", message: err.message });
      return;
    }
    if (isPrismaUniqueError(err)) {
      res.status(400).json({ status: "error", message: "Mã SKU hoặc mã vạch đã tồn tại trong hệ thống." });
      return;
    }
    dbUnavailable(res, err);
  }
});

/** DELETE /api/products/:id/variants/:variantId — soft-deactivate by default; hard delete only for Admin with no history. */
router.delete("/products/:id/variants/:variantId", authorize("product.deactivate"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const variant = await prisma.productVariant.findUnique({
      where: { id: req.params.variantId, deletedAt: null },
      include: { product: true, inventoryItem: true },
    });
    if (!variant || variant.productId !== req.params.id || (variant.product as any)?.deletedAt) {
      res.status(404).json({ status: "error", message: "Không tìm thấy biến thể thuộc sản phẩm này." });
      return;
    }
    const hard = req.query.hard === "true";
    if (hard) {
      if (!req.user!.permissions.includes("product.hard_delete")) {
        res.status(403).json({ status: "error", message: "Chỉ Admin mới được xóa cứng SKU." });
        return;
      }
      const h = await variantHistory(prisma, variant.id);
      if (h.orderItems > 0 || h.transactions > 0 || h.stockQuantity !== 0) {
        res.status(400).json({
          status: "error",
          message: `Không thể xóa cứng SKU ${variant.sku} vì đã có dữ liệu liên quan (đơn: ${h.orderItems}, lịch sử kho: ${h.transactions}, tồn: ${h.stockQuantity}). Hãy chuyển sang Ngừng bán.`,
        });
        return;
      }
      await prisma.$transaction(async (tx: AnyTx) => {
        await tx.inventoryItem.deleteMany({ where: { variantId: variant.id } });
        await tx.productVariant.delete({ where: { id: variant.id } });
      });
      await writeAudit(prisma, {
        actorId: req.user!.id, action: "variant.hard_delete", entityType: "variant", entityId: variant.id,
        oldValue: { sku: variant.sku }, ipAddress: req.ip ?? null,
      });
      res.json({ status: "ok", message: "Đã xóa cứng SKU (không còn dữ liệu liên quan)." });
      return;
    }
    const siblings = await prisma.productVariant.count({ where: { productId: variant.productId, deletedAt: null, id: { not: variant.id } } });
    if (siblings === 0) {
      res.status(400).json({
        status: "error",
        message: "Đây là SKU duy nhất của sản phẩm. Hãy ngừng bán cả sản phẩm thay vì xóa SKU cuối cùng.",
      });
      return;
    }
    await prisma.productVariant.update({ where: { id: variant.id }, data: { status: "inactive", deletedAt: new Date() } });
    await writeAudit(prisma, {
      actorId: req.user!.id, action: "variant.deactivate", entityType: "variant", entityId: variant.id,
      oldValue: { status: variant.status }, newValue: { status: "inactive" }, ipAddress: req.ip ?? null,
    });
    res.json({ status: "ok", message: "Đã chuyển SKU sang Ngừng bán (xóa mềm)." });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* All SKUs: search                                                    */
/* ------------------------------------------------------------------ */

/** GET /api/variants — search every SKU (for selling / stock use later). */
router.get("/variants", authorize("product.view"), async (req, res) => {
  try {
    const prisma = getPrisma();
    const { page, pageSize } = parsePagination(req);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const productId = typeof req.query.productId === "string" ? req.query.productId : "";
    const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const sellable = req.query.sellable === "true";
    const minPrice = req.query.minPrice !== undefined ? Number(req.query.minPrice) : NaN;
    const maxPrice = req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : NaN;
    const canCost = canViewCost(req);

    const where: Record<string, unknown> = { deletedAt: null };
    if (productId) where.productId = productId;
    if (categoryId) where.product = { categoryId };
    if (status) {
      if (status !== "active" && status !== "inactive") {
        res.status(400).json({ status: "error", message: "Trạng thái SKU chỉ nhận active/inactive." });
        return;
      }
      where.status = status;
    }
    if (sellable) {
      where.status = "active";
      where.product = { ...(where.product as Record<string, unknown> ?? {}), status: "active", deletedAt: null };
    } else {
      where.product = { ...(where.product as Record<string, unknown> ?? {}), deletedAt: null };
    }
    if (!Number.isNaN(minPrice) || !Number.isNaN(maxPrice)) {
      where.sellingPrice = {
        ...(Number.isNaN(minPrice) ? {} : { gte: minPrice }),
        ...(Number.isNaN(maxPrice) ? {} : { lte: maxPrice }),
      };
    }
    if (q) {
      const normalizedQ = normalizeSku(q);
      where.OR = [
        { sku: { contains: normalizedQ, mode: "insensitive" } },
        { variantName: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
        { product: { name: { contains: q, mode: "insensitive" } } },
      ];
    }
    const [total, variants] = await Promise.all([
      prisma.productVariant.count({ where }),
      prisma.productVariant.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { product: true, inventoryItem: true },
      }),
    ]);
    res.json({
      status: "ok",
      page, pageSize, total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      variants: variants.map((v: any) => serializeVariant(v, canCost)),
    });
  } catch (err) {
    dbUnavailable(res, err);
  }
});

export default router;
