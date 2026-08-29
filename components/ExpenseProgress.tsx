"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";
import type {
  ExpenseEntryProgress,
  ExpenseEntryResult,
} from "@/lib/transactions/entry";
import { money } from "./TransactionCard";

export default function ExpenseProgress({
  progress,
  embedded = false,
  draft,
  receiptName,
  saved,
  onAnother,
  onDone,
}: {
  progress: ExpenseEntryProgress;
  embedded?: boolean;
  draft?: string;
  receiptName?: string;
  saved?: Extract<ExpenseEntryResult, { status: "saved" }> | null;
  onAnother?: () => void;
  onDone?: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (saved) return;
    const started = Date.now();
    setElapsed(0);
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [saved]);
  const saving = progress.stage === "saving";
  const title = saved
    ? "Expense added."
    : saving
      ? "Saving to your trip…"
      : progress.kind === "receipt"
        ? "Reading your receipt…"
        : "Reading your expense…";
  const detail = saved
    ? "Your trip’s expenses are up to date."
    : saving
      ? "Confirming the expense with your trip."
      : progress.kind === "receipt"
        ? "Picking out the items, total, and who paid."
        : "Working out the amount, who paid, and the split.";
  const slow = elapsed >= 12 && !saved;
  return (
    <div
      className={
        embedded
          ? "expense-progress"
          : "expense-progress px-5 pb-5 pt-4 sm:px-6 sm:pb-6"
      }
    >
      {(draft || receiptName) && !saved && (
        <div className="mb-5 ml-auto max-w-[94%] rounded-2xl rounded-br-md bg-[#edf2e5] px-4 py-3 text-sm text-[#40563e]">
          {draft && <p className="line-clamp-3 break-words">{draft}</p>}
          {receiptName && (
            <p className="mt-1 flex min-w-0 items-center gap-2 text-xs">
              <Icon name="camera" width="14" className="shrink-0" />
              <span className="truncate">{receiptName}</span>
            </p>
          )}
        </div>
      )}
      <div className="rounded-2xl border border-[#e2e8db] bg-[#f7f9f3] px-4 py-6 text-center">
        <div
          aria-hidden="true"
          className={`expense-receipt-scene ${saved ? "is-saved" : ""}`}
        >
          <div className="expense-receipt-halo" />
          <div className="expense-receipt-paper">
            <span className="expense-receipt-mark">
              <Icon name={saved ? "check" : "ledger"} width="20" />
            </span>
            <span className="expense-receipt-line w-12" />
            <span className="expense-receipt-line w-16" />
            <span className="expense-receipt-line w-10" />
            <span className="expense-receipt-rule" />
            <span className="expense-receipt-line w-12" />
            {!saved && <span className="expense-receipt-scan" />}
          </div>
          <span className="expense-receipt-badge">
            <Icon
              name={saved ? "check" : saving ? "plus" : "sparkles"}
              width="18"
            />
          </span>
        </div>
        <div role="status" aria-live="polite" aria-atomic="true">
          <h3 className="font-serif text-2xl tracking-tight">{title}</h3>
          <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-[#5e6b5f]">
            {detail}
          </p>
          {slow && (
            <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-[#526344]">
              {saving
                ? "This is taking longer than usual. Please wait for confirmation before adding it again."
                : "The AI is taking a little longer. Your draft is kept here."}
            </p>
          )}
        </div>
        {saved ? (
          <div className="expense-save-confirmation mt-5 rounded-xl border border-[#dce5d4] bg-white p-4 text-left">
            <p className="break-words text-sm font-medium">
              {saved.description}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {money(saved.amount)}
            </p>
          </div>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="mt-5 flex items-center justify-center gap-3 text-[11px] font-medium text-[#526344]"
            >
              <span className="flex items-center gap-1.5">
                {saving ? (
                  <Icon name="check" width="13" />
                ) : (
                  <span className="expense-working-dot" />
                )}{" "}
                Read
              </span>
              <span className="h-px w-6 bg-[#cbd6c0]" />
              <span
                className={`flex items-center gap-1.5 ${saving ? "" : "text-[#73816b]"}`}
              >
                {saving && <span className="expense-working-dot" />} Save
              </span>
            </div>
            <p
              aria-hidden="true"
              className="mt-3 text-[11px] tabular-nums text-[#5e6b5f]"
            >
              {elapsed > 0 ? `${elapsed}s elapsed` : "Working on it"}
              <span className="expense-working-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </p>
          </>
        )}
      </div>
      {saved && (
        <div className="mt-4 flex flex-wrap gap-2">
          {onDone && (
            <button className="btn-primary flex-1" onClick={onDone}>
              Done <Icon name="check" width="16" />
            </button>
          )}
          <button className="btn-secondary flex-1" onClick={onAnother}>
            <Icon name="plus" width="16" /> Add another
          </button>
        </div>
      )}
    </div>
  );
}
