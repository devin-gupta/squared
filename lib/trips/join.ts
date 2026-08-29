import { supabase } from "../supabase/client";
import { normalizeInvite } from "../auth/preferences";

// Strict Mode, token refreshes, and rapid navigation must not insert twice.
const joining = new Map<string, Promise<string>>();
export function joinTrip(
  inviteCode: string,
  displayName: string,
  userId: string,
): Promise<string> {
  const code = normalizeInvite(inviteCode);
  if (!code || !userId)
    return Promise.reject(
      new Error("Sign in with a valid trip invite to continue."),
    );
  const key = `${userId}:${code}`;
  const existing = joining.get(key);
  if (existing) return existing;
  const pending = joinAuthenticatedTrip(code, displayName, userId).finally(() =>
    joining.delete(key),
  );
  joining.set(key, pending);
  return pending;
}
async function joinAuthenticatedTrip(
  code: string,
  displayName: string,
  userId: string,
): Promise<string> {
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id")
    .eq("invite_code", code)
    .maybeSingle();
  if (tripError)
    throw new Error(
      "We couldn’t check this invite. Check your connection and try again.",
    );
  if (!trip)
    throw new Error(
      "This trip invite is no longer available. Ask your friend for a fresh link.",
    );
  const tripId = (trip as { id: string }).id;
  const findMember = async () => {
    const { data, error } = await supabase
      .from("trip_members")
      .select("id")
      .eq("trip_id", tripId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (error)
      throw new Error("We couldn’t check your membership. Please try again.");
    return data;
  };
  if (await findMember()) return tripId;
  const { data: members, error } = await supabase
    .from("trip_members")
    .select("display_name")
    .eq("trip_id", tripId);
  if (error)
    throw new Error("We couldn’t load the trip members. Please try again.");
  const names = new Set(
    ((members as Array<{ display_name: string }>) || []).map(
      (m) => m.display_name,
    ),
  );
  const baseName = displayName.trim().slice(0, 80) || "Traveler";
  let name = baseName;
  let suffix = 2;
  while (names.has(name)) name = `${baseName} (${suffix++})`;
  const { error: memberError } = await (
    supabase.from("trip_members") as any
  ).insert({ trip_id: tripId, display_name: name, user_id: userId });
  if (memberError) {
    // Another tab may have completed this same invitation already.
    if (memberError.code === "23505" && (await findMember())) return tripId;
    throw new Error(
      "We couldn’t join the trip. Please try again; your invite is saved.",
    );
  }
  return tripId;
}
