import { NextRequest, NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/categories";
import {
  expenseClient,
  operationId,
  mutationError,
  ExpenseRequestError,
} from "@/lib/transactions/server";
async function mutate(
  request: NextRequest,
  params: Promise<{ id: string }>,
  command: "update" | "delete",
) {
  try {
    const client = await expenseClient(request);
    const op = operationId(request);
    const { id } = await params;
    const body = await request.json();
    if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 1)
      throw new ExpenseRequestError(
        "Reopen the expense to load its latest version.",
        409,
      );
    if (
      body.category !== undefined &&
      !CATEGORIES.some(([code]) => code === body.category)
    )
      throw new ExpenseRequestError("Choose a supported category.", 400);
    const { data: tx, error: readError } = await client
      .from("transactions")
      .select("trip_id")
      .eq("id", id)
      .maybeSingle();
    // A retry after deletion needs the original trip ID, but the RPC still checks membership and operation identity.
    const tripId = tx?.trip_id || body.tripId;
    if (readError || !tripId)
      throw new ExpenseRequestError(
        "This expense is unavailable. Reopen the trip.",
        404,
      );
    const payload: Record<string, unknown> = {};
    if (command === "update") {
      for (const [from, to] of [
        ["description", "description"],
        ["totalAmount", "total_amount"],
        ["payerId", "payer_id"],
        ["splitType", "split_type"],
        ["lineItems", "line_items"],
        ["category", "category"],
      ])
        if (body[from] !== undefined) payload[to] = body[from];
      if (body.adjustments !== undefined) {
        if (!Array.isArray(body.adjustments))
          throw new ExpenseRequestError("Check the custom shares.", 400);
        payload.shares = body.adjustments.map(
          (s: { memberId: string; amount: number }) => ({
            member_id: s.memberId,
            amount: s.amount,
          }),
        );
      }
    }
    const { data, error } = await client.rpc("commit_expense", {
      operation_id: op,
      command,
      selected_trip: tripId,
      selected_expense: id,
      payload,
      expected_version: body.expectedVersion,
      undo_change: null,
    });
    if (error) throw mutationError(error);
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ExpenseRequestError
            ? error.message
            : "Couldn’t process this change. Your expense has not been confirmed as saved.",
      },
      { status: error instanceof ExpenseRequestError ? error.status : 400 },
    );
  }
}
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return mutate(request, params, "update");
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return mutate(request, params, "delete");
}
