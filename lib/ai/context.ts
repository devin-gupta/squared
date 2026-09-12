import "server-only";
import { createClient } from "@supabase/supabase-js";

export class AIRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function requireAIContext(request: Request, tripId: unknown) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new AIRequestError("Sign in to use AI entry.", 401);
  if (typeof tripId !== "string" || !tripId)
    throw new AIRequestError("Choose a trip before adding an expense.", 400);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser(token);
  if (authError || !user)
    throw new AIRequestError(
      "Your sign-in expired. Please sign in again.",
      401,
    );
  const { data: members, error } = await client
    .from("trip_members")
    .select("display_name, user_id")
    .eq("trip_id", tripId);
  if (error) {
    console.error("AI member lookup failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new AIRequestError(
      "Couldn’t load trip members. Please try again.",
      503,
    );
  }
  if (!members?.some((member) => member.user_id === user.id))
    throw new AIRequestError(
      "You must belong to this trip to use AI entry.",
      403,
    );
  return {
    client,
    memberNames: (members || []).map((m) => String(m.display_name)),
  };
}
