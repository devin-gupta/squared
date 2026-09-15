import {
  expenseAllocations,
  type AllocatedTransaction,
  type AllocationMember,
} from "./allocation";
import { normalizeCategory } from "../categories";

/** Match an expense by its description or by a member who shares its cost. */
export function expenseMatchesSearch(
  transaction: AllocatedTransaction,
  members: AllocationMember[],
  query: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;

  if (transaction.description.toLocaleLowerCase().includes(normalizedQuery))
    return true;

  const payeeIds = new Set(
    expenseAllocations(transaction, members)
      .filter(({ amount }) => amount > 0)
      .map(({ memberId }) => memberId),
  );

  return members.some(
    (member) =>
      payeeIds.has(member.id) &&
      member.display_name.toLocaleLowerCase().includes(normalizedQuery),
  );
}

/** A receipt can belong to more than one category through its line items. */
export function expenseMatchesCategory(
  transaction: AllocatedTransaction,
  category: string,
) {
  if (!category) return true;
  const normalizedCategory = normalizeCategory(category);

  if (transaction.line_items?.length)
    return transaction.line_items.some(
      (item) => normalizeCategory(item.category) === normalizedCategory,
    );

  return normalizeCategory(transaction.category) === normalizedCategory;
}

/** Match the same local calendar date shown on expense cards. */
export function expenseMatchesDateRange(
  transaction: AllocatedTransaction,
  fromDate: string,
  toDate: string,
) {
  if (!fromDate && !toDate) return true;

  const createdAt = new Date(transaction.created_at);
  if (Number.isNaN(createdAt.getTime())) return false;
  const expenseDate = [
    createdAt.getFullYear(),
    String(createdAt.getMonth() + 1).padStart(2, "0"),
    String(createdAt.getDate()).padStart(2, "0"),
  ].join("-");

  return (!fromDate || expenseDate >= fromDate) && (!toDate || expenseDate <= toDate);
}
