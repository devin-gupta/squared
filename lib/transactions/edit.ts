import type { Transaction, LineItem } from "@/types/transaction";
import { normalizeCategory } from "../categories";

type Share = { memberId: string; amount: number };
export type EditableExpense = Transaction & {
  adjustments?: {
    member_id: string;
    amount: number | string;
    member?: { id: string };
  }[];
};
export type ExpenseEdit = Partial<Transaction> & {
  lineItems?: LineItem[];
  adjustments?: Share[];
};

// Send only changed fields: recategorizing must not rewrite custom shares,
// clear conversion evidence, or introduce receipt items that change settlement.
export function expenseEdits(
  original: EditableExpense,
  draft: {
    description: string;
    totalAmount: number;
    payerId: string;
    splitType: "equal" | "custom";
    category: string;
    lineItems: LineItem[];
    adjustments: Share[];
  },
): ExpenseEdit {
  const edits: ExpenseEdit = {};
  if (draft.description !== original.description)
    edits.description = draft.description;
  if (draft.totalAmount !== Number(original.total_amount))
    edits.total_amount = draft.totalAmount;
  if (draft.payerId !== original.payer_id) edits.payer_id = draft.payerId;
  if (draft.splitType !== original.split_type)
    edits.split_type = draft.splitType;
  if (original.line_items?.length) {
    if (JSON.stringify(draft.lineItems) !== JSON.stringify(original.line_items))
      edits.lineItems = draft.lineItems;
  } else if (draft.category !== normalizeCategory(original.category)) {
    edits.category = draft.category;
  }
  const canonicalShares = (shares: Share[]) =>
    JSON.stringify(
      shares
        .map((s) => [s.memberId, Number(s.amount)])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
  const originalShares = (original.adjustments || [])
    .map((s) => ({
      memberId: s.member_id || s.member?.id || "",
      amount: Number(s.amount),
    }))
    .filter((s) => s.memberId);
  if (
    draft.splitType === "custom" &&
    (draft.splitType !== original.split_type ||
      canonicalShares(draft.adjustments) !== canonicalShares(originalShares))
  )
    edits.adjustments = draft.adjustments;
  return edits;
}
