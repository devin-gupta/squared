import type { DisplayTransaction } from "@/components/TransactionCard";
import {
  expenseAllocations,
  type AllocationMember,
} from "./allocation";

function csvCell(value: string | number): string {
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function decimal(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

export function expenseCsv(
  transactions: DisplayTransaction[],
  members: AllocationMember[],
): string {
  const headers = [
    "Date",
    "Description",
    "Status",
    "Paid by",
    "Amount (USD)",
    "Split",
    "Split details (USD)",
    "Original currency",
    "Original amount",
    "USD rate",
    "Rate date",
    "Rate provider",
    ...members.flatMap((member) => [
      `${member.display_name} paid (USD)`,
      `${member.display_name} share (USD)`,
      `${member.display_name} net: paid minus share (USD)`,
    ]),
  ];
  const rows = transactions.map((transaction) => {
    const allocations = new Map(
      expenseAllocations(transaction, members).map((allocation) => [
        allocation.memberId,
        allocation.amount,
      ]),
    );
    const splitDetails = members
      .filter((member) => (allocations.get(member.id) || 0) !== 0)
      .map(
        (member) =>
          `${member.display_name}: ${(allocations.get(member.id) || 0).toFixed(2)}`,
      )
      .join("; ");
    return [
      transaction.created_at,
      transaction.description,
      transaction.status,
      transaction.payer?.display_name || "",
      decimal(Number(transaction.total_amount)),
      transaction.split_type,
      splitDetails,
      transaction.currency_conversion?.original_currency || "USD",
      decimal(
        transaction.currency_conversion?.original_amount ??
          Number(transaction.total_amount),
      ),
      String(transaction.currency_conversion?.rate ?? 1),
      transaction.currency_conversion?.rate_date || "",
      transaction.currency_conversion?.provider || "",
      ...members.flatMap((member) => {
        const paid =
          transaction.payer_id === member.id
            ? Number(transaction.total_amount)
            : 0;
        const share = allocations.get(member.id) || 0;
        return [decimal(paid), decimal(share), decimal(paid - share)];
      }),
    ];
  });
  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}
