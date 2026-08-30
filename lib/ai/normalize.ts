import type { TransactionParsed } from "./schemas";
import { normalizeCategory } from "../categories";
import { printedAmount } from "./amounts";

export function normalizeParsedExpense(
  parsed: TransactionParsed,
): TransactionParsed {
  const currency = parsed.currency.trim().toUpperCase();
  const category = normalizeCategory(
    parsed.category || parsed.line_items?.[0]?.category,
  );
  let total = parsed.total_amount;
  let review = parsed.review_note;
  if (parsed.amount_text) {
    const printed = printedAmount(parsed.amount_text, currency);
    if (printed !== null) total = printed;
    else {
      total = 0;
      review =
        "Confirm the printed amount: its number format could not be read confidently.";
    }
  }
  let line_items = parsed.line_items?.map(({ amount_text, ...item }) => ({
    ...item,
    category: normalizeCategory(item.category),
    amount: amount_text
      ? (printedAmount(amount_text, currency) ?? item.amount)
      : item.amount,
  }));
  // A single whole-expense item must track a corrected grouping separator.
  if (
    line_items?.length === 1 &&
    line_items[0].amount === parsed.total_amount
  ) {
    line_items[0].amount = total;
  }
  if (
    line_items?.length &&
    Math.abs(line_items.reduce((sum, item) => sum + item.amount, 0) - total) >
      0.005
  ) {
    review =
      "The extracted line items do not add up to the total. Check the amounts before saving.";
  }
  // Keep categories in the existing line-item storage without changing custom
  // adjustments. A whole-expense item has exactly the same equal-split behavior.
  if (!line_items?.length && total > 0 && parsed.split_type === "equal") {
    line_items = [{ description: parsed.description, amount: total, category }];
  }
  return {
    ...parsed,
    currency,
    category,
    total_amount: total,
    line_items,
    ...(review ? { review_note: review } : {}),
  };
}
