import { NextRequest, NextResponse } from "next/server";
import {
  authenticatedExpenseClient,
  ExpenseRequestError,
} from "@/lib/transactions/server";
import {
  newShortcutToken,
  shortcutAdmin,
  shortcutConfigured,
  shortcutTokenHash,
} from "@/lib/shortcut/server";

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

async function context(request: NextRequest, tripId: unknown) {
  const { client, user } = await authenticatedExpenseClient(request);
  if (typeof tripId !== "string" || !uuid.test(tripId))
    throw new ExpenseRequestError("Choose a trip for this shortcut.", 400);
  const [{ data: member, error: memberError }, { data: trip, error: tripError }] =
    await Promise.all([
      client
        .from("trip_members")
        .select("id")
        .eq("trip_id", tripId)
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle(),
      client.from("trips").select("name").eq("id", tripId).maybeSingle(),
    ]);
  if (memberError || tripError || !member || !trip)
    throw new ExpenseRequestError("You no longer belong to this trip.", 403);
  return { user, tripId, tripName: String(trip.name) };
}

export async function GET(request: NextRequest) {
  try {
    if (!shortcutConfigured())
      return NextResponse.json(
        { enabled: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    const details = await context(
      request,
      request.nextUrl.searchParams.get("tripId"),
    );
    const { data, error } = await shortcutAdmin()
      .from("shortcut_receipt_tokens")
      .select("expires_at,last_used_at")
      .eq("user_id", details.user.id)
      .eq("trip_id", details.tripId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error)
      throw new ExpenseRequestError(
        error.code === "42P01"
          ? "Shortcut entry is still being set up."
          : "Couldn’t load shortcut settings.",
        503,
      );
    return NextResponse.json(
      {
        enabled: true,
        tripName: details.tripName,
        connected: !!data,
        expiresAt: data?.expires_at || null,
        lastUsedAt: data?.last_used_at || null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ExpenseRequestError
            ? error.message
            : "Couldn’t load shortcut settings.",
      },
      {
        status: error instanceof ExpenseRequestError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!shortcutConfigured())
      throw new ExpenseRequestError("Shortcut entry is unavailable.", 503);
    const body = await request.json();
    const details = await context(request, body?.tripId);
    const token = newShortcutToken();
    const tokenHash = shortcutTokenHash(token)!;
    const { error } = await shortcutAdmin()
      .from("shortcut_receipt_tokens")
      .upsert(
        {
          user_id: details.user.id,
          trip_id: details.tripId,
          token_hash: tokenHash,
          created_at: new Date().toISOString(),
          expires_at: new Date(
            Date.now() + 180 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          revoked_at: null,
          last_used_at: null,
          rate_window_at: new Date().toISOString(),
          rate_count: 0,
        },
        { onConflict: "user_id,trip_id" },
      );
    if (error)
      throw new ExpenseRequestError(
        error.code === "42P01"
          ? "Apply the shortcut receipt database migration first."
          : "Couldn’t create the shortcut upload key.",
        503,
      );
    return NextResponse.json(
      {
        token,
        tripName: details.tripName,
        uploadUrl: `${request.nextUrl.origin}/api/shortcut/receipt`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ExpenseRequestError
            ? error.message
            : "Couldn’t create the shortcut upload key.",
      },
      {
        status: error instanceof ExpenseRequestError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!shortcutConfigured())
      throw new ExpenseRequestError("Shortcut entry is unavailable.", 503);
    const body = await request.json();
    const details = await context(request, body?.tripId);
    const { error } = await shortcutAdmin()
      .from("shortcut_receipt_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", details.user.id)
      .eq("trip_id", details.tripId)
      .is("revoked_at", null);
    if (error)
      throw new ExpenseRequestError("Couldn’t disconnect the shortcut.", 503);
    return NextResponse.json(
      { connected: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ExpenseRequestError
            ? error.message
            : "Couldn’t disconnect the shortcut.",
      },
      {
        status: error instanceof ExpenseRequestError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
