export interface SplitAllocation {
  memberId: string;
  amount: number;
}

/** Validate exact currency allocations before either expense form saves. */
export function customSplitError(
  total: number,
  memberIds: string[],
  allocations: SplitAllocation[],
): string | null {
  if (!Number.isFinite(total) || total <= 0)
    return "Enter an expense amount first.";
  const seen = new Set<string>();
  for (const allocation of allocations) {
    if (
      !memberIds.includes(allocation.memberId) ||
      seen.has(allocation.memberId)
    )
      return "Choose each trip member only once.";
    seen.add(allocation.memberId);
    if (
      !Number.isFinite(allocation.amount) ||
      allocation.amount < 0 ||
      Math.abs(allocation.amount * 100 - Math.round(allocation.amount * 100)) >
        0.000001
    )
      return "Each share must be zero or more, with at most two decimal places.";
  }
  const remaining =
    Math.round(total * 100) -
    allocations.reduce(
      (sum, allocation) => sum + Math.round(allocation.amount * 100),
      0,
    );
  if (remaining > 0) return `$${(remaining / 100).toFixed(2)} left to assign.`;
  if (remaining < 0)
    return `$${(-remaining / 100).toFixed(2)} over the expense total.`;
  return null;
}

export function equalAllocations(
  total: number,
  memberIds: string[],
): SplitAllocation[] {
  if (!memberIds.length) return [];
  const cents = Math.max(
    0,
    Math.round((Number.isFinite(total) ? total : 0) * 100),
  );
  return memberIds.map((memberId, index) => ({
    memberId,
    amount:
      (Math.floor(cents / memberIds.length) +
        (index < cents % memberIds.length ? 1 : 0)) /
      100,
  }));
}
