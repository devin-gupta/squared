"use client";

import { useState } from "react";
import { personalSpending } from "@/lib/statistics/personal";
import TripHeader from "./TripHeader";
import TripDashboard from "./TripDashboard";
import ExpenseLedger from "./ExpenseLedger";
import SettlementSummary, { Settlement } from "./SettlementSummary";
import ManualTransactionForm from "./ManualTransactionForm";
import StartTripModal from "./StartTripModal";
import Modal from "./Modal";
import { DisplayTransaction } from "./TransactionCard";
import { TransactionParsed } from "@/types/transaction";
import { avatarColors } from "./MemberAvatars";
import { equalAllocations } from "@/lib/transactions/splits";
import type { ExpenseEntryProgress } from "@/lib/transactions/entry";

const members = ["Devin", "Alex", "Sam", "Jamie"].map((display_name, i) => ({
  id: `sample-member-${i}`,
  display_name,
}));
const sampleTrip = {
  id: "sample-trip",
  name: "A weekend in the Catskills",
  created_by: "Devin",
  invite_code: "PREVIEW",
};
function sampleExpenses(): DisplayTransaction[] {
  const entries = [
    {
      description: "Dinner at the little Italian place",
      total_amount: 264,
      person: 1,
      category: "Food & drink",
    },
    {
      description: "Coffee for the road",
      total_amount: 84,
      person: 2,
      category: "Food & drink",
    },
    {
      description: "Our cabin in the woods",
      total_amount: 960,
      person: 0,
      category: "Accommodation",
    },
    {
      description: "Kayaks on the lake",
      total_amount: 210,
      person: 3,
      category: "Activities",
    },
    {
      description: "Weekend car rental",
      total_amount: 180,
      person: 1,
      category: "Transport",
    },
    {
      description: "Farmers market finds",
      total_amount: 144,
      person: 2,
      category: "Groceries",
    },
  ];
  return entries.map((entry, i) => ({
    ...entry,
    id: `sample-expense-${i}`,
    trip_id: sampleTrip.id,
    payer_id: members[entry.person].id,
    payer: { display_name: members[entry.person].display_name },
    split_type: "equal",
    status: "finalized",
    created_at: `2026-08-${String(29 - Math.floor(i / 2)).padStart(2, "0")}T12:00:00Z`,
    updated_at: "2026-08-29T12:00:00Z",
  }));
}

