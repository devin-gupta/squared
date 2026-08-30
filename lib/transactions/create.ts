import { supabase } from "../supabase/client";
import { TransactionParsed } from "@/types/transaction";
import { addMember } from "../trips/addMember";
import { prepareUsdExpense } from "../currency/client";

export async function createTransaction(
  tripId: string,
  parsed: TransactionParsed,
  receiptUrl?: string | null,
  currentUserName?: string | null,
): Promise<{
  transactionId: string;
  totalAmount: number;
  addedMember?: { id: string; name: string };
}> {
  // Convert before any database writes. Never save foreign amounts as dollars
  // if the rate service is unavailable or a split cannot be reconciled.
  parsed = await prepareUsdExpense(parsed);
  if (parsed.currency_conversion) {
    const { error } = await supabase
      .from("transactions")
      .select("currency_conversion")
      .limit(0);
    if (error)
      throw new Error(
        "Currency storage is not ready. Ask the app owner to apply the currency migration; no expense was saved.",
      );
  }
  // Get all members for this trip
  const { data: members, error: membersError } = await supabase
    .from("trip_members")
    .select("id, display_name")
    .eq("trip_id", tripId);

  if (membersError || !members || !Array.isArray(members)) {
    throw new Error("Failed to fetch trip members");
  }

  const typedMembers = members as Array<{ id: string; display_name: string }>;

  // Find payer ID - auto-add if not found
  let payerId: string;
  let addedMember: { id: string; name: string } | undefined;

  if (parsed.payer_name) {
    let payer: { id: string; display_name: string } | undefined =
      typedMembers.find((m) => m.display_name === parsed.payer_name);

    if (!payer) {
      if (parsed.currency_conversion) {
        throw new Error(
          "Choose an existing trip member as the payer before saving this converted expense.",
        );
      }
      // Auto-add new member
      try {
        const newMember = await addMember(tripId, parsed.payer_name);
        payer = newMember as { id: string; display_name: string };
        addedMember = {
          id: newMember.id,
          name: newMember.display_name,
        };
      } catch (error) {
        // If auto-add fails, fall back to first member
        console.error("Failed to auto-add member:", error);
        payer = typedMembers[0];
      }
    }

    payerId = payer?.id || typedMembers[0].id;
  } else {
    // Default to current user (person adding the item) if provided, otherwise first member
    if (currentUserName) {
      const currentUserMember = typedMembers.find(
        (m) => m.display_name === currentUserName,
      );
      payerId = currentUserMember?.id || typedMembers[0].id;
    } else {
      payerId = typedMembers[0].id;
    }
  }

  if (parsed.currency_conversion) {
    if (addedMember)
      typedMembers.push({ id: addedMember.id, display_name: addedMember.name });
    const shares = (parsed.adjustments || []).map((share) => {
      const member = typedMembers.find(
        (member) =>
          member.display_name === share.user_name ||
          member.id === share.user_id,
      );
      if (!member)
        throw new Error("Choose a trip member for every custom share.");
      return { member_id: member.id, amount: share.amount };
    });
    const { data: transactionId, error } = await (supabase as any).rpc(
      "create_converted_expense",
      {
        expense: {
          trip_id: tripId,
          description: parsed.description,
          total_amount: parsed.total_amount,
          payer_id: payerId,
          split_type: parsed.split_type,
          receipt_url: receiptUrl || null,
          line_items: parsed.line_items || null,
          currency_conversion: parsed.currency_conversion,
        },
        shares,
      },
    );
    if (error || !transactionId)
      throw new Error(
        error?.code === "PGRST202"
          ? "Currency storage is not ready. Ask the app owner to apply the currency migration; no expense was saved."
          : "Couldn’t save this converted expense and its shares. Please try again.",
      );
    return { transactionId, totalAmount: parsed.total_amount, addedMember };
  }

  // Create transaction (finalize immediately for v1)
  const { data: transaction, error: txError } = await (
    supabase.from("transactions") as any
  )
    .insert({
      trip_id: tripId,
      description: parsed.description,
      total_amount: parsed.total_amount,
      payer_id: payerId,
      split_type: parsed.split_type,
      receipt_url: receiptUrl || null,
      line_items: parsed.line_items || null,
      status: "finalized", // Finalize immediately for v1
    })
    .select()
    .single();

  if (txError) {
    throw new Error(`Failed to create transaction: ${txError.message}`);
  }

  // If new member was added, add it to members array for adjustments
  if (addedMember) {
    typedMembers.push({ id: addedMember.id, display_name: addedMember.name });
  }

  // Create adjustments if custom split
  if (
    parsed.split_type === "custom" &&
    parsed.adjustments &&
    parsed.adjustments.length > 0
  ) {
    const adjustmentInserts = parsed.adjustments
      .map((adj) => {
        const member = typedMembers.find(
          (m) => m.display_name === adj.user_name,
        );
        if (!member) return null;
        return {
          transaction_id: transaction.id,
          member_id: member.id,
          amount: adj.amount,
        };
      })
      .filter((adj): adj is NonNullable<typeof adj> => adj !== null);

    if (adjustmentInserts.length > 0) {
      const { error: adjError } = await (
        supabase.from("transaction_adjustments") as any
      ).insert(adjustmentInserts);

      if (adjError) {
        console.error("Failed to create adjustments:", adjError);
      }
    }
  }

  return {
    transactionId: transaction.id,
    totalAmount: parsed.total_amount,
    addedMember,
  };
}
