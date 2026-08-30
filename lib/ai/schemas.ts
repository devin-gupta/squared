import { z } from "zod";

export const LineItemSchema = z.object({
  description: z.string().describe("Description of the line item"),
  amount: z.number().describe("Amount for this line item"),
  amount_text: z
    .string()
    .max(200)
    .optional()
    .describe("Exact printed item price, when present"),
  category: z
    .string()
    .describe('Category (e.g., "food", "alcohol", "gas", "lodging")'),
  split_among: z
    .array(z.string())
    .optional()
    .describe("Names or IDs of people who should pay for this item"),
});

export const TransactionParsedSchema = z.object({
  description: z
    .string()
    .describe('Transaction description (e.g., "Dinner at Aspen Grill")'),
  total_amount: z.number().describe("Total transaction amount"),
  amount_text: z
    .string()
    .max(200)
    .optional()
    .describe("Exact printed total including original separators and currency"),
  currency: z
    .string()
    .default("USD")
    .describe(
      "Original ISO 4217 currency code. Do not convert amounts. Use UNKNOWN when a foreign currency is ambiguous.",
    ),
  payer_name: z
    .string()
    .optional()
    .describe("Name of the person who paid (if mentioned)"),
  split_type: z
    .enum(["equal", "custom"])
    .describe("How to split the transaction"),
  adjustments: z
    .array(
      z.object({
        user_name: z.string().describe("Name of the person"),
        amount: z
          .number()
          .nonnegative()
          .describe("Absolute amount owed, not an offset"),
      }),
    )
    .optional()
    .describe("Custom split adjustments"),
  line_items: z
    .array(LineItemSchema)
    .optional()
    .describe("Line items breakdown (for receipts)"),
  category: z.string().optional().describe("Transaction category"),
  review_note: z.string().max(500).optional(),
});

export type TransactionParsed = z.infer<typeof TransactionParsedSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
