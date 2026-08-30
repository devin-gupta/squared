import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dispatchPush } from "@/lib/push/server";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") || "";
  const received = Buffer.from(supplied);
  const wanted = Buffer.from(`Bearer ${expected || ""}`);
  const valid =
    !!expected &&
    received.length === wanted.length &&
    timingSafeEqual(received, wanted);
  if (!valid)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dispatchPush();
  return NextResponse.json({ ok: true });
}
