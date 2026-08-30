import { supabase } from "../supabase/client";
export async function addTripNames(
  tripId: string,
  names: string[],
): Promise<{ id: string; display_name: string }[]> {
  const { data, error } = await (supabase as any).rpc("add_trip_names", {
    selected_trip: tripId,
    names,
  });
  if (error || !data)
    throw new Error(error?.message || "Couldn’t add these names. Try again.");
  return data;
}
export async function addMember(
  tripId: string,
  displayName: string,
): Promise<{ id: string; display_name: string }> {
  return (await addTripNames(tripId, [displayName]))[0];
}
