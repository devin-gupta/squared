import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export class TripDeleteError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// The caller must pass its request-scoped, authenticated client. Never use the
// browser singleton here: verifying a JWT does not attach it to later queries.
export async function deleteTrip(
  client: SupabaseClient,
  tripId: string,
  userId: string,
): Promise<void> {
  const { data: trip, error: tripError } = await client
    .from("trips")
    .select("created_by")
    .eq("id", tripId)
    .maybeSingle();

  if (tripError) {
    console.error("Trip lookup failed", { code: tripError.code });
    throw new TripDeleteError(
      "Couldn’t load this trip. Please try again.",
      503,
    );
  }
  if (!trip)
    throw new TripDeleteError("This trip is no longer available.", 404);

  const { data: member, error: memberError } = await client
    .from("trip_members")
    .select("user_id, display_name")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) {
    console.error("Trip creator lookup failed", { code: memberError.code });
    throw new TripDeleteError(
      "Couldn’t verify trip ownership. Please try again.",
      503,
    );
  }
  if (!member || member.display_name !== trip.created_by) {
    throw new TripDeleteError(
      "Only the trip creator can delete this trip.",
      403,
    );
  }

  // Keep deletion atomic: the database cascades related records in this single
  // statement. Do not delete expenses/members in separate requests.
  const { data: deleted, error: deleteError } = await client
    .from("trips")
    .delete()
    .eq("id", tripId)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    console.error("Trip delete failed", { code: deleteError.code });
    throw new TripDeleteError(
      deleteError.code === "23503"
        ? "This trip has linked records that prevented deletion. Nothing was deleted."
        : "Couldn’t delete this trip. Please try again.",
      deleteError.code === "23503" ? 409 : 503,
    );
  }
  // RLS may reject a delete by filtering out every row without returning an error.
  if (!deleted || deleted.id !== tripId) {
    throw new TripDeleteError(
      "The trip was not deleted. Refresh and check that you’re signed in as its creator.",
      403,
    );
  }
}
