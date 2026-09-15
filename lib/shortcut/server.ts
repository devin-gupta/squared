import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const SHORTCUT_TOKEN_PATTERN = /^sqr_[A-Za-z0-9_-]{43}$/;

export function shortcutConfigured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function shortcutAdmin() {
  if (!shortcutConfigured()) throw new Error("Shortcut entry is unavailable.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

export function newShortcutToken() {
  return `sqr_${randomBytes(32).toString("base64url")}`;
}

export function shortcutTokenHash(token: string) {
  if (!SHORTCUT_TOKEN_PATTERN.test(token)) return null;
  return createHash("sha256").update(token).digest("hex");
}

export function shortcutToken(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (sqr_[A-Za-z0-9_-]{43})$/)?.[1];
  return token || null;
}

export function receiptOperationId(tokenHash: string, bytes: Uint8Array) {
  const digest = createHash("sha256")
    .update(tokenHash)
    .update(bytes)
    .digest();
  // A deterministic RFC 4122 UUID makes a retried share of the same exact
  // photo idempotent without retaining the original image bytes.
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
