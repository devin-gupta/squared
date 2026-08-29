import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deleteTrip, TripDeleteError } from "@/lib/trips/delete";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) {
      return NextResponse.json(
        { error: "Sign in before deleting a trip." },
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

    await deleteTrip(client, tripId, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TripDeleteError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("Unexpected trip delete failure");
    return NextResponse.json(
      { error: "Couldn’t delete this trip. Please try again." },
      { status: 500 },
    );
  }
}
