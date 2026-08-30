import { NextResponse } from "next/server";
import { pushReadiness } from "@/lib/push/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const enabled = await pushReadiness();
  return NextResponse.json(
    { enabled, publicKey: enabled ? process.env.VAPID_PUBLIC_KEY : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
