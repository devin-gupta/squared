import { supabase } from "../supabase/client";
import type { TransactionParsed } from "@/types/transaction";
import { prepareUsdExpense } from "../currency/client";

export class ExpenseSaveError extends Error {
  constructor(
    message: string,
    public safeToEdit = false,
  ) {
    super(message);
  }
}
export interface PreparedExpense {
  tripId: string;
  payload: Record<string, unknown>;
}
export interface ExpenseCommit {
  transactionId: string;
  changeId: string;
  totalAmount: number;
  description: string;
  version: number;
}
export async function prepareExpense(
  tripId: string,
  input: TransactionParsed,
  receiptUrl?: string | null,
  currentUserName?: string | null,
): Promise<PreparedExpense> {
  const parsed = await prepareUsdExpense(input);
  const { data: members, error } = await supabase
    .from("trip_members")
    .select("id, display_name")
    .eq("trip_id", tripId);
  if (error || !members?.length)
    throw new Error("Couldn’t load the trip members. Try again.");
  const people = members as { id: string; display_name: string }[];
  const payer = people.find(
    (m) =>
      m.id === parsed.payer_id ||
      m.display_name === (parsed.payer_name || currentUserName),
  );
  if (!payer)
    throw new Error(
      "Choose a trip member as the payer. The organizer can add missing names from the people list.",
    );
  const shares = (parsed.adjustments || []).map((s) => {
    const m = people.find(
      (m) => m.id === s.user_id || m.display_name === s.user_name,
    );
    if (!m) throw new Error("Choose a trip member for each share.");
    return { member_id: m.id, amount: s.amount };
  });
  return {
    tripId,
    payload: {
      description: parsed.description,
      total_amount: parsed.total_amount,
      payer_id: payer.id,
      split_type: parsed.split_type,
      receipt_url: receiptUrl || null,
      category: parsed.category || null,
      line_items: parsed.line_items || null,
      currency_conversion: parsed.currency_conversion || null,
      shares,
    },
  };
}
export async function commitPreparedExpense(
  prepared: PreparedExpense,
  requestId: string,
): Promise<ExpenseCommit> {
  const { data, error } = await (supabase as any).rpc("commit_expense", {
    operation_id: requestId,
    command: "create",
    selected_trip: prepared.tripId,
    selected_expense: null,
    payload: prepared.payload,
    expected_version: null,
    undo_change: null,
  });
  if (error || !data)
    throw new ExpenseSaveError(
      error?.code === "PGRST202"
        ? "Expense saving is being updated. Your draft is still here."
        : error?.message ||
            "Save wasn’t confirmed. Retry this draft to check it without creating a duplicate.",
      ["22023", "23503", "PGRST202"].includes(error?.code || ""),
    );
  return data;
}
export async function createTransaction(
  tripId: string,
  parsed: TransactionParsed,
  receiptUrl?: string | null,
  currentUserName?: string | null,
  requestId = crypto.randomUUID(),
): Promise<ExpenseCommit> {
  return commitPreparedExpense(
    await prepareExpense(tripId, parsed, receiptUrl, currentUserName),
    requestId,
  );
}
