import { NextRequest, NextResponse } from "next/server";
import { calculateStatistics } from "@/lib/statistics/calculate";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) {
      return NextResponse.json(
        { error: "Sign in to view statistics." },
        { status: 401 },
      );
    }
    const { id: tripId } = await params;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tripId,
      )
    ) {
      return NextResponse.json({ error: "Invalid trip ID." }, { status: 400 });
    }

    // Keep each caller's authorization isolated and preserve database RLS.
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { headers: { Authorization: `Bearer ${token}` } },
      },
    );
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: "Your sign-in expired. Please sign in again." },
        { status: 401 },
      );
    }

    // Resolve "You Paid" from the verified account, never a supplied display name.
    const { data: member, error: memberError } = await client
      .from("trip_members")
      .select("id")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberError) {
      return NextResponse.json(
        { error: "Couldn’t verify trip membership. Please try again." },
        { status: 503 },
      );
    }
    if (!member) {
      return NextResponse.json(
        { error: "Join this trip to view its statistics." },
        { status: 403 },
      );
    }

    const statistics = await calculateStatistics(client, tripId, member.id);

    return NextResponse.json(
      { statistics },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Error calculating statistics:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to calculate statistics",
      },
      { status: 500 },
    );
  }
}
