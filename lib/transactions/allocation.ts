import type { Transaction } from "@/types/transaction";

export type AllocatedTransaction = Transaction & {
  adjustments?: Array<{ member_id: string; amount: number | string }>;
};

export interface AllocationMember {
  id: string;
  display_name: string;
}

/** Calculate each member's share using the same rules as settlement. */
export function expenseAllocations(
  transaction: AllocatedTransaction,
  members: AllocationMember[],
): Array<{ memberId: string; amount: number }> {
  const amounts = new Map(members.map((member) => [member.id, 0]));
  if (!members.length) return [];

  if (transaction.line_items?.length) {
    for (const item of transaction.line_items) {
      const participants = item.split_among?.length
        ? Array.from(
            new Set(
              item.split_among
                .map((nameOrId) => {
                  const value = nameOrId.toLowerCase();
                  return members.find(
                    (member) =>
                      member.id === nameOrId ||
                      member.display_name.toLowerCase() === value,
                  )?.id;
                })
                .filter((id): id is string => !!id),
            ),
          )
        : members.map((member) => member.id);
      if (!participants.length) continue;
      const share = Number(item.amount) / participants.length;
      for (const memberId of participants)
        amounts.set(memberId, (amounts.get(memberId) || 0) + share);
    }
  } else if (transaction.split_type === "custom") {
    for (const adjustment of transaction.adjustments || [])
      if (amounts.has(adjustment.member_id))
        amounts.set(adjustment.member_id, Number(adjustment.amount));
  } else {
    const share = Number(transaction.total_amount) / members.length;
    for (const member of members) amounts.set(member.id, share);
    for (const adjustment of transaction.adjustments || [])
      if (amounts.has(adjustment.member_id))
        amounts.set(
          adjustment.member_id,
          (amounts.get(adjustment.member_id) || 0) +
            Number(adjustment.amount),
        );
  }

  return members.map((member) => ({
    memberId: member.id,
    amount: amounts.get(member.id) || 0,
  }));
}
