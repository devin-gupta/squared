import { NextRequest, NextResponse } from "next/server";
import { AIServiceError, parseTransactionText } from "@/lib/ai/parser";
import { AIRequestError, requireAIContext } from "@/lib/ai/context";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    if (!request.headers.get("authorization"))
      return NextResponse.json(
        { error: "Sign in to use AI entry." },
        { status: 401 },
      );
    const { text, tripId } = await request.json();
    if (typeof text !== "string" || !text.trim() || text.length > 8000)
      return NextResponse.json(
        { error: "Enter a description of up to 8,000 characters." },
        { status: 400 },
      );
    const { memberNames } = await requireAIContext(request, tripId);
    const parsed = await parseTransactionText(text, memberNames);
    return NextResponse.json({ parsed });
  } catch (error) {
    if (error instanceof AIServiceError || error instanceof AIRequestError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "Couldn’t read this expense. Please try manual entry." },
      { status: 500 },
    );
  }
}
