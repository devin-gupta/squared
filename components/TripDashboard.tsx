"use client";

import Link from "next/link";
import { useState } from "react";
import Modal from "./Modal";
import { personalSpending } from "@/lib/statistics/personal";
import QuickAdd from "./QuickAdd";
import TransactionCard, { DisplayTransaction, money } from "./TransactionCard";
import { avatarColors } from "./MemberAvatars";
import Icon from "./Icon";
import type {
  ExpenseEntryProgress,
  ExpenseEntryResult,
} from "@/lib/transactions/entry";

export interface DashboardProps {
  transactions: DisplayTransaction[];
  members: Array<{ id: string; display_name: string }>;
  currentMemberId?: string | null;
  onSubmit: (
    text: string,
    image?: File,
  ) => void | ExpenseEntryResult | Promise<void | ExpenseEntryResult>;
  onManual: (draft?: string) => void;
  onEdit?: (transaction: DisplayTransaction) => void;
  onDelete?: (id: string) => void;
  isProcessing?: boolean;
  progress?: ExpenseEntryProgress | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  basePath?: string;
}

export function TripSummary({
  transactions,
  members,
  currentMemberId,
}: {
  transactions: DisplayTransaction[];
  members: Array<{ id: string; display_name: string }>;
  currentMemberId: string | null;
}) {
  const total = transactions.reduce(
    (sum, t) => sum + Number(t.total_amount),
    0,
  );
  const personal = personalSpending(transactions, members, currentMemberId);
  return (
    <div className="mb-6 hidden grid-cols-2 lg:grid gap-3 sm:gap-5 xl:grid-cols-[1.25fr_1fr_1fr]">
      <section className="relative col-span-2 overflow-hidden rounded-2xl bg-accent p-6 text-white xl:col-span-1">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-8 h-48 w-48 rounded-full border border-white/10 p-6"
        >
          <div className="h-full w-full rounded-full border border-white/10 p-6">
            <div className="h-full w-full rounded-full border border-white/10" />
          </div>
        </div>
        <p className="relative text-xs font-medium text-[#d4e1cf]">
          Total trip spending
        </p>
        <p className="relative my-4 text-4xl font-medium tracking-[-0.05em] tabular-nums">
          {money(total)}
        </p>
        <p className="relative text-xs text-[#d4e1cf]">
          The shared moments, added up.
        </p>
      </section>
      <section className="panel p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-[#5e6b5f]">Net owed</p>
          <Icon
            name="people"
            width="17"
            className="hidden text-[#859276] sm:block"
          />
        </div>
        <p className="my-4 break-words text-2xl font-medium tracking-[-0.04em] tabular-nums sm:text-3xl">
          {personal
            ? `${Math.round(personal.balance * 100) > 0 ? "+" : Math.round(personal.balance * 100) < 0 ? "−" : ""}${money(Math.abs(Math.round(personal.balance * 100) / 100))}`
            : "—"}
        </p>
        <p className="text-xs text-[#5e6b5f]">
          {personal
            ? Math.round(personal.balance * 100) > 0
              ? "You’ll get this back from the group"
              : Math.round(personal.balance * 100) < 0
                ? "You still owe this to the group"
                : "You’re all square"
            : "Join the trip to see your balance"}
        </p>
      </section>
      <section className="panel p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-[#5e6b5f]">Transactions</p>
          <Icon
            name="ledger"
            width="17"
            className="hidden text-[#859276] sm:block"
          />
        </div>
        <p className="my-4 text-2xl font-medium tracking-[-0.04em] tabular-nums sm:text-3xl">
          {transactions.length}
        </p>
        <p className="text-xs text-[#5e6b5f]">
          {transactions.length === 1
            ? "Shared expense recorded"
            : "Shared expenses recorded"}
        </p>
      </section>
    </div>
  );
}

