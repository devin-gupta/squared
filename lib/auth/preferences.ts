// Preferences only. Supabase owns session tokens and their persistent storage.
const INVITE_KEY = "squared:pendingInvite";
const EMAIL_KEY = "squared:lastEmail";
const INVITE_TTL = 7 * 24 * 60 * 60 * 1000;

export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writePreference(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* Sign-in still works when storage is unavailable. */
  }
}
export function normalizeInvite(code: string | null): string | null {
  const value = code?.trim().toUpperCase();
  return value && /^[A-Z0-9]{6,16}$/.test(value) ? value : null;
}
export function rememberInvite(code: string) {
  const valid = normalizeInvite(code);
  if (valid)
    writePreference(
      INVITE_KEY,
      JSON.stringify({ code: valid, savedAt: Date.now() }),
    );
}
export function pendingInvite(): string | null {
  try {
    const saved = JSON.parse(readPreference(INVITE_KEY) || "null");
    if (
      saved &&
      typeof saved.code === "string" &&
      typeof saved.savedAt === "number" &&
      Date.now() - saved.savedAt >= 0 &&
      Date.now() - saved.savedAt < INVITE_TTL
    )
      return normalizeInvite(saved.code);
  } catch {
    /* Ignore a malformed preference. */
  }
  writePreference(INVITE_KEY, null);
  return null;
}
export function forgetInvite(code?: string) {
  if (!code || pendingInvite() === code) writePreference(INVITE_KEY, null);
}
export function rememberedEmail() {
  return readPreference(EMAIL_KEY) || "";
}
export function rememberEmail(email: string) {
  writePreference(EMAIL_KEY, email);
}
export function preferredTrip(userId: string) {
  return (
    readPreference(`squared:lastTrip:${userId}`) || readPreference("tripId")
  );
}
export function rememberTrip(
  userId: string,
  tripId: string,
  displayName: string,
) {
  writePreference(`squared:lastTrip:${userId}`, tripId);
  // Older screens still read these keys; only write after checking membership.
  writePreference("tripId", tripId);
  writePreference("currentUser", displayName);
}
export function clearDevicePreferences() {
  forgetInvite();
  for (const key of ["tripId", "currentUser", EMAIL_KEY])
    writePreference(key, null);
}
export function signInRedirect(origin: string, inviteCode: string | null) {
  const url = new URL("/", origin);
  const valid = normalizeInvite(inviteCode);
  if (valid) url.searchParams.set("code", valid);
  return url.toString();
}
