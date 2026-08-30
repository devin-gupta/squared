import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export class MemberRemovalError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function removeTripMember(
  client: SupabaseClient,
  tripId: string,
  memberId: string,
  userId: string,
): Promise<void> {
  const { data: trip, error: tripError } = await client
    .from("trips")
    .select("created_by")
    .eq("id", tripId)
    .maybeSingle();
  if (tripError)
    throw new MemberRemovalError(
      "Couldn’t load this trip. Please try again.",
      503,
    );
  if (!trip)
    throw new MemberRemovalError("This trip is no longer available.", 404);

  const { data: members, error: memberError } = await client
    .from("trip_members")
    .select("id, display_name, user_id")
    .eq("trip_id", tripId);
  if (memberError || !members)
    throw new MemberRemovalError(
      "Couldn’t load trip members. Please try again.",
      503,
    );
  const caller = members.find((member) => member.user_id === userId);
  const target = members.find((member) => member.id === memberId);
  if (
    !caller ||
    (caller.id !== memberId && caller.display_name !== trip.created_by)
  ) {
    throw new MemberRemovalError(
      "Only the trip creator can remove another member.",
      403,
    );
  }
  if (!target)
    throw new MemberRemovalError(
      "This member is no longer in the trip. Refresh the member list.",
      404,
    );
  if (target.display_name === trip.created_by) {
    throw new MemberRemovalError(
      "The trip creator can’t be removed. This keeps the trip manageable for everyone.",
      409,
    );
  }
  if (members.length <= 1)
    throw new MemberRemovalError("A trip must have at least one member.", 409);

  // Check implicit equal and receipt shares as well as foreign keys. Removing
  // someone from an equal split would otherwise silently redistribute their share.
  const transactions = [];
  for (let offset = 0; ; offset += 500) {
    const { data: page, error: transactionError } = await client
      .from("transactions")
      .select(
        "payer_id, split_type, line_items, adjustments:transaction_adjustments(member_id)",
      )
      .eq("trip_id", tripId)
      .order("id")
      .range(offset, offset + 499);
    if (transactionError || !page) {
      throw new MemberRemovalError(
        "Couldn’t check this member’s expenses. Please try again.",
        503,
      );
    }
    transactions.push(...page);
    if (page.length < 500) break;
  }
  const paidCount = transactions.filter(
    (tx) => tx.payer_id === memberId,
  ).length;
  if (paidCount) {
    throw new MemberRemovalError(
      `${target.display_name} is the payer on ${paidCount} ${paidCount === 1 ? "expense" : "expenses"}. Review those expenses and correct the payer before removing this member. No expenses were changed.`,
      409,
    );
  }
  const hasShares = transactions.some((tx) => {
    if (
      tx.adjustments?.some(
        (adjustment: { member_id: string }) =>
          adjustment.member_id === memberId,
      )
    )
      return true;
    if (Array.isArray(tx.line_items) && tx.line_items.length) {
      return tx.line_items.some(
        (item: { split_among?: string[] }) =>
          !item.split_among?.length ||
          item.split_among.some(
            (value) =>
              value === memberId ||
              value.toLowerCase() === target.display_name.toLowerCase(),
          ),
      );
    }
    return tx.split_type === "equal";
  });
  if (hasShares) {
    throw new MemberRemovalError(
      `${target.display_name} is included in existing expense splits. Review those splits before removing this member so nobody’s balance changes unexpectedly. No expenses were changed.`,
      409,
    );
  }

  // Confirm a returned row: RLS can filter a delete without reporting an error.
  const { data: deleted, error: deleteError } = await client
    .from("trip_members")
    .delete()
    .eq("trip_id", tripId)
    .eq("id", memberId)
    .select("id")
    .maybeSingle();
  if (deleteError) {
    throw new MemberRemovalError(
      deleteError.code === "23503"
        ? "This member is still linked to expenses. Review their payments and splits before removing them. No expenses were deleted."
        : "Couldn’t remove this member. Please try again.",
      deleteError.code === "23503" ? 409 : 503,
    );
  }
  if (!deleted || deleted.id !== memberId) {
    throw new MemberRemovalError(
      "The member wasn’t removed. Refresh and check that you’re signed in with permission to remove them.",
      403,
    );
  }
}
