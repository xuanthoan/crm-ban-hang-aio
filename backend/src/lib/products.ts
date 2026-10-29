/**
 * Product / SKU pure helpers — Sprint Product/SKU.
 *
 * Locked rules applied here (docs/12 §1, §4.2, §5):
 *  - The parent Product is NEVER the selling unit; only ProductVariant/SKU is.
 *  - A product with no variants gets exactly ONE default variant (isDefault).
 *  - SKU is stored trimmed + upper-cased. A user-entered duplicate SKU is
 *    an error and is NEVER silently renamed by the system.
 *  - A system-generated duplicate SKU gets suffixes -002, -003, ... until free.
 *  - A SKU is never reused while its variant row exists, even if the variant
 *    is inactive or soft-deleted (the DB unique constraint enforces this
 *    too, and the service checks all non-hard-deleted variants).
 *
 * This module is deliberately pure (no Prisma import at runtime) so the
 * helpers can be unit-tested without a database or a generated client.
 * Database lookups (existing SKUs, existing attribute combinations) live
 * in the route layer, which passes their results in as plain sets.
 */

/** One attribute group, e.g. { name: "Màu sắc", values: ["Đen", "Trắng"] }. */
export interface OptionGroup {
  name: string;
  values: string[];
}

/** One attribute name/value pair stored on a variant (attributes JSON). */
export interface VariantAttribute {
  name: string;
  value: string;
}

/** Maximum attribute groups per product (spec 02 §10: at most 3). */
export const MAX_OPTION_GROUPS = 3;
/** Maximum generated combinations per product (spec 02 §11.5, MVP choice). */
export const MAX_GENERATED_VARIANTS = 200;

/**
 * SKU as stored in the database: trimmed and fully upper-cased.
 * Inner whitespace collapses to a single space before upper-casing, so
 * " ao 123 " and "AO 123" compare equal. Hyphens are kept as typed.
 */
export function normalizeSku(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

/** Vietnamese diacritics -> ASCII, for system-generated SKU slugs. */
const DIACRITICS: Record<string, string> = {
  à: "a", á: "a", ả: "a", ã: "a", ạ: "a",
  ă: "a", ắ: "a", ằ: "a", ẳ: "a", ẵ: "a", ặ: "a",
  â: "a", ấ: "a", ầ: "a", ẩ: "a", ẫ: "a", ậ: "a",
  đ: "d",
  è: "e", é: "e", ẻ: "e", ẽ: "e", ẹ: "e",
  ê: "e", ế: "e", ề: "e", ể: "e", ễ: "e", ệ: "e",
  ì: "i", í: "i", ỉ: "i", ĩ: "i", ị: "i",
  ò: "o", ó: "o", ỏ: "o", õ: "o", ọ: "o",
  ô: "o", ố: "o", ồ: "o", ổ: "o", ỗ: "o", ộ: "o",
  ơ: "o", ớ: "o", ờ: "o", ở: "o", ỡ: "o", ợ: "o",
  ù: "u", ú: "u", ủ: "u", ũ: "u", ụ: "u",
  ư: "u", ứ: "u", ừ: "u", ử: "u", ữ: "u", ự: "u",
  ỳ: "y", ý: "y", ỷ: "y", ỹ: "y", ỵ: "y",
};

export function stripDiacritics(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => DIACRITICS[ch] ?? ch)
    .join("");
}

/**
 * Slug for SKU generation: "Áo thun nữ 2027" -> "AO-THUN-NU-2027",
 * "Đỏ đô" -> "DO-DO". Non-alphanumeric runs become a single hyphen.
 * Result is upper-cased and capped at 60 chars (trailing hyphen trimmed).
 */
