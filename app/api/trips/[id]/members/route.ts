import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { MemberRemovalError, removeTripMember } from "@/lib/trips/remove";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const tripId = resolvedParams.id;
    const body = await request.json();
    const { display_name } = body;

    if (!display_name) {
      return NextResponse.json(
        { error: "display_name is required" },
        { status: 400 },
      );
    }

    // Check if member already exists
    const { data: existing } = await supabase
      .from("trip_members")
      .select("id")
      .eq("trip_id", tripId)
      .eq("display_name", display_name)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Member already exists" },
        { status: 400 },
      );
    }

    // Add member
    const { data: member, error } = await supabase
      .from("trip_members")
      // @ts-expect-error - Supabase type inference issue with insert
      .insert({
        trip_id: tripId,
        display_name,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add member: ${error.message}`);
    }

    return NextResponse.json({ member });
  } catch (error) {
    console.error("Error adding member:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to add member",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token)
      return NextResponse.json(
        { error: "Sign in before removing a member." },
        { status: 401 },
      );
    const { id: tripId } = await params;
    const memberId = request.nextUrl.searchParams.get("memberId");
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(tripId) || !memberId || !uuid.test(memberId)) {
      return NextResponse.json(
        { error: "A valid trip and member are required." },
        { status: 400 },
      );
    }

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
    if (authError || !user)
      return NextResponse.json(
        { error: "Your sign-in expired. Please sign in again." },
        { status: 401 },
      );
    await removeTripMember(client, tripId, memberId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof MemberRemovalError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error("Unexpected member removal failure");
    return NextResponse.json(
      {
        error: "Couldn’t remove this member. Please try again.",
      },
      { status: 500 },
    );
  }
}
