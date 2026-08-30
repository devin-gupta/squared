import { supabase } from "../supabase/client";
export async function undoExpense(
  tripId: string,
  changeId: string,
  requestId: string,
) {
  const { data, error } = await (supabase as any).rpc("commit_expense", {
    operation_id: requestId,
    command: "undo",
    selected_trip: tripId,
    selected_expense: null,
    payload: {},
    expected_version: null,
    undo_change: changeId,
  });
  if (error || !data)
    throw new Error(
      error?.code === "23503"
        ? "A member referenced by this expense has been removed. It cannot be restored automatically."
        : error?.message || "Couldn’t confirm undo. Try again.",
    );
  return data;
}
