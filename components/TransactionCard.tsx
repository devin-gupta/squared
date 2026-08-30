"use client";

import { useId, useState } from "react";
import { Transaction } from "@/types/transaction";
import Icon from "./Icon";
import type { TransactionWithShares } from "@/lib/statistics/personal";
import { currencyAmount } from "@/lib/currency/convert";
import CurrencyReference from "./CurrencyReference";
import { categoryLabel } from "@/lib/categories";

export type DisplayTransaction = TransactionWithShares & {
  payer?: { display_name: string };
};
export const money = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    amount,
  );

export default function TransactionCard({
  transaction,
  onEdit,
  onDelete,
  canEdit = false,
}: {
  transaction: DisplayTransaction;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const opensEditor = canEdit && !!onEdit;
  const category =
    transaction.line_items?.[0]?.category || transaction.category || "Expense";
  const icon = /food|dining|coffee|drink/i.test(category)
    ? "coffee"
    : /stay|accommodation|lodging/i.test(category)
      ? "home"
      : /transport|activit|travel|car_rental|taxi|flights|parking|gas/i.test(
            category,
          )
        ? "travel"
        : "ledger";
  return (
    <article className="border-b border-[#edf0e8] last:border-b-0">
      <button
        onClick={() => (opensEditor ? onEdit?.() : setExpanded(!expanded))}
        aria-expanded={opensEditor ? undefined : expanded}
        aria-controls={opensEditor ? undefined : detailsId}
        aria-haspopup={opensEditor ? "dialog" : undefined}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-4 text-left transition-colors hover:bg-[#f8faf5] sm:gap-4 sm:px-5"
      >
        <span className="icon-tile h-10 w-10">
          <Icon name={icon} width="18" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {transaction.description}
          </span>
          <span className="mt-1 block text-xs text-[#5e6b5f]">
            {transaction.payer?.display_name || "Unknown payer"} paid{" "}
            <span className="mx-1 text-[#a6afa1]">·</span>{" "}
            {transaction.split_type === "equal"
              ? "Split equally"
              : "Custom split"}
          </span>
          {transaction.currency_conversion && (
            <span className="mt-1 block text-xs text-[#5e6b5f]">
              Originally{" "}
              {currencyAmount(
                transaction.currency_conversion.original_amount,
                transaction.currency_conversion.original_currency,
              )}
            </span>
          )}
        </span>
        <span className="hidden text-xs text-[#5e6b5f] md:block">
          {new Date(transaction.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums">
            {money(Number(transaction.total_amount))}
          </span>
          <span className="mt-1 block text-[10px] text-[#5e6b5f]">
            {categoryLabel(category)}
          </span>
        </span>
        <Icon
          name="chevron"
          width="14"
          className={`shrink-0 text-[#8a9784] transition-transform ${opensEditor ? "-rotate-90" : expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div
          id={detailsId}
          className="mx-4 mb-4 rounded-xl bg-[#f6f8f2] p-4 text-xs text-[#5e6b5f]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {new Date(transaction.created_at).toLocaleString()} ·{" "}
              {transaction.status}
            </span>
          </div>
          {transaction.currency_conversion && (
            <CurrencyReference conversion={transaction.currency_conversion} />
          )}
          {transaction.line_items?.map((item, i) => (
            <div key={i} className="mt-2 flex justify-between gap-3">
              <span>{item.description}</span>
              <span className="tabular-nums">{money(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