export default function DesignPreview({ screen }: { screen: string }) {
  const [transactions, setTransactions] = useState(sampleExpenses);
  const [trip, setTrip] = useState(sampleTrip);
  const [modal, setModal] = useState<"members" | "invite" | null>(null);
  const [startTrip, setStartTrip] = useState(false);
  const [form, setForm] = useState<Partial<TransactionParsed> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [entryProgress, setEntryProgress] =
    useState<ExpenseEntryProgress | null>(null);
  const openManual = (draft?: string) => {
    setEditingId(null);
    setForm({
      description: draft || "",
      payer_name: "Devin",
      split_type: "equal",
    });
  };
  const edit = (t: DisplayTransaction) => {
    setEditingId(t.id);
    setForm({
      description: t.description,
      total_amount: t.total_amount,
      payer_name: t.payer?.display_name,
      split_type: t.split_type,
      adjustments: t.adjustments?.map((a) => ({
        user_name: members.find((m) => m.id === a.member_id)?.display_name,
        amount: Number(a.amount),
      })),
    });
  };
  const save = (parsed: TransactionParsed) => {
    const payer =
      members.find((m) => m.display_name === parsed.payer_name) || members[0];
    const transaction: DisplayTransaction = {
      id: editingId || `sample-${Date.now()}`,
      trip_id: trip.id,
      description: parsed.description,
      total_amount: parsed.total_amount,
      payer_id: payer.id,
      payer: { display_name: payer.display_name },
      split_type: parsed.split_type,
      adjustments:
        parsed.split_type === "custom"
          ? parsed.adjustments?.map((a) => ({
              member_id: members.find((m) => m.display_name === a.user_name)!
                .id,
              amount: a.amount,
            }))
          : [],
      status: "finalized",
      category: "Expense",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTransactions((current) =>
      editingId
        ? current.map((t) =>
            t.id === editingId
              ? { ...t, ...transaction, created_at: t.created_at }
              : t,
          )
        : [transaction, ...current],
    );
    setForm(null);
    setEditingId(null);
    setNotice("Sample expense saved. No real data was changed.");
  };
  const settlements: Settlement[] = [];
  // Allocate each expense in cents, preserving custom shares and equal-split remainders.
  const balances = members.map((member) => ({
    id: member.id,
    name: member.display_name,
    amount: transactions.reduce((balance, transaction) => {
      const paid =
        transaction.payer_id === member.id
          ? Math.round(transaction.total_amount * 100)
          : 0;
      const shares =
        transaction.split_type === "custom"
          ? (transaction.adjustments || []).map((a) => ({
              memberId: a.member_id,
              amount: Number(a.amount),
            }))
          : equalAllocations(
              transaction.total_amount,
              members.map((m) => m.id),
            );
      return (
        balance +
        paid -
        Math.round(
          (shares.find((a) => a.memberId === member.id)?.amount || 0) * 100,
        )
      );
    }, 0),
  }));
  const creditors = balances.filter((m) => m.amount > 0),
    debtors = balances.filter((m) => m.amount < 0);
  for (const debtor of debtors)
    for (const creditor of creditors) {
      const amount = Math.min(-debtor.amount, creditor.amount);
      if (amount > 0) {
        settlements.push({
          from: debtor.name,
          fromId: debtor.id,
          to: creditor.name,
          toId: creditor.id,
          amount: amount / 100,
        });
        debtor.amount += amount;
        creditor.amount -= amount;
      }
    }
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce5cf] bg-[#edf2e5] px-4 py-3 text-xs text-[#526344]">
        <p>
          <strong>Local design preview</strong>
          <span className="mx-2">·</span>Sample data only. Changes reset when
          you leave or reload.
        </p>
        <button
          onClick={() => {
            setTransactions(sampleExpenses());
            setTrip(sampleTrip);
            setNotice("Sample trip reset.");
          }}
          className="min-h-8 font-semibold underline underline-offset-4"
        >
          Reset sample
        </button>
      </div>
      {notice && (
        <div
          role="status"
          className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-white p-4 text-sm"
        >
          <span>{notice}</span>
          <button
            onClick={() => setNotice("")}
            className="min-h-11 px-2 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}
      {screen === "feed" ? (
        <ExpenseLedger
          transactions={transactions}
          onEdit={edit}
          onDelete={(id) => {
            if (confirm("Delete this sample expense?"))
              setTransactions((current) => current.filter((t) => t.id !== id));
          }}
          basePath="/preview"
        />
      ) : screen === "settle" ? (
        <SettlementSummary
          settlements={settlements}
          basePath="/preview"
          currentMember={{ id: members[0].id, name: members[0].display_name }}
          tripId={trip.id}
          tripName={trip.name}
        />
      ) : (
        <>
          <TripHeader
            basePath="/preview"
            mobileSummary={{
              total: transactions.reduce(
                (sum, tx) => sum + Number(tx.total_amount),
                0,
              ),
              balance:
                personalSpending(transactions, members, members[0].id)
                  ?.balance ?? null,
            }}
            trip={trip}
            trips={[trip]}
            members={members}
            onShare={() => setModal("invite")}
            onViewMembers={() => setModal("members")}
            onSwitchTrip={() => {}}
            onCreateTrip={() => setStartTrip(true)}
          />
          <TripDashboard
            transactions={transactions}
            members={members}
            currentMemberId={members[0].id}
            basePath="/preview"
            onManual={openManual}
            onEdit={edit}
            onDelete={(id) => {
              if (confirm("Delete this sample expense?"))
                setTransactions((current) =>
                  current.filter((t) => t.id !== id),
                );
            }}
            progress={entryProgress}
            isProcessing={!!entryProgress}
            onSubmit={async (text, image) => {
              setEditingId(null);
              setNotice(
                "Animation demo: simulated processing, no AI requests or real data changes.",
              );
              setEntryProgress({
                stage: "reading",
                kind: image ? "receipt" : "text",
              });
              try {
                await new Promise((resolve) =>
                  window.setTimeout(resolve, 2200),
                );
                const amount = text.match(/\$(\d+(?:\.\d{1,2})?)/)?.[1];
                if (image || !amount || Number(amount) <= 0) {
                  setForm({
                    description: text,
                    payer_name: "Devin",
                    split_type: "equal",
                  });
                  setNotice(
                    "This preview does not call AI. Enter the sample details manually.",
                  );
                  return { status: "review" as const };
                }
                setEntryProgress({ stage: "saving", kind: "text" });
                await new Promise((resolve) => window.setTimeout(resolve, 900));
                const parsed: TransactionParsed = {
                  description: text,
                  total_amount: Number(amount),
                  payer_name: "Devin",
                  split_type: "equal",
                };
                save(parsed);
                return {
                  status: "saved" as const,
                  description: parsed.description,
                  amount: parsed.total_amount,
                };
              } finally {
                setEntryProgress(null);
              }
            }}
          />
        </>
      )}
      {form && (
        <ManualTransactionForm
          initialData={form}
          memberNames={members.map((m) => m.display_name)}
          onDelete={
            editingId
              ? () => {
                  setTransactions((current) =>
                    current.filter((t) => t.id !== editingId),
                  );
                  setForm(null);
                  setEditingId(null);
                  setNotice(
                    "Sample expense deleted. No real data was changed.",
                  );
                }
              : undefined
          }
          onSubmit={save}
          onCancel={() => setForm(null)}
        />
      )}
      <StartTripModal
        isOpen={startTrip}
        onClose={() => setStartTrip(false)}
        defaultUserName="Devin"
        onSubmit={async (name) => {
          setTrip({ ...sampleTrip, name });
          setTransactions([]);
          setStartTrip(false);
          setNotice(
            "New sample trip created with the same four sample members.",
          );
        }}
      />
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={
          modal === "members" ? "The whole crew." : "Better with your people."
        }
        description={
          modal === "members"
            ? "Four friends, one shared trip."
            : "Invitations are disabled in this local preview. In the connected app, you can share a link or QR code."
        }
      >
        {members.map((member, i) => (
          <div
            key={member.id}
            className="flex items-center gap-3 border-b border-[#edf0e8] py-3 last:border-0"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold"
              style={{ backgroundColor: avatarColors[i] }}
            >
              {member.display_name.slice(0, 2).toUpperCase()}
            </span>
            <p className="text-sm font-medium">{member.display_name}</p>
            <span className="ml-auto text-xs text-[#5e6b5f]">
              Sample member
            </span>
          </div>
        ))}
      </Modal>
    </>
  );
}
