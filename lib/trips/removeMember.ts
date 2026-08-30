import { supabase } from "../supabase/client";

export async function removeMember(
  tripId: string,
  memberId: string,
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in before removing a member.");
  const response = await fetch(
    `/api/trips/${tripId}/members?memberId=${encodeURIComponent(memberId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(
      result?.error || "Couldn’t remove this member. Please try again.",
    );
  }
}
