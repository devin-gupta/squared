"use client";

import { useState, useEffect, useRef } from "react";
import { useRealtimeTransactions } from "@/hooks/useRealtimeTransactions";
import ExpenseHistory from "./ExpenseHistory";
import UndoToast from "./UndoToast";
import { undoExpense } from "@/lib/transactions/history";
import ExpenseLedger from "./ExpenseLedger";
import TransactionEditForm from "./TransactionEditForm";
import { Transaction, LineItem } from "@/types/transaction";
import { supabase } from "@/lib/supabase/client";

interface TransactionWithPayer extends Transaction {
  payer?: { display_name: string };
}

interface LiveFeedProps {
  tripId: string | null;
}

export default function LiveFeed({ tripId }: LiveFeedProps) {
  const { transactions, loading, error, refetch, removeTransaction } =
    useRealtimeTransactions(tripId);
  const [undo, setUndo] = useState<{ id: string; message: string } | null>(
    null,
  );
  const undoRequests = useRef<Record<string, string>>({});
  const deleteRequests = useRef<Record<string, string>>({});
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [memberNames, setMemberNames] = useState<
    { id: string; name: string }[]
  >([]);
  // Load member names for editing
  useEffect(() => {
    if (tripId) {
      supabase
        .from("trip_members")
        .select("id, display_name")
        .eq("trip_id", tripId)
        .then(({ data }) => {
          if (data && Array.isArray(data)) {
            setMemberNames(
              data.map((m) => ({
                id: (m as { id: string; display_name: string }).id,
                name: (m as { id: string; display_name: string }).display_name,
              })),
            );
          }
        });
    }
  }, [tripId]);

  const handleEdit = async (
    data: Partial<Transaction> & {
      operationId?: string;
      lineItems?: LineItem[];
      adjustments?: Array<{ memberId: string; amount: number }>;
    },
  ) => {
    if (!editingTransaction) return;

    try {
      const updateData: any = {
        expectedVersion: editingTransaction.version || 1,
        tripId,
        description: data.description,
        totalAmount: data.total_amount,
        payerId: data.payer_id,
        splitType: data.split_type,
        category: data.category,
      };

      if (data.lineItems !== undefined) {
        updateData.lineItems = data.lineItems;
      }

      if (data.adjustments !== undefined) {
        updateData.adjustments = data.adjustments;
      }

      // Get auth token from Supabase session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Authentication required");
      }

      const response = await fetch(
        `/api/transactions/${editingTransaction.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            "Idempotency-Key": data.operationId || crypto.randomUUID(),
          },
          body: JSON.stringify(updateData),
        },
      );

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Failed to update transaction");
      }

      const result = await response.json();
      setUndo({ id: result.changeId, message: "Expense updated" });
      setEditingTransaction(null);
      await refetch();
    } catch (error) {
      console.error("Error updating transaction:", error);
      throw error;
    }
  };

  const handleDelete = async (transactionId: string) => {
    try {
      // Get auth token from Supabase session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Authentication required");
      }

      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "Idempotency-Key": (deleteRequests.current[transactionId] ||=
            crypto.randomUUID()),
        },
        body: JSON.stringify({
          expectedVersion: editingTransaction?.version || 1,
          tripId,
        }),
      });

      const result = await response.json();
      if (!response.ok)
        throw new Error(result?.error || "Failed to delete transaction");
      delete deleteRequests.current[transactionId];
      setUndo({ id: result.changeId, message: "Expense deleted" });

      // Optimistically remove transaction from UI immediately
      removeTransaction(transactionId);
      setEditingTransaction(null);
    } catch (error) {
      console.error("Error deleting transaction:", error);
      throw error;
    }
  };

  return (
    <>
      <ExpenseLedger
        transactions={transactions}
        loading={loading}
        error={error}
        onRetry={refetch}
        onEdit={setEditingTransaction}
        onDelete={handleDelete}
        members={memberNames.map((member) => ({
          id: member.id,
          display_name: member.name,
        }))}
      />

      <ExpenseHistory
        tripId={tripId}
        refreshKey={transactions.map((t) => `${t.id}:${t.version}`).join(",")}
        onChange={() => void refetch()}
      />
      {undo && (
        <UndoToast
          show
          type="transaction"
          itemId={undo.id}
          message={undo.message}
          onDismiss={() => setUndo(null)}
          onUndo={async () => {
            if (!tripId) return;
            await undoExpense(
              tripId,
              undo.id,
              (undoRequests.current[undo.id] ||= crypto.randomUUID()),
            );
            setUndo(null);
            await refetch();
          }}
        />
      )}
      {editingTransaction && memberNames.length > 0 && (
        <TransactionEditForm
          transaction={editingTransaction as any}
          memberNames={memberNames}
          tripId={tripId}
          onDelete={() => handleDelete(editingTransaction.id)}
          onSubmit={handleEdit}
          onCancel={() => {
            setEditingTransaction(null);
            void refetch();
          }}
        />
      )}
    </>
  );
}
