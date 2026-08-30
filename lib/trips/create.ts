import { supabase } from "../supabase/client";
export async function createTrip(
  displayName: string,
  tripName?: string,
  userId?: string,
  names: string[] = [],
  requestId = crypto.randomUUID(),
): Promise<{ tripId: string; inviteCode: string }> {
  const { data, error } = await (supabase as any).rpc("start_group_trip", {
    trip_name: tripName || `Trip ${new Date().toLocaleDateString()}`,
    your_name: displayName,
    names,
    request_id: requestId,
  });
  if (error || !data)
    throw new Error(
      error?.message || "Couldn’t create your trip. Please try again.",
    );
  return data;
}
