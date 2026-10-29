/**
 * Inventory service — Sprint Kho.
 *
 * Locked rules §2 (docs/12_QUY_TAC_CHOT_CUNG.md): this is the ONLY place
 * allowed to change InventoryItem.quantity. Every change writes one
 * immutable InventoryTransaction row (before / changed / after, reason,
 * reference, creator) in the SAME Prisma transaction as the quantity
 * update. No route may touch InventoryItem.quantity directly.
 *
 * Callers MUST run these functions inside prisma.$transaction(...) so a
 * multi-SKU operation is all-or-nothing: if any SKU would go negative,
 * the error propagates and Prisma rolls the whole transaction back —
 * no partial stock movement is ever committed.
 *
 * Transaction types are exactly the enum in schema.prisma:
 * initial, import, export, adjustment_increase, adjustment_decrease,
 * set, order_confirmed, order_cancelled, return.
 *
 * Inactive-SKU policy (decided in this sprint, see DEVELOPMENT_PLAN.md):
 *  - initial / import / export are BLOCKED for an inactive variant or an
 *    inactive parent product (restocking something that must not be sold
 *    would only create dead stock).
 *  - adjust is ALLOWED for an inactive variant, because dead stock still
 *    needs stocktaking / write-off, and docs 03 §20 explicitly allows
 *    adjusting an inactive SKU with a warning. The reason is mandatory
 *    and the audit record notes that the SKU was inactive.
 *  - deductForOrder blocks inactive variants (an inactive SKU must never
 *    be sold, locked rules §1). restoreForOrder allows them, because
 *    returning stock of a SKU that was deactivated after the sale is
 *    legitimate.
 */

export type InventoryTxType =
  | "initial"
  | "import"
  | "export"
  | "adjustment_increase"
  | "adjustment_decrease"
  | "set"
  | "order_confirmed"
  | "order_cancelled"
  | "return";

/** Error carrying an HTTP status, so routes can map it without guessing. */
export class InventoryError extends Error {
  status: number;
  variantId?: string;
  sku?: string;
  constructor(message: string, status = 400, variantId?: string, sku?: string) {
    super(message);
    this.status = status;
    this.variantId = variantId;
    this.sku = sku;
  }
}

export function isInventoryError(err: unknown): err is InventoryError {
  return err instanceof InventoryError;
}

export interface ApplyInput {
  variantId: string;
  type: InventoryTxType;
  /** Signed change: positive adds stock, negative removes it. Never 0. */
  quantityChanged: number;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  actorId?: string | null;
}

export interface StockLine {
  variantId: string;
  /** For increase/decrease/import/export: the positive amount. */
  quantity?: number;
  /** For set mode: the absolute target quantity. */
  setTo?: number;
  /** Per-line reason; falls back to the operation's common reason. */
  reason?: string;
  /** Only used by adjust lines: increase / decrease / set. */
  mode?: "increase" | "decrease" | "set";
}

export interface BulkResult {
  variantId: string;
  sku: string;
  variantName: string;
  quantityBefore: number;
  quantityChanged: number;
  quantityAfter: number;
  transactionId: string | null;
  /** True when an initial of 0 wrote no transaction (nothing changed). */
  skipped?: boolean;
  inactiveWarning?: boolean;
}

/* ------------------------------------------------------------------ */
/* Pure helpers — testable without a database                          */
/* ------------------------------------------------------------------ */

export function isIntegerQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/** quantityAfter = quantityBefore + quantityChanged. No clamping here. */
export function computeQuantityAfter(quantityBefore: number, quantityChanged: number): number {
  return quantityBefore + quantityChanged;
}

/**
 * Pure pre-check for a bulk operation: returns the first line that would
 * go negative, or null when every line is safe. Routes run this before
 * applying anything so the error names the offending SKU up front; the
 * Prisma transaction rollback is the second, authoritative guarantee.
 */
