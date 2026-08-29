"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import TransactionCard, { DisplayTransaction, money } from "./TransactionCard";
import Icon from "./Icon";

export default function ExpenseLedger({
  transactions,
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
  basePath = "",
}: {
  transactions: DisplayTransaction[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onEdit?: (transaction: DisplayTransaction) => void;
  onDelete?: (id: string) => void;
  basePath?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      transactions.filter((t) =>
        `${t.description} ${t.payer?.display_name || ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [transactions, query],
  );
  const exportCsv = () => {
    const cell = (value: string) =>
      `"${(/^[=+\-@\t\r]/.test(value) ? "'" : "") + value.replace(/"/g, '""')}"`;
    const rows = [
      ["Date", "Description", "Paid by", "Amount (USD)", "Split"],
      ...filtered.map((t) => [
        t.created_at,
        t.description,
        t.payer?.display_name || "",
        String(t.total_amount),
        t.split_type,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((r) => r.map(cell).join(",")).join("\n")], {
        type: "text/csv;charset=utf-8;",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "squared-expenses.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-4">The shared ledger</p>
          <h1 className="page-title">Every little thing.</h1>
          <p className="muted mt-3">
            The coffees, the cabs, the good times. All right here.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={loading || !!error || !filtered.length}
          className="btn-secondary"
        >
          Export CSV
          <Icon name="arrow" width="16" />
        </button>
      </header>
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e1e5dc] p-5">
          <div>
            <h2 className="font-semibold">
              All expenses{" "}
              <span className="ml-2 rounded-md bg-[#edf1e9] px-2 py-1 text-xs">
                {filtered.length}
              </span>
            </h2>
            <p className="muted mt-1 text-xs">
              {money(
                filtered.reduce((sum, t) => sum + Number(t.total_amount), 0),
              )}{" "}
              total shown
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Icon
              name="search"
              width="16"
              className="pointer-events-none absolute left-3 top-3.5 text-[#58664f]"
            />
            <input
              type="search"
              aria-label="Search expenses or payer"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search expenses or payer"
              className="w-full !pl-9 !text-sm"
            />
          </div>
        </div>
        {loading ? (
          <p role="status" className="muted p-12 text-center">
            Loading your expenses…
          </p>
        ) : error ? (
          <div role="alert" className="p-8 text-center">
            <p className="muted">{error}</p>
            <button onClick={onRetry} className="btn-secondary mt-4">
              Try again
            </button>
          </div>
        ) : filtered.length ? (
          filtered.map((t) => (
            <TransactionCard
              key={t.id}
              transaction={t}
              canEdit={!!onEdit || !!onDelete}
              onEdit={onEdit ? () => onEdit(t) : undefined}
              onDelete={onDelete ? () => onDelete(t.id) : undefined}
            />
          ))
        ) : (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="icon-tile">
              <Icon name="ledger" />
            </span>
            <h3 className="font-medium">
              {query ? "No matching expenses" : "Your story starts here."}
            </h3>
            <p className="muted">
              {query
                ? "Try another description or person’s name."
                : "Add an expense to start your shared ledger."}
            </p>
            {query ? (
              <button
                className="btn-secondary mt-2"
                onClick={() => setQuery("")}
              >
                Clear search
              </button>
            ) : (
              <Link href={basePath || "/"} className="btn-primary mt-2">
                Add an expense
                <Icon name="plus" width="16" />
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
