import { NextRequest, NextResponse } from "next/server";
import { normalizeCurrency } from "@/lib/currency/convert";
import { getUsdRate } from "@/lib/currency/rates";

export async function GET(request: NextRequest) {
  let currency: string;
  try {
    currency = normalizeCurrency(
      request.nextUrl.searchParams.get("currency") || "USD",
    );
  } catch {
    return NextResponse.json(
      { error: "Choose a supported currency." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({ quote: await getUsdRate(currency) });
  } catch {
    return NextResponse.json(
      {
        error:
          "Couldn’t get a current exchange rate. Please try again; no expense was saved.",
      },
      { status: 503 },
    );
  }
}
