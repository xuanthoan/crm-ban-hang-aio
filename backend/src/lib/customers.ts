/**
 * Customer helpers — Sprint Customer.
 *
 * Locked rules 4.1 (docs/12) win over the old docs 00-11 here:
 *  - A customer has UNLIMITED phones via CustomerPhone, never phone_1/phone_2.
 *  - Exactly one primary phone per customer.
 *  - Duplicate checking covers ALL phones: every new/edited phone is
 *    compared against every ACTIVE phone of every OTHER customer
 *    (excluding the customer being edited) AND against the other phones
 *    in the same request. A match blocks the whole operation.
 */

import type { PrismaClient } from "@prisma/client";

/**
 * Normalize a phone number exactly as locked rules 4.1 require:
 * strip spaces, dots, dashes and parentheses, then convert a +84
 * prefix to 0. The result is stored in phoneNormalized.
 */
export function normalizePhone(raw: string): string {
  const stripped = raw.replace(/[\s.\-()]/g, "");
  if (stripped.startsWith("+84")) return `0${stripped.slice(3)}`;
  return stripped;
}

/** A normalized Vietnamese phone: starts with 0, 9-11 digits total. */
export function isValidPhoneNormalized(normalized: string): boolean {
  return /^0\d{8,10}$/.test(normalized);
}

/** Age in full years from a date of birth, computed on read, never stored. */
export function ageYears(dateOfBirth: Date | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age < 0 ? null : age;
}

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
  customerId: string;
  customerName: string;
}

/**
 * Validate + normalize a phone list from a create/update request.
 * Returns either the normalized list (with exactly one primary resolved)
 * or an error message to return as 400.
 *
 * Primary resolution (locked rules 4.1):
 *  - More than one isPrimary=true -> error.
 *  - Exactly one -> that one.
 *  - None and the list is non-empty -> the first phone becomes primary.
 *  - Empty list -> no primary (allowed only if the customer has a name).
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
        error: `Trong cùng một khách hàng, số ${phoneNormalized} bị lặp lại. Mỗi số chỉ được nhập một lần.`,
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
    return { phones: [], error: "Mỗi khách hàng chỉ được có đúng 1 số chính. Vui lòng chọn lại số chính." };
  }
  if (out.length > 0 && primaryCount === 0) out[0].isPrimary = true;
  return { phones: out };
}

/**
 * Global duplicate check: every normalized phone against every ACTIVE
 * phone of every OTHER customer. Inactive / soft-deleted phones and
 * phones of soft-deleted customers are ignored (they are history, not
 * live duplicates). Returns the first conflict found, or null.
 */
export async function findDuplicatePhone(
  prisma: PrismaClient,
  normalizedPhones: string[],
  excludeCustomerId?: string | null,
): Promise<DuplicateConflict | null> {
  if (normalizedPhones.length === 0) return null;
  const rows = await prisma.customerPhone.findMany({
    where: {
      phoneNormalized: { in: normalizedPhones },
      status: "active",
      deletedAt: null,
      customer: { deletedAt: null },
      ...(excludeCustomerId ? { customerId: { not: excludeCustomerId } } : {}),
    },
    include: { customer: { select: { id: true, fullName: true } } },
    take: 1,
  });
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    phone: row.phone,
    phoneNormalized: row.phoneNormalized,
    customerId: row.customer.id,
    customerName: row.customer.fullName || "(chưa có tên)",
  };
}

export function duplicateErrorMessage(conflict: DuplicateConflict): string {
  return (
    `Số điện thoại ${conflict.phoneNormalized} đã tồn tại ở khách hàng "${conflict.customerName}". ` +
    `Vui lòng mở hồ sơ khách hàng hiện có thay vì tạo mới.`
  );
}
