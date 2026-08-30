import { NextRequest, NextResponse, after } from "next/server";
import {
  authenticatedExpenseClient,
  ExpenseRequestError,
} from "@/lib/transactions/server";
import { dispatchPush } from "@/lib/push/server";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try {
    const { user } = await authenticatedExpenseClient(request);
    // The caller can only flush notifications from their own recorded changes.
    // Content and recipients come entirely from the database, never this request.
    after(() => dispatchPush(user.id));
    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: "Sign in to continue." },
      { status: error instanceof ExpenseRequestError ? error.status : 401 },
    );
  }
}
