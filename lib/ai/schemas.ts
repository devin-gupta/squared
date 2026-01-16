import { z } from 'zod'

export const LineItemSchema = z.object({
  description: z.string().describe('Description of the line item'),
  amount: z.number().describe('Amount for this line item'),
  category: z.string().describe('Category (e.g., "food", "alcohol", "gas", "lodging")'),
  split_among: z.array(z.string()).optional().describe('Names or IDs of people who should pay for this item'),
})

export const TransactionParsedSchema = z.object({
  description: z.string().describe('Transaction description (e.g., "Dinner at Aspen Grill")'),
  total_amount: z.number().describe('Total transaction amount'),
  payer_name: z.string().optional().describe('Name of the person who paid (if mentioned)'),
  split_type: z.enum(['equal', 'custom']).describe('How to split the transaction'),
  adjustments: z.array(z.object({
    user_name: z.string().describe('Name of the person'),
    amount: z.number().describe('Adjustment amount (positive or negative)'),
  })).optional().describe('Custom split adjustments'),
  line_items: z.array(LineItemSchema).optional().describe('Line items breakdown (for receipts)'),
  category: z.string().optional().describe('Transaction category'),
})

export type TransactionParsed = z.infer<typeof TransactionParsedSchema>
export type LineItem = z.infer<typeof LineItemSchema>
