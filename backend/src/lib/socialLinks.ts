/** Social links (Facebook / Zalo / WhatsApp / Telegram / Viber / Website) shared
 * by the customer and supplier routes. Fixed set of 6 platforms,
 * unlimited links per platform and no duplicate check: the same url may
 * legitimately appear on several links or owners.
 *
 * Validation is deliberately permissive about the url shape: it must be
 * non-empty (max 500 chars) but need not start with a scheme, because
 * users commonly paste "zalo.me/..." or "facebook.com/..." without
 * "https://". Display adds the scheme (see socialLinkHref in
 * frontend/src/labels.ts); storage keeps exactly what the user typed.
 */

export const SOCIAL_PLATFORMS = ["facebook", "zalo", "whatsapp", "telegram", "viber", "website"] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface NormalizedSocialLink {
  platform: SocialPlatform;
  url: string;
  label: string;
}

export function normalizeSocialLinks(input: unknown): {
  links: NormalizedSocialLink[];
  error?: string;
} {
  if (input === undefined || input === null) return { links: [] };
  if (!Array.isArray(input)) return { links: [], error: "Danh sách link mạng xã hội không hợp lệ." };
  const links: NormalizedSocialLink[] = [];
  for (const raw of input) {
    const item: any = raw ?? {};
    const platform = typeof item.platform === "string" ? item.platform.trim() : "";
    if (!(SOCIAL_PLATFORMS as readonly string[]).includes(platform)) {
      return { links: [], error: "Nền tảng mạng xã hội không hợp lệ. Chỉ nhận Facebook, Zalo, WhatsApp, Telegram, Viber, Website." };
    }
    const url = typeof item.url === "string" ? item.url.trim() : "";
    if (!url) return { links: [], error: "Link mạng xã hội không được để trống." };
    if (url.length > 500) return { links: [], error: "Link mạng xã hội quá dài (tối đa 500 ký tự)." };
    const label = typeof item.label === "string" ? item.label.trim() : "";
    if (label.length > 100) return { links: [], error: "Nhãn link mạng xã hội quá dài (tối đa 100 ký tự)." };
    links.push({ platform: platform as SocialPlatform, url, label });
  }
  return { links };
}

export function serializeSocialLink(row: any) {
  return {
    id: row.id,
    platform: row.platform,
    url: row.url,
    label: row.label ?? "",
    createdAt: row.createdAt,
  };
}
