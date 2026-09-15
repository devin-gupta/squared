import { NextRequest, NextResponse, after } from "next/server";
import { parseReceiptImage } from "@/lib/ai/parser";
import { receiptFileError } from "@/lib/receipts/files";
import {
  normalizeCurrency,
  convertExpense,
} from "@/lib/currency/convert";
import { getUsdRate } from "@/lib/currency/rates";
import { dispatchPush } from "@/lib/push/server";
import {
  receiptOperationId,
  shortcutAdmin,
  shortcutConfigured,
  shortcutToken,
  shortcutTokenHash,
} from "@/lib/shortcut/server";

export const maxDuration = 60;

function response(message: string, status: number, details = {}) {
  return NextResponse.json(
    { message, ...details },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function requestError(error: { code?: string; message?: string }) {
  if (error.code === "42501")
    return response(
      "This Add to Squared shortcut is disconnected. Reconnect it in Squared.",
      401,
    );
  if (error.code === "22023" || error.code === "40001")
    return response(error.message || "This receipt could not be added.", 400);
  if (error.code === "PGRST202" || error.code === "42P01")
    return response("Shortcut receipt entry is still being set up.", 503);
  return response("Squared couldn’t save this receipt. Try again.", 503);
}

export async function POST(request: NextRequest) {
  let uploadedPath: string | null = null;
  try {
    if (!shortcutConfigured())
      return response("Shortcut receipt entry is unavailable.", 503);
    const token = shortcutToken(request);
    const tokenHash = token ? shortcutTokenHash(token) : null;
    if (!tokenHash)
      return response(
        "This Add to Squared shortcut is disconnected. Reconnect it in Squared.",
        401,
      );
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size)
      return response("Share one receipt photo with Add to Squared.", 400);
    const fileError = receiptFileError(file);
    if (fileError) return response(fileError, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const operationId = receiptOperationId(tokenHash, bytes);
    const admin = shortcutAdmin();
    const { data: claimed, error: claimError } = await admin.rpc(
      "claim_shortcut_receipt",
      { presented_hash: tokenHash, operation_id: operationId },
    );
    if (claimError) return requestError(claimError);
    if (claimed?.existing)
      return response("Receipt already added to Squared.", 200, claimed.result);

    const parsed = await parseReceiptImage(
      Buffer.from(bytes).toString("base64"),
      Array.isArray(claimed?.memberNames) ? claimed.memberNames : [],
      file.type,
    );
    if (
      parsed.review_note ||
      !parsed.description?.trim() ||
      !Number.isFinite(parsed.total_amount) ||
      parsed.total_amount <= 0
    )
      return response(
        "Squared couldn’t confidently read this receipt. Add it from Squared so you can review it.",
        422,
      );
    let currency: string;
    try {
      currency = normalizeCurrency(parsed.currency);
    } catch {
      return response(
        "Squared couldn’t identify the receipt currency. Add it from Squared so you can choose it.",
        422,
      );
    }
    const equal = {
      ...parsed,
      payer_name: String(claimed.payerName),
      split_type: "equal" as const,
      adjustments: undefined,
      line_items: parsed.line_items?.map((item) => ({
        ...item,
        split_among: [],
      })),
    };
    const prepared =
      currency === "USD"
        ? { ...equal, currency: "USD", currency_conversion: undefined }
        : convertExpense(equal, await getUsdRate(currency));
    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
    uploadedPath = `${claimed.tripId}/${operationId}.${extension}`;
    const { data: upload, error: uploadError } = await admin.storage
      .from("receipts")
      .upload(uploadedPath, bytes, { contentType: file.type, upsert: false });
    if (uploadError && uploadError.message !== "The resource already exists")
      return response("Squared couldn’t store this receipt. Try again.", 503);
    const path = upload?.path || uploadedPath;
    const receiptUrl = admin.storage.from("receipts").getPublicUrl(path).data
      .publicUrl;
    const { data: saved, error: saveError } = await admin.rpc(
      "commit_shortcut_receipt",
      {
        presented_hash: tokenHash,
        operation_id: operationId,
        payload: {
          description: prepared.description,
          total_amount: prepared.total_amount,
          payer_id: claimed.payerId,
          split_type: "equal",
          receipt_url: receiptUrl,
          category: prepared.category || null,
          line_items: prepared.line_items || null,
          currency_conversion: prepared.currency_conversion || null,
          shares: [],
        },
      },
    );
    if (saveError) {
      await admin.storage.from("receipts").remove([uploadedPath]);
      uploadedPath = null;
      return requestError(saveError);
    }
    after(() => dispatchPush(String(claimed.userId)));
    return response(
      `Added ${saved.description} to Squared.`,
      201,
      saved,
    );
  } catch {
    if (uploadedPath)
      await shortcutAdmin()
        .storage.from("receipts")
        .remove([uploadedPath])
        .catch(() => {});
    return response("Squared couldn’t process this receipt. Try again.", 503);
  }
}
