import {
  expenseAllocations,
  type AllocatedTransaction,
} from "@/lib/transactions/allocation";

export type TransactionWithShares = AllocatedTransaction;

/** Use the same equal, custom, and receipt split rules as settlement. */
export function personalSpending(
  transactions: TransactionWithShares[],
  members: Array<{ id: string; display_name: string }>,
  currentMemberId: string | null,
) {
  const member = members.find((m) => m.id === currentMemberId);
  if (!member) return null;
  let paid = 0;
  let share = 0;
  for (const tx of transactions) {
    if (tx.payer_id === member.id) paid += Number(tx.total_amount);
    share +=
      expenseAllocations(tx, members).find(
        (allocation) => allocation.memberId === member.id,
      )?.amount || 0;
  }
  return { paid, share, balance: paid - share };
}
