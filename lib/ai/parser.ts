import "server-only";
import OpenAI from "openai";
import { TransactionParsedSchema, TransactionParsed } from "./schemas";
import { PARSE_TRANSACTION_PROMPT, OCR_RECEIPT_PROMPT } from "./prompts";

export class AIServiceError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
  }
}

function aiClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey)
    throw new AIServiceError(
      "AI entry is not configured. Please enter this expense manually.",
    );
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    timeout: 45000,
    maxRetries: 0,
    defaultHeaders: {
      "HTTP-Referer": "https://squared-omega.vercel.app",
      "X-Title": "Squared",
    },
  });
}

async function complete(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
): Promise<TransactionParsed> {
  try {
    const response = await aiClient().chat.completions.create({
      model: "openrouter/free",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 4096,
    });
    const content = response.choices[0]?.message?.content;
    if (!content)
      throw new AIServiceError(
        "The free AI model returned no result. Please try again or enter the expense manually.",
      );
    // Some providers still wrap JSON in a Markdown fence despite JSON mode.
    const json = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    const result = TransactionParsedSchema.safeParse(JSON.parse(json));
    if (!result.success)
      throw new AIServiceError(
        "The AI result needs review. Please enter the expense manually.",
        422,
      );
    return result.data;
  } catch (error) {
    if (error instanceof AIServiceError) throw error;
    if (error instanceof OpenAI.APIError && error.status === 429)
      throw new AIServiceError(
        "Free AI is at its usage limit. Try again later or enter this expense manually.",
        429,
      );
    // Never return upstream error bodies or log prompts, receipt data, or credentials.
    throw new AIServiceError(
      "Free AI is temporarily unavailable. Please try again or enter this expense manually.",
    );
  }
}

export async function parseTransactionText(
  text: string,
  memberNames: string[] = [],
): Promise<TransactionParsed> {
  return complete([
    {
      role: "system",
      content: `${PARSE_TRANSACTION_PROMPT}\n\nAvailable members: ${memberNames.join(", ")}. Use only these exact names. Custom adjustments are absolute amounts owed (not offsets), must be nonnegative, include every participant with zero for anyone excluded, and must sum to total_amount. If you cannot determine an amount, return total_amount: 0 for manual review.`,
    },
    {
      role: "user",
      content: `Parse this transaction and return JSON: ${text}`,
    },
  ]);
}

export async function parseReceiptImage(
  imageBase64: string,
  memberNames: string[] = [],
  mimeType = "image/jpeg",
): Promise<TransactionParsed> {
  return complete([
    {
      role: "system",
      content: `${OCR_RECEIPT_PROMPT}\n\nAvailable members: ${memberNames.join(", ")}. Use only these exact names. Include tax and tip as line items when present so line_items sums to total_amount. Return JSON only.`,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Extract transaction details and line items from this receipt. Return JSON.",
        },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${imageBase64}` },
        },
      ],
    },
  ]);
}
