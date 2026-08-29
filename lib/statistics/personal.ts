import type { Transaction } from "@/types/transaction";

export type TransactionWithShares = Transaction & {
  adjustments?: Array<{ member_id: string; amount: number | string }>;
};

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
    if (tx.line_items?.length) {
      for (const item of tx.line_items) {
        if (!item.split_among?.length) {
          share += Number(item.amount) / members.length;
        } else {
          const participants = item.split_among
            .map(
              (nameOrId) =>
                members.find(
                  (m) =>
                    m.id === nameOrId ||
                    m.display_name.toLowerCase() === nameOrId.toLowerCase(),
                )?.id,
            )
            .filter(Boolean);
          if (participants.includes(member.id))
            share += Number(item.amount) / participants.length;
        }
      }
    } else {
      const adjustment = tx.adjustments?.find((a) => a.member_id === member.id);
      share +=
        tx.split_type === "equal"
          ? Number(tx.total_amount) / members.length +
            Number(adjustment?.amount || 0)
          : Number(adjustment?.amount || 0);
    }
  }
  return { paid, share, balance: paid - share };
}
