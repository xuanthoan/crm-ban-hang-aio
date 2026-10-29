import type { PrismaClient } from "@prisma/client";

export interface AuditInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}

// Keys that must never be stored in an audit log. Matching is
// case-insensitive; "otp_mode" is deliberately NOT in this list (its
// value is only "off" / "email", not a code). A generic key named
// "code" is also kept (role codes, order codes) — only codeHash /
// OTP-code keys are stripped.
const SENSITIVE_KEY_PARTS = ["password", "token", "secret", "codehash", "otpcode", "otp_code", "authorization"];
const SENSITIVE_EXACT_KEYS = new Set(["otp", "jwt"]);

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_EXACT_KEYS.has(lower)) return true;
  return SENSITIVE_KEY_PARTS.some((part) => lower.includes(part));
}

/**
 * Recursively strip credential fields from a value before it is stored.
 * Anything stripped is replaced by "***" in objects (so the presence of
 * a field is still visible) and dropped from arrays only if it is a
 * bare string — audit values are normally objects, not raw secrets.
 */
export function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => sanitizeAuditValue(v));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? "***" : sanitizeAuditValue(v);
    }
    return out;
  }
  return value;
}

// Cost data is not a credential, but it is permission-gated (locked
// rules §6). Audit readers without product.view_cost must not see
// import prices hiding inside an oldValue/newValue snapshot.
const COST_KEYS = new Set(["importprice", "import_price", "importcost"]);

export function sanitizeAuditValueForViewer(value: unknown, canViewCost: boolean): unknown {
  const cleaned = sanitizeAuditValue(value);
  if (canViewCost) return cleaned;
  if (Array.isArray(cleaned)) return cleaned.map((v) => sanitizeAuditValueForViewer(v, false));
  if (cleaned !== null && typeof cleaned === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(cleaned as Record<string, unknown>)) {
      out[k] = COST_KEYS.has(k.toLowerCase()) ? "***" : sanitizeAuditValueForViewer(v, false);
    }
    return out;
  }
  return cleaned;
}

/**
 * Best-effort audit write: audit must never break the main operation if
 * the log itself fails, but the failure is surfaced in server logs so an
 * operator notices it. Never pass a password, OTP code or token here —
 * as a second line of defence, sanitizeAuditValue strips them anyway.
 */
export async function writeAudit(prisma: PrismaClient, input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValue: (sanitizeAuditValue(input.oldValue ?? null) ?? null) as never,
        newValue: (sanitizeAuditValue(input.newValue ?? null) ?? null) as never,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log:", err);
  }
}