export function checkBulkNoNegative(
  lines: { variantId: string; sku?: string; quantityBefore: number; quantityChanged: number }[],
): { variantId: string; sku?: string; quantityBefore: number; quantityChanged: number; quantityAfter: number } | null {
  for (const line of lines) {
    const after = computeQuantityAfter(line.quantityBefore, line.quantityChanged);
    if (after < 0) {
      return { ...line, quantityAfter: after };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Loading helpers (all inside the caller's transaction)               */
/* ------------------------------------------------------------------ */

type AnyTx = any;

async function loadVariant(tx: AnyTx, variantId: string): Promise<any> {
  const variant = await tx.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true },
  });
  if (!variant || variant.deletedAt) {
    throw new InventoryError(`Không tìm thấy SKU với id ${variantId}.`, 404, variantId);
  }
  return variant;
}

function isVariantSellable(variant: any): boolean {
  return variant.status === "active" && variant.product && variant.product.status === "active" && !variant.product.deletedAt;
}

/** Inbound stock (initial/import/export) is refused for inactive SKUs. */
function assertActiveForInbound(variant: any): void {
  if (!isVariantSellable(variant)) {
    throw new InventoryError(
      `SKU ${variant.sku} đang ngừng bán (biến thể hoặc sản phẩm cha không còn active) nên không được nhập/xuất kho. Muốn xử lý tồn của SKU này, hãy dùng điều chỉnh kho kèm lý do.`,
      400,
      variant.id,
      variant.sku,
    );
  }
}

async function getOrCreateItem(tx: AnyTx, variantId: string): Promise<any> {
  const existing = await tx.inventoryItem.findUnique({ where: { variantId } });
  if (existing) return existing;
  return tx.inventoryItem.create({ data: { variantId, warehouseCode: "MAIN", quantity: 0 } });
}

async function loadItemQuantity(tx: AnyTx, variantId: string): Promise<number> {
  const item = await tx.inventoryItem.findUnique({ where: { variantId } });
  return item ? item.quantity : 0;
}

/* ------------------------------------------------------------------ */
/* Central change function — the only quantity writer                  */
/* ------------------------------------------------------------------ */

/**
 * Apply ONE stock change. Validates the change, refuses negative stock,
 * writes the immutable transaction row, then updates the item — all in
 * the caller's transaction. A zero change is rejected: an empty
 * transaction row would be noise in the audit history.
 */
export async function applyInventoryChange(
  tx: AnyTx,
  input: ApplyInput,
): Promise<{ item: any; transaction: any }> {
  if (!isIntegerQuantity(input.quantityChanged) || input.quantityChanged === 0) {
    throw new InventoryError("Số lượng thay đổi kho phải là số nguyên khác 0.", 400, input.variantId);
  }
  if (typeof input.reason !== "string" || !input.reason.trim()) {
    throw new InventoryError("Mọi thay đổi kho đều bắt buộc có lý do.", 400, input.variantId);
  }
  const item = await getOrCreateItem(tx, input.variantId);
  const quantityBefore: number = item.quantity;
  const quantityAfter = computeQuantityAfter(quantityBefore, input.quantityChanged);
  if (quantityAfter < 0) {
    throw new InventoryError(
      `Không thể thay đổi tồn kho: tồn sau thay đổi sẽ âm (${quantityBefore} + ${input.quantityChanged} = ${quantityAfter}). Toàn bộ thao tác đã bị hủy, không trừ một phần.`,
      400,
      input.variantId,
    );
  }
  const transaction = await tx.inventoryTransaction.create({
    data: {
      productVariantId: input.variantId,
      transactionType: input.type,
      quantityBefore,
      quantityChanged: input.quantityChanged,
      quantityAfter,
      reason: input.reason.trim(),
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      createdById: input.actorId ?? null,
    },
  });
  const updated = await tx.inventoryItem.update({
    where: { id: item.id },
    data: { quantity: quantityAfter },
  });
  return { item: updated, transaction };
}

/* ------------------------------------------------------------------ */
/* Manual operations (routes call these, never apply directly)         */
/* ------------------------------------------------------------------ */

function requireReason(reason: string | undefined | null, fallback?: string | null): string {
  const value = (reason ?? fallback ?? "").trim();
  if (!value) {
    throw new InventoryError("Thao tác kho thủ công bắt buộc phải có lý do. Vui lòng nhập lý do.", 400);
  }
  return value;
}

function requirePositiveQuantity(value: unknown, label: string, variantId: string): number {
  if (!isIntegerQuantity(value) || (value as number) <= 0) {
    throw new InventoryError(`${label} phải là số nguyên lớn hơn 0.`, 400, variantId);
  }
  return value as number;
}

/**
 * Initial stock. Allowed ONLY when the SKU has never had any inventory
 * transaction (no initial, no import/export/adjust/order movement yet).
 * A second initial is a 409 conflict, never a silent overwrite.
 * An initial of 0 writes no transaction (nothing changed) and leaves
 * the first real initial available; it only ensures the item row exists.
 */
export async function initialStock(
  tx: AnyTx,
  input: { variantId: string; quantity: unknown; reason?: string | null; actorId?: string | null },
): Promise<BulkResult> {
  if (!isIntegerQuantity(input.quantity) || (input.quantity as number) < 0) {
    throw new InventoryError("Tồn ban đầu phải là số nguyên không âm.", 400, input.variantId);
  }
  const variant = await loadVariant(tx, input.variantId);
  assertActiveForInbound(variant);
  const quantity = input.quantity as number;
  if (quantity === 0) {
    const item = await getOrCreateItem(tx, input.variantId);
    return {
      variantId: variant.id,
      sku: variant.sku,
      variantName: variant.variantName,
      quantityBefore: item.quantity,
      quantityChanged: 0,
      quantityAfter: item.quantity,
      transactionId: null,
      skipped: true,
    };
  }
  const existingCount = await tx.inventoryTransaction.count({
    where: { productVariantId: input.variantId },
  });
  if (existingCount > 0) {
    throw new InventoryError(
      `SKU ${variant.sku} đã có lịch sử kho nên không được nhập tồn ban đầu lần nữa. Hãy dùng điều chỉnh kho kèm lý do để sửa tồn.`,
      409,
      variant.id,
      variant.sku,
    );
  }
  const reason = (input.reason ?? "").trim() || "Nhập tồn ban đầu";
  const { item, transaction } = await applyInventoryChange(tx, {
    variantId: variant.id,
    type: "initial",
    quantityChanged: quantity,
    reason,
    referenceType: "initial_stock",
    actorId: input.actorId ?? null,
  });
  return {
    variantId: variant.id,
    sku: variant.sku,
    variantName: variant.variantName,
    quantityBefore: item.quantity - quantity,
    quantityChanged: quantity,
    quantityAfter: item.quantity,
    transactionId: transaction.id,
  };
}

export async function importStock(
  tx: AnyTx,
  input: { variantId: string; quantity: unknown; reason?: string | null; actorId?: string | null },
): Promise<BulkResult> {
  const variant = await loadVariant(tx, input.variantId);
  assertActiveForInbound(variant);
  const quantity = requirePositiveQuantity(input.quantity, "Số lượng nhập kho", input.variantId);
  const reason = requireReason(input.reason);
  const before = await loadItemQuantity(tx, input.variantId);
  const { item, transaction } = await applyInventoryChange(tx, {
    variantId: variant.id,
    type: "import",
    quantityChanged: quantity,
    reason,
    referenceType: "manual_import",
    actorId: input.actorId ?? null,
  });
  return {
    variantId: variant.id,
    sku: variant.sku,
    variantName: variant.variantName,
    quantityBefore: before,
    quantityChanged: quantity,
    quantityAfter: item.quantity,
    transactionId: transaction.id,
  };
}

export async function exportStock(
  tx: AnyTx,
  input: { variantId: string; quantity: unknown; reason?: string | null; actorId?: string | null },
): Promise<BulkResult> {
  const variant = await loadVariant(tx, input.variantId);
  assertActiveForInbound(variant);
  const quantity = requirePositiveQuantity(input.quantity, "Số lượng xuất kho", input.variantId);
  const reason = requireReason(input.reason);
  const before = await loadItemQuantity(tx, input.variantId);
  const { item, transaction } = await applyInventoryChange(tx, {
    variantId: variant.id,
    type: "export",
    quantityChanged: -quantity,
    reason,
    referenceType: "manual_export",
    actorId: input.actorId ?? null,
  });
  return {
    variantId: variant.id,
    sku: variant.sku,
    variantName: variant.variantName,
    quantityBefore: before,
    quantityChanged: -quantity,
    quantityAfter: item.quantity,
    transactionId: transaction.id,
  };
}

/**
 * Manual adjustment: increase / decrease / set.
 * - increase: quantity > 0, type adjustment_increase.
 * - decrease: quantity > 0, type adjustment_decrease (blocked if negative).
 * - set: setTo >= 0, type set, changed = setTo - before; changed 0 is
 *   rejected (no empty transaction row).
 * Adjust is allowed for inactive SKUs (stocktaking / write-off), but the
 * result flags inactiveWarning so the caller can surface the warning.
 */
export async function adjustStock(
  tx: AnyTx,
  input: {
    variantId: string;
    mode: "increase" | "decrease" | "set";
    quantity?: unknown;
    setTo?: unknown;
    reason?: string | null;
    actorId?: string | null;
  },
): Promise<BulkResult> {
  const variant = await loadVariant(tx, input.variantId);
  const reason = requireReason(input.reason);
  const before = await loadItemQuantity(tx, input.variantId);
  let type: InventoryTxType;
  let changed: number;
  if (input.mode === "increase") {
    type = "adjustment_increase";
    changed = requirePositiveQuantity(input.quantity, "Số lượng điều chỉnh tăng", input.variantId);
  } else if (input.mode === "decrease") {
    type = "adjustment_decrease";
    changed = -requirePositiveQuantity(input.quantity, "Số lượng điều chỉnh giảm", input.variantId);
  } else if (input.mode === "set") {
    if (!isIntegerQuantity(input.setTo) || (input.setTo as number) < 0) {
      throw new InventoryError("Tồn đặt về phải là số nguyên không âm.", 400, input.variantId);
    }
    type = "set";
    changed = (input.setTo as number) - before;
    if (changed === 0) {
      throw new InventoryError(
        `SKU ${variant.sku} đã có tồn đúng ${before}, không cần điều chỉnh và không ghi transaction rỗng.`,
        400,
        input.variantId,
        variant.sku,
      );
    }
  } else {
    throw new InventoryError("Loại điều chỉnh chỉ nhận increase / decrease / set.", 400, input.variantId);
  }
  const { item, transaction } = await applyInventoryChange(tx, {
    variantId: variant.id,
    type,
    quantityChanged: changed,
    reason,
    referenceType: "manual_adjust",
    actorId: input.actorId ?? null,
  });
  return {
    variantId: variant.id,
    sku: variant.sku,
    variantName: variant.variantName,
    quantityBefore: before,
    quantityChanged: changed,
    quantityAfter: item.quantity,
    transactionId: transaction.id,
    inactiveWarning: !isVariantSellable(variant),
  };
}

/* ------------------------------------------------------------------ */
/* Bulk operations — validated up front, applied in one transaction    */
/* ------------------------------------------------------------------ */

/**
 * Bulk import / export / initial: every line is validated (variant
 * exists, active for inbound, positive quantity, reason present) and the
 * whole batch is pre-checked for negative stock BEFORE anything is
 * applied. The caller's $transaction is the final guarantee: any error
 * mid-batch rolls everything back.
 */
export async function bulkStock(
  tx: AnyTx,
  kind: "initial" | "import" | "export",
  lines: StockLine[],
  commonReason: string | undefined | null,
  actorId: string | null,
): Promise<BulkResult[]> {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new InventoryError("Cần ít nhất một dòng SKU để thực hiện thao tác kho hàng loạt.", 400);
  }
  // Phase 1 — validate + pre-check, no writes.
  const prepared: { variant: any; quantity: number; reason: string; before: number }[] = [];
  for (const line of lines) {
    const variant = await loadVariant(tx, line.variantId);
    assertActiveForInbound(variant);
    const quantity = requirePositiveQuantity(line.quantity, "Số lượng kho", line.variantId);
    const reason = kind === "initial" ? (line.reason ?? commonReason ?? "").trim() || "Nhập tồn ban đầu" : requireReason(line.reason, commonReason);
    const before = await loadItemQuantity(tx, line.variantId);
    prepared.push({ variant, quantity, reason, before });
  }
  const changedOf = (p: { quantity: number }) => (kind === "export" ? -p.quantity : p.quantity);
  const offending = checkBulkNoNegative(
    prepared.map((p) => ({
      variantId: p.variant.id,
      sku: p.variant.sku,
      quantityBefore: p.before,
      quantityChanged: changedOf(p),
    })),
  );
  if (offending) {
    throw new InventoryError(
      `Thao tác hàng loạt bị hủy toàn bộ: SKU ${offending.sku ?? offending.variantId} sẽ âm tồn (${offending.quantityBefore} + ${offending.quantityChanged} = ${offending.quantityAfter}). Không có dòng nào được áp dụng.`,
      400,
      offending.variantId,
      offending.sku,
    );
  }
  // Phase 2 — apply in order; any error here still rolls back via $transaction.
  const results: BulkResult[] = [];
  for (const p of prepared) {
    if (kind === "initial") {
      results.push(await initialStock(tx, { variantId: p.variant.id, quantity: p.quantity, reason: p.reason, actorId }));
    } else if (kind === "import") {
      results.push(await importStock(tx, { variantId: p.variant.id, quantity: p.quantity, reason: p.reason, actorId }));
    } else {
      results.push(await exportStock(tx, { variantId: p.variant.id, quantity: p.quantity, reason: p.reason, actorId }));
    }
  }
  return results;
}

