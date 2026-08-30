import type { TransactionParsed } from "@/types/transaction";
import { normalizeCurrency } from "../currency/convert";
export interface ExpenseDefaults {
  currency: string;
  payerName?: string;
  participants: string[];
}
export function getExpenseDefaults(
  userId: string,
  tripId: string,
  members: string[],
): ExpenseDefaults {
  try {
    const d = JSON.parse(
      localStorage.getItem(`squared:expense-defaults:${userId}:${tripId}`) ||
        "null",
    );
    if (d)
      return {
        currency: normalizeCurrency(d.currency),
        payerName: members.includes(d.payerName) ? d.payerName : undefined,
        participants: Array.isArray(d.participants)
          ? d.participants.filter(
              (p: unknown) => typeof p === "string" && members.includes(p),
            )
          : [],
      };
  } catch {}
  return { currency: "USD", participants: [] };
}
export function rememberExpenseDefaults(
  userId: string,
  tripId: string,
  parsed: TransactionParsed,
  members: string[],
) {
  const participants =
    parsed.split_type === "custom"
      ? (parsed.adjustments || [])
          .filter((s) => s.amount > 0)
          .map((s) => s.user_name)
          .filter((n): n is string => !!n)
      : parsed.participants ||
        Array.from(
          new Set(
            (parsed.line_items || []).flatMap((i) => i.split_among || []),
          ),
        );
  try {
    localStorage.setItem(
      `squared:expense-defaults:${userId}:${tripId}`,
      JSON.stringify({
        currency: parsed.currency || "USD",
        payerName: parsed.payer_name,
        participants:
          participants.length === members.length ? [] : participants,
      }),
    );
  } catch {}
}
