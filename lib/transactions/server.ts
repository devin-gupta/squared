import "server-only";
import { createClient } from "@supabase/supabase-js";
export class ExpenseRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function authenticatedExpenseClient(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) throw new ExpenseRequestError("Sign in to change expenses.", 401);
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
    error,
  } = await client.auth.getUser(token);
  if (error || !user)
    throw new ExpenseRequestError("Your sign-in expired. Sign in again.", 401);
  return { client, user };
}
export async function expenseClient(request: Request) {
  return (await authenticatedExpenseClient(request)).client;
}
export function operationId(request: Request) {
  const id = request.headers.get("idempotency-key");
  if (!id || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))
    throw new ExpenseRequestError(
      "Reopen this expense to make a safe save request.",
      400,
    );
  return id;
}
export function mutationError(error: { code?: string; message?: string }) {
  const status =
    error.code === "42501"
      ? 403
      : error.code === "40001" || error.code === "23503"
        ? 409
        : error.code === "22023"
          ? 400
          : 503;
  const message =
    error.code === "PGRST202"
      ? "Expense saving is being updated. Your draft is still here."
      : error.code === "23503"
        ? "A referenced trip member is no longer available. This change was not saved."
        : ["42501", "40001", "22023"].includes(error.code || "")
          ? error.message
          : "Save wasn’t confirmed. Retry to check it without making a duplicate.";
  return new ExpenseRequestError(
    message || "Couldn’t save this change.",
    status,
  );
}
