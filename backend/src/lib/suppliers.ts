/**
 * Supplier helpers — Sprint NCC-1 (directory only).
 *
 * Mirrors backend/src/lib/customers.ts, adapted for suppliers
 * (design 13 §1.4, §2.2, §7.3):
 *  - A supplier has UNLIMITED phones via SupplierPhone, never a fixed
 *    phone_1/phone_2 pair.
 *  - Exactly one primary phone per supplier.
 *  - Duplicate checking covers ALL phones: every new/edited phone is
 *    compared against every ACTIVE phone of every OTHER supplier
 *    (excluding the supplier being edited) AND against the other phones
 *    in the same request. A match blocks the whole operation.
 *  - Phones are NOT checked against customer phones: one number may
 *    belong to both a customer and a supplier (design 13 §7.3).
 *
 * NOTE on types: this file deliberately uses `any` for the Prisma
 * client instead of importing the PrismaClient type, so `tsc --noEmit`
 * in a checkout without a generated client reports no new errors
 * (the same convention as backend/src/routes/*.ts).
 */

import { isValidPhoneNormalized, normalizePhone } from "./customers";

export interface PhoneInput {
  /** Existing phone row id, for updates. Omitted for new phones. */
  id?: string;
  phone: string;
  label?: string | null;
  isPrimary?: boolean;
}

export interface NormalizedPhone {
  phone: string;
  phoneNormalized: string;
  label: string | null;
  isPrimary: boolean;
}

export interface DuplicateConflict {
  phone: string;
  phoneNormalized: string;
  supplierId: string;
  supplierName: string;
}

/**
 * Validate + normalize a phone list from a create/update request.
 * Returns either the normalized list (with exactly one primary resolved)
 * or an error message to return as 400.
 *
 * Primary resolution (same rule as customers):
 *  - More than one isPrimary=true -> error.
 *  - Exactly one -> that one.
 *  - None and the list is non-empty -> the first phone becomes primary.
 *  - Empty list -> no primary (a supplier needs a name, not a phone).
 */
export function normalizePhoneList(
  phones: unknown,
): { phones: NormalizedPhone[]; error?: string } {
  if (!Array.isArray(phones)) return { phones: [], error: "phones phải là một danh sách." };
  const out: NormalizedPhone[] = [];
  const seen = new Set<string>();
  for (const item of phones) {
    if (!item || typeof item !== "object") return { phones: [], error: "Mỗi số điện thoại phải là một đối tượng." };
    const raw = (item as PhoneInput).phone;
    if (typeof raw !== "string" || !raw.trim()) {
      return { phones: [], error: "Số điện thoại không được để trống." };
    }
    const phoneNormalized = normalizePhone(raw);
    if (!isValidPhoneNormalized(phoneNormalized)) {
      return {
        phones: [],
        error: `Số điện thoại "${raw.trim()}" không hợp lệ sau khi chuẩn hóa (cần bắt đầu bằng 0, 9-11 chữ số).`,
      };
    }
    if (seen.has(phoneNormalized)) {
      return {
        phones: [],
        error: `Trong cùng một nhà cung cấp, số ${phoneNormalized} bị lặp lại. Mỗi số chỉ được nhập một lần.`,
      };
    }
    seen.add(phoneNormalized);
    out.push({
      phone: raw.trim(),
      phoneNormalized,
      label: typeof (item as PhoneInput).label === "string" ? (item as PhoneInput).label!.trim() || null : null,
      isPrimary: (item as PhoneInput).isPrimary === true,
    });
  }
  const primaryCount = out.filter((p) => p.isPrimary).length;
  if (primaryCount > 1) {
    return { phones: [], error: "Mỗi nhà cung cấp chỉ được có đúng 1 số chính. Vui lòng chọn lại số chính." };
  }
  if (out.length > 0 && primaryCount === 0) out[0].isPrimary = true;
  return { phones: out };
}

/**
 * Duplicate check across suppliers: every normalized phone against every
 * ACTIVE phone of every OTHER supplier. Inactive / soft-deleted phones
 * are ignored (they are history, not live duplicates). Returns the first
 * conflict found, or null.
 */
export async function findDuplicatePhone(
  prisma: any,
  normalizedPhones: string[],
  excludeSupplierId?: string | null,
): Promise<DuplicateConflict | null> {
  if (normalizedPhones.length === 0) return null;
  const rows = await prisma.supplierPhone.findMany({
    where: {
      phoneNormalized: { in: normalizedPhones },
      status: "active",
      deletedAt: null,
      ...(excludeSupplierId ? { supplierId: { not: excludeSupplierId } } : {}),
    },
    include: { supplier: { select: { id: true, name: true } } },
    take: 1,
  });
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    phone: row.phone,
    phoneNormalized: row.phoneNormalized,
    supplierId: row.supplier.id,
    supplierName: row.supplier.name || "(chưa có tên)",
  };
}

export function duplicateErrorMessage(conflict: DuplicateConflict): string {
  return (
    `Số điện thoại ${conflict.phoneNormalized} đã tồn tại ở nhà cung cấp "${conflict.supplierName}". ` +
    `Vui lòng mở hồ sơ nhà cung cấp hiện có thay vì tạo mới.`
  );
}
