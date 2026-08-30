"use client";

import { useState, useEffect } from "react";
import { useRealtimeTransactions } from "@/hooks/useRealtimeTransactions";
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
      lineItems?: LineItem[];
      adjustments?: Array<{ memberId: string; amount: number }>;
    },
  ) => {
    if (!editingTransaction) return;

    try {
      const updateData: any = {
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
          },
          body: JSON.stringify(updateData),
        },
      );

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Failed to update transaction");
      }

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
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete transaction");
      }

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
      />

      {editingTransaction && memberNames.length > 0 && (
        <TransactionEditForm
          transaction={editingTransaction as any}
          memberNames={memberNames}
          tripId={tripId}
          onDelete={() => handleDelete(editingTransaction.id)}
          onSubmit={handleEdit}
          onCancel={() => setEditingTransaction(null)}
        />
      )}
    </>
  );
}