export default function TripDashboard({
  transactions,
  members,
  currentMemberId = null,
  onSubmit,
  onManual,
  onEdit,
  onDelete,
  isProcessing,
  progress,
  loading,
  error,
  onRetry,
  basePath = "",
}: DashboardProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const total = transactions.reduce(
    (sum, t) => sum + Number(t.total_amount),
    0,
  );
  return (
    <>
      {error ? (
        <div role="alert" className="panel mb-6 p-5 text-sm">
          <p>{error}</p>
          <button className="btn-secondary mt-3" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : loading ? (
        <div
          role="status"
          className="panel mb-6 hidden p-10 text-center muted lg:block"
        >
          Loading your trip spending…
        </div>
      ) : (
        <TripSummary
          transactions={transactions}
          members={members}
          currentMemberId={currentMemberId}
        />
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0 space-y-6">
          <QuickAdd
            onSubmit={onSubmit}
            onManual={onManual}
            isProcessing={isProcessing}
            progress={progress}
          />
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[#edf0e8] px-5 py-5">
              <h2 className="font-semibold">Recent expenses</h2>
              <Link
                href={`${basePath}/feed`}
                className="flex min-h-8 items-center gap-1.5 text-xs font-medium text-[#58664f]"
              >
                View all
                <Icon name="arrow" width="14" />
              </Link>
            </div>
            {loading ? (
              <p role="status" className="muted p-8">
                Loading expenses…
              </p>
            ) : error ? (
              <p className="muted p-8">
                Your expenses couldn’t be loaded. Try again above.
              </p>
            ) : transactions.length ? (
              transactions
                .slice(0, 5)
                .map((t) => (
                  <TransactionCard
                    key={t.id}
                    transaction={t}
                    canEdit={!!onEdit || !!onDelete}
                    onEdit={onEdit ? () => onEdit(t) : undefined}
                    onDelete={onDelete ? () => onDelete(t.id) : undefined}
                  />
                ))
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <span className="icon-tile">
                  <Icon name="ledger" />
                </span>
                <h3 className="font-medium">The first memory is on you.</h3>
                <p className="muted max-w-xs">
                  Add a coffee, a dinner, or a place to stay. Your shared
                  expenses will appear here.
                </p>
                <button
                  onClick={() => setChatOpen(true)}
                  className="btn-secondary mt-2"
                >
                  Add your first expense
                </button>
              </div>
            )}
          </section>
        </div>
        <aside className="space-y-5">
          <section className="panel p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-semibold">Who’s paid what</h2>
              <Icon name="people" width="17" className="text-[#859276]" />
            </div>
            <p className="muted mb-6 text-xs">
              A little clarity for the whole crew.
            </p>
            {members.map((member, i) => {
              const paid = transactions
                .filter((t) => t.payer_id === member.id)
                .reduce((sum, t) => sum + Number(t.total_amount), 0);
              return (
                <div key={member.id} className="mb-5 last:mb-0">
                  <div className="mb-2.5 flex items-center gap-2">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold"
                      style={{
                        backgroundColor: avatarColors[i % avatarColors.length],
                      }}
                    >
                      {member.display_name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {member.display_name}
                    </span>
                    <span className="text-xs font-medium tabular-nums">
                      {loading || error ? "—" : money(paid)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#f0f3eb]">
                    <div
                      className="h-full rounded-full bg-[#8b9e70]"
                      style={{
                        width: `${!error && !loading && total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <Link
              href={`${basePath}/settle`}
              className="mt-6 flex min-h-11 items-center justify-between border-t border-[#edf0e8] pt-4 text-xs font-medium"
            >
              See who owes what
              <Icon name="arrow" width="16" />
            </Link>
          </section>
          <section className="rounded-2xl bg-[#eaf0df] p-6">
            <Icon name="sparkles" className="mb-4 text-[#6c8452]" />
            <h2 className="font-serif text-2xl leading-tight">
              Less splitting.
              <br />
              More living.
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-[#58664f]">
              Keep adding as you go. When it’s time to head home, we’ll work out
              who owes what.
            </p>
          </section>
        </aside>
      </div>
      <Modal
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        title="Add an expense"
      >
        <QuickAdd
          embedded
          autoFocus
          isProcessing={isProcessing}
          progress={progress}
          onManual={(draft) => {
            setChatOpen(false);
            onManual(draft);
          }}
          onSubmit={onSubmit}
          onDone={() => setChatOpen(false)}
          onReview={() => setChatOpen(false)}
        />
      </Modal>
      <p className="mt-8 text-center text-[11px] text-[#58664f]">
        Made for the things you do together.
      </p>
      <button
        onClick={() => setChatOpen(true)}
        className="btn-primary fixed right-5 z-30 shadow-lg lg:hidden"
        style={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }}
      >
        <Icon name="plus" width="18" /> New expense
      </button>
    </>
  );
}