export function slugify(text: string): string {
  const slug = stripDiacritics(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug;
}

/** Base SKU for a variant: product slug + attribute slugs, e.g. AO-THUN-NU-2027-DEN-S. */
export function variantSkuBase(productName: string, attributes: VariantAttribute[]): string {
  const parts = [slugify(productName), ...attributes.map((a) => slugify(a.value))].filter(Boolean);
  return parts.join("-") || "SP";
}

/**
 * Resolve a system-generated SKU against the set of SKUs already taken
 * (existing DB SKUs + SKUs already allocated in this same request).
 * Returns the base when free, otherwise base-002, base-003, ... .
 * The caller MUST add the returned value to `taken` before the next call.
 */
export function resolveAutoSku(base: string, taken: Set<string>): string {
  const clean = normalizeSku(base) || "SP";
  if (!taken.has(clean)) return clean;
  let n = 2;
  for (;;) {
    const candidate = `${clean}-${String(n).padStart(3, "0")}`;
    if (!taken.has(candidate)) return candidate;
    n += 1;
  }
}

/** Cartesian product of option groups, preserving group order. */
export function generateCombinations(groups: OptionGroup[]): VariantAttribute[][] {
  let combos: VariantAttribute[][] = [[]];
  for (const group of groups) {
    const next: VariantAttribute[][] = [];
    for (const combo of combos) {
      for (const value of group.values) {
        next.push([...combo, { name: group.name, value }]);
      }
    }
    combos = next;
  }
  return combos;
}

/** Display name of a combination: values joined with " / ", e.g. "Đen / S". */
export function combinationName(attributes: VariantAttribute[]): string {
  return attributes.map((a) => a.value).join(" / ");
}

/** Canonical key for an attribute combination (order + names + values). */
export function combinationKey(attributes: VariantAttribute[]): string {
  return attributes.map((a) => `${a.name.trim().toLowerCase()}=${a.value.trim().toLowerCase()}`).join("|");
}

/** Validate option groups: 1..3 groups, unique names, non-empty unique values. */
export function validateOptionGroups(input: unknown): { groups: OptionGroup[]; error?: string } {
  if (!Array.isArray(input) || input.length === 0) {
    return { groups: [], error: "Cần ít nhất 1 nhóm thuộc tính để sinh tổ hợp biến thể." };
  }
  if (input.length > MAX_OPTION_GROUPS) {
    return { groups: [], error: `Tối đa ${MAX_OPTION_GROUPS} nhóm thuộc tính cho một sản phẩm (đặc tả 02 §10).` };
  }
  const names = new Set<string>();
  const groups: OptionGroup[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return { groups: [], error: "Mỗi nhóm thuộc tính phải là một đối tượng." };
    const g = item as Record<string, unknown>;
    if (typeof g.name !== "string" || !g.name.trim()) {
      return { groups: [], error: "Tên nhóm thuộc tính không được để trống." };
    }
    const name = g.name.trim();
    if (names.has(name.toLowerCase())) {
      return { groups: [], error: `Tên nhóm thuộc tính "${name}" bị trùng trong cùng một sản phẩm.` };
    }
    names.add(name.toLowerCase());
    if (!Array.isArray(g.values) || g.values.length === 0) {
      return { groups: [], error: `Nhóm "${name}" phải có ít nhất một giá trị.` };
    }
    const seen = new Set<string>();
    const values: string[] = [];
    for (const v of g.values) {
      if (typeof v !== "string" || !v.trim()) {
        return { groups: [], error: `Giá trị của nhóm "${name}" không được để trống.` };
      }
      const value = v.trim();
      if (seen.has(value.toLowerCase())) {
        return { groups: [], error: `Giá trị "${value}" bị trùng trong nhóm "${name}".` };
      }
      seen.add(value.toLowerCase());
      values.push(value);
    }
    groups.push({ name, values });
  }
  const total = groups.reduce((acc, g) => acc * g.values.length, 1);
  if (total > MAX_GENERATED_VARIANTS) {
    return {
      groups: [],
      error: `Sinh ${total} SKU vượt giới hạn ${MAX_GENERATED_VARIANTS} SKU cho một sản phẩm. Hãy giảm số giá trị thuộc tính.`,
    };
  }
  return { groups };
}

/** Validate an attributes array coming from a client (at most 3 pairs). */
export function validateAttributes(input: unknown): { attributes: VariantAttribute[]; error?: string } {
  if (input === undefined || input === null) return { attributes: [] };
  if (!Array.isArray(input)) return { attributes: [], error: "attributes phải là một danh sách." };
  if (input.length > MAX_OPTION_GROUPS) {
    return { attributes: [], error: `Tối đa ${MAX_OPTION_GROUPS} thuộc tính cho một biến thể.` };
  }
  const names = new Set<string>();
  const out: VariantAttribute[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return { attributes: [], error: "Mỗi thuộc tính phải là một đối tượng." };
    const a = item as Record<string, unknown>;
    if (typeof a.name !== "string" || !a.name.trim() || typeof a.value !== "string" || !a.value.trim()) {
      return { attributes: [], error: "Mỗi thuộc tính cần có tên và giá trị không trống." };
    }
    const name = a.name.trim();
    if (names.has(name.toLowerCase())) {
      return { attributes: [], error: `Thuộc tính "${name}" bị trùng trong cùng một biến thể.` };
    }
    names.add(name.toLowerCase());
    out.push({ name, value: (a.value as string).trim() });
  }
  return { attributes: out };
}

/** A price is valid when it is a finite number >= 0. */
export function isValidPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
