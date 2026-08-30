import { supabase } from "../supabase/client";
import { normalizeInvite } from "../auth/preferences";

export interface InviteContext {
  tripId: string;
  tripName: string;
  memberId: string | null;
  members: { id: string; name: string }[];
}
export async function getInviteContext(
  invitation: string,
): Promise<InviteContext> {
  const code = normalizeInvite(invitation);
  if (!code)
    throw new Error(
      "This invite is incomplete. Ask your friend for the link again.",
    );
  const { data, error } = await (supabase as any).rpc("invite_context", {
    invitation: code,
  });
  if (error || !data)
    throw new Error(
      error?.code === "PGRST202"
        ? "Joining is being updated. Please try again shortly."
        : error?.message || "We couldn’t open this invite. Try again.",
    );
  return data;
}
const joining = new Map<string, Promise<string>>();
export function joinTrip(
  invitation: string,
  displayName: string,
  userId: string,
  selectedMember: string | null = null,
): Promise<string> {
  const code = normalizeInvite(invitation);
  if (!code || !userId)
    return Promise.reject(new Error("Sign in with a valid trip invitation."));
  const key = `${userId}:${code}`;
  const existing = joining.get(key);
  if (existing) return existing;
  const pending = (async () => {
    const { data, error } = await (supabase as any).rpc("join_invited_trip", {
      invitation: code,
      selected_member: selectedMember,
      new_name: selectedMember ? null : displayName.trim(),
    });
    if (error || !data)
      throw new Error(
        error?.message || "Couldn’t join. Your invitation is still saved.",
      );
    return data as string;
  })().finally(() => joining.delete(key));
  joining.set(key, pending);
  return pending;
}
