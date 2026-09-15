"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import TransactionCard, { DisplayTransaction, money } from "./TransactionCard";
import Icon from "./Icon";
import { expenseCsv } from "@/lib/transactions/export";
import {
  expenseMatchesCategory,
  expenseMatchesDateRange,
  expenseMatchesSearch,
} from "@/lib/transactions/search";
import { CATEGORIES } from "@/lib/categories";

export default function ExpenseLedger({
  transactions,
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
  basePath = "",
  members = [],
}: {
  transactions: DisplayTransaction[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onEdit?: (transaction: DisplayTransaction) => void;
  onDelete?: (id: string) => void;
  basePath?: string;
  members?: Array<{ id: string; display_name: string }>;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const filtered = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          expenseMatchesSearch(transaction, members, query) &&
          expenseMatchesCategory(transaction, category) &&
          expenseMatchesDateRange(transaction, fromDate, toDate),
      ),
    [transactions, members, query, category, fromDate, toDate],
  );
  const exportCsv = () => {
    const url = URL.createObjectURL(
      new Blob([expenseCsv(filtered, members)], {
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
          disabled={loading || !!error || !filtered.length || !members.length}
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
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative w-full sm:w-64">
              <Icon
                name="search"
                width="16"
                className="pointer-events-none absolute left-3 top-3.5 text-[#58664f]"
              />
              <input
                type="search"
                aria-label="Search expenses or payee"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search expenses or payee"
                className="w-full !pl-9 !text-sm"
              />
            </div>
            <select
              aria-label="Filter expenses by category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full !text-sm sm:w-56"
            >
              <option value="">All categories</option>
              {CATEGORIES.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            <details className="w-full text-sm sm:w-auto">
              <summary className="btn-secondary flex min-h-[44px] cursor-pointer list-none items-center justify-center whitespace-nowrap px-4 [&::-webkit-details-marker]:hidden">
                Date{fromDate || toDate ? " · active" : ""}
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:min-w-72">
                <label className="muted text-xs">
                  From
                  <input
                    type="date"
                    aria-label="Expenses from date"
                    value={fromDate}
                    max={toDate || undefined}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="mt-1 w-full !text-sm"
                  />
                </label>
                <label className="muted text-xs">
                  To
                  <input
                    type="date"
                    aria-label="Expenses to date"
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={(event) => setToDate(event.target.value)}
                    className="mt-1 w-full !text-sm"
                  />
                </label>
              </div>
            </details>
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
              {query || category || fromDate || toDate
                ? "No matching expenses"
                : "Your story starts here."}
            </h3>
            <p className="muted">
              {query || category || fromDate || toDate
                ? "Try another description, payee, category, or date range."
                : "Add an expense to start your shared ledger."}
            </p>
            {query || category || fromDate || toDate ? (
              <button
                className="btn-secondary mt-2"
                onClick={() => {
                  setQuery("");
                  setCategory("");
                  setFromDate("");
                  setToDate("");
                }}
              >
                Clear filters
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
