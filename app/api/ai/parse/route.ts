import { NextRequest, NextResponse } from "next/server";
import { AIServiceError, parseTransactionText } from "@/lib/ai/parser";
import { CURRENCIES } from "@/lib/currency/convert";
import { AIRequestError, requireAIContext } from "@/lib/ai/context";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    if (!request.headers.get("authorization"))
      return NextResponse.json(
        { error: "Sign in to use AI entry." },
        { status: 401 },
      );
    const { text, tripId, defaults } = await request.json();
    if (typeof text !== "string" || !text.trim() || text.length > 8000)
      return NextResponse.json(
        { error: "Enter a description of up to 8,000 characters." },
        { status: 400 },
      );
    const { memberNames } = await requireAIContext(request, tripId);
    const safeDefaults =
      defaults && typeof defaults === "object"
        ? {
            currency: CURRENCIES.some(([code]) => code === defaults.currency)
              ? defaults.currency
              : "USD",
            payerName: memberNames.includes(defaults.payerName)
              ? defaults.payerName
              : undefined,
            participants: Array.isArray(defaults.participants)
              ? defaults.participants
                  .filter(
                    (n: unknown) =>
                      typeof n === "string" && memberNames.includes(n),
                  )
                  .slice(0, 100)
              : [],
          }
        : undefined;
    const parsed = await parseTransactionText(text, memberNames, safeDefaults);
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
