import { NextRequest, NextResponse } from "next/server";
import { AIServiceError, parseReceiptImage } from "@/lib/ai/parser";
import { AIRequestError, requireAIContext } from "@/lib/ai/context";
import { receiptFileError } from "@/lib/receipts/files";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    if (!request.headers.get("authorization"))
      return NextResponse.json(
        { error: "Sign in to scan a receipt." },
        { status: 401 },
      );
    const formData = await request.formData();
    const file = formData.get("file");
    const tripId = formData.get("tripId");
    const note = formData.get("note") ?? "";
    if (typeof note !== "string" || note.length > 8000)
      return NextResponse.json(
        { error: "Use a note of up to 8,000 characters." },
        { status: 400 },
      );
    if (!(file instanceof File) || !file.size)
      return NextResponse.json(
        { error: "Choose a receipt image." },
        { status: 400 },
      );
    const fileError = receiptFileError(file);
    if (fileError)
      return NextResponse.json({ error: fileError }, { status: 400 });
    const { client, memberNames } = await requireAIContext(request, tripId);
    const parsed = await parseReceiptImage(
      Buffer.from(await file.arrayBuffer()).toString("base64"),
      memberNames,
      file.type,
      note,
    );
    const fileName = `${tripId}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
    const { data, error } = await client.storage
      .from("receipts")
      .upload(fileName, file, { contentType: file.type });
    const receiptUrl =
      !error && data
        ? client.storage.from("receipts").getPublicUrl(data.path).data.publicUrl
        : null;
    return NextResponse.json({ parsed, receiptUrl });
  } catch (error) {
    if (error instanceof AIServiceError || error instanceof AIRequestError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "Couldn’t process this receipt. Please try manual entry." },
      { status: 500 },
    );
  }
}
