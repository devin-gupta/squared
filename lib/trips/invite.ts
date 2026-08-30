import { normalizeInvite } from "../auth/preferences";

// Display-only context chosen by the sender, not proof of a trip's identity.
// Joining always resolves the invite code against Supabase after authentication.
export function inviteName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value
    .slice(0, 400)
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return name ? Array.from(name).slice(0, 80).join("") : null;
}

export function invitePath(code: string, name?: unknown): string | null {
  const valid = normalizeInvite(code);
  if (!valid) return null;
  const label = inviteName(name);
  const query = label ? `?${new URLSearchParams({ name: label })}` : "";
  return `/trip/${valid}${query}`;
}

export function inviteTitle(name?: unknown) {
  const label = inviteName(name);
  return label ? `You’re invited to ${label}` : "You’re invited to a trip";
}

export const inviteDescription =
  "Track shared expenses, split bills, and settle up together on Squared. No app download needed.";

// Messages may omit og:description, so the title also explains the purpose.
export function invitePreviewTitle(name?: unknown) {
  return `${inviteTitle(name)} — split bills together`;
}