/** Bulk adjust: per-line mode, same validate-first / all-or-nothing rule. */
export async function bulkAdjust(
  tx: AnyTx,
  lines: (StockLine & { mode: "increase" | "decrease" | "set" })[],
  commonReason: string | undefined | null,
  actorId: string | null,
): Promise<BulkResult[]> {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new InventoryError("Cần ít nhất một dòng SKU để điều chỉnh kho hàng loạt.", 400);
  }
  const prepared: { variant: any; mode: "increase" | "decrease" | "set"; quantity?: number; setTo?: number; reason: string; before: number; changed: number }[] = [];
  for (const line of lines) {
    const variant = await loadVariant(tx, line.variantId);
    const reason = requireReason(line.reason, commonReason);
    const before = await loadItemQuantity(tx, line.variantId);
    let changed: number;
    if (line.mode === "increase") {
      changed = requirePositiveQuantity(line.quantity, "Số lượng điều chỉnh tăng", line.variantId);
    } else if (line.mode === "decrease") {
      changed = -requirePositiveQuantity(line.quantity, "Số lượng điều chỉnh giảm", line.variantId);
    } else if (line.mode === "set") {
      if (!isIntegerQuantity(line.setTo) || (line.setTo as number) < 0) {
        throw new InventoryError("Tồn đặt về phải là số nguyên không âm.", 400, line.variantId);
      }
      changed = (line.setTo as number) - before;
      if (changed === 0) {
        throw new InventoryError(`SKU ${variant.sku} đã có tồn đúng ${before}, không ghi transaction rỗng.`, 400, line.variantId, variant.sku);
      }
    } else {
      throw new InventoryError("Loại điều chỉnh chỉ nhận increase / decrease / set.", 400, line.variantId);
    }
    prepared.push({ variant, mode: line.mode, quantity: line.quantity, setTo: line.setTo, reason, before, changed });
  }
  const offending = checkBulkNoNegative(
    prepared.map((p) => ({ variantId: p.variant.id, sku: p.variant.sku, quantityBefore: p.before, quantityChanged: p.changed })),
  );
  if (offending) {
    throw new InventoryError(
      `Điều chỉnh hàng loạt bị hủy toàn bộ: SKU ${offending.sku ?? offending.variantId} sẽ âm tồn (${offending.quantityBefore} + ${offending.quantityChanged} = ${offending.quantityAfter}). Không có dòng nào được áp dụng.`,
      400,
      offending.variantId,
      offending.sku,
    );
  }
  const results: BulkResult[] = [];
  for (const p of prepared) {
    results.push(
      await adjustStock(tx, { variantId: p.variant.id, mode: p.mode, quantity: p.quantity, setTo: p.setTo, reason: p.reason, actorId }),
    );
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* Order integration — NO order routes in this sprint                  */
/* ------------------------------------------------------------------ */

export interface OrderForInventory {
  id: string;
  orderCode?: string | null;
  inventoryDeducted: boolean;
  inventoryRestored: boolean;
  items: { productVariantId: string; quantity: number }[];
}

/**
 * Deduct stock when an order moves draft -> confirmed (locked rules §2.3).
 * To be called by the Order sprint INSIDE its order-status transaction.
 * If inventoryDeducted is already true, this throws 409 and writes NO
 * new order_confirmed transaction — a second confirm can never deduct
 * twice. Inactive variants are also refused here (must not be sold).
 */
export async function deductForOrder(tx: AnyTx, order: OrderForInventory, actorId: string | null): Promise<void> {
  if (order.inventoryDeducted) {
    throw new InventoryError(
      `Đơn ${order.orderCode ?? order.id} đã trừ kho rồi, không được trừ kho lần nữa.`,
      409,
      undefined,
    );
  }
  if (!order.items || order.items.length === 0) {
    throw new InventoryError("Đơn hàng không có dòng hàng nào để trừ kho.", 400);
  }
  for (const item of order.items) {
    if (!isIntegerQuantity(item.quantity) || item.quantity <= 0) {
      throw new InventoryError("Số lượng dòng đơn phải là số nguyên lớn hơn 0.", 400, item.productVariantId);
    }
    const variant = await loadVariant(tx, item.productVariantId);
    if (!isVariantSellable(variant)) {
      throw new InventoryError(
        `SKU ${variant.sku} đang ngừng bán nên không được trừ kho để bán.`,
        400,
        variant.id,
        variant.sku,
      );
    }
    await applyInventoryChange(tx, {
      variantId: variant.id,
      type: "order_confirmed",
      quantityChanged: -item.quantity,
      reason: `Trừ kho khi xác nhận đơn ${order.orderCode ?? order.id}`,
      referenceType: "order",
      referenceId: order.id,
      actorId,
    });
  }
  await tx.order.update({
    where: { id: order.id },
    data: { inventoryDeducted: true, inventoryDeductedAt: new Date() },
  });
}

/**
 * Restore stock when a previously deducted order is cancelled/returned.
 * To be called by the Order sprint INSIDE its order-status transaction.
 * Refuses when the order was never deducted (nothing to restore) and
 * when inventoryRestored is already true (never restore twice).
 * Restoring is allowed even if the SKU has since become inactive.
 */
export async function restoreForOrder(tx: AnyTx, order: OrderForInventory, actorId: string | null): Promise<void> {
  if (!order.inventoryDeducted) {
    throw new InventoryError(
      `Đơn ${order.orderCode ?? order.id} chưa từng trừ kho nên không có gì để hoàn kho.`,
      409,
    );
  }
  if (order.inventoryRestored) {
    throw new InventoryError(
      `Đơn ${order.orderCode ?? order.id} đã hoàn kho rồi, không được hoàn kho lần nữa.`,
      409,
    );
  }
  if (!order.items || order.items.length === 0) {
    throw new InventoryError("Đơn hàng không có dòng hàng nào để hoàn kho.", 400);
  }
  for (const item of order.items) {
    if (!isIntegerQuantity(item.quantity) || item.quantity <= 0) {
      throw new InventoryError("Số lượng dòng đơn phải là số nguyên lớn hơn 0.", 400, item.productVariantId);
    }
    await loadVariant(tx, item.productVariantId);
    await applyInventoryChange(tx, {
      variantId: item.productVariantId,
      type: "order_cancelled",
      quantityChanged: item.quantity,
      reason: `Hoàn kho khi hủy đơn ${order.orderCode ?? order.id}`,
      referenceType: "order",
      referenceId: order.id,
      actorId,
    });
  }
  await tx.order.update({
    where: { id: order.id },
    data: { inventoryRestored: true, inventoryRestoredAt: new Date() },
  });
}
