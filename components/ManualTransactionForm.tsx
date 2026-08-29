"use client";

import { useState } from "react";
import Modal from "./Modal";
import DeleteExpenseAction from "./DeleteExpenseAction";
import CustomSplitEditor from "./CustomSplitEditor";
import { customSplitError } from "@/lib/transactions/splits";
import { TransactionParsed } from "@/types/transaction";

interface ManualTransactionFormProps {
  tripId?: string | null;
  initialData?: Partial<TransactionParsed>;
  memberNames: string[];
  onSubmit: (data: TransactionParsed) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ManualTransactionForm({
  initialData,
  tripId = null,
  memberNames,
  onSubmit,
  onDelete,
  onCancel,
}: ManualTransactionFormProps) {
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [totalAmount, setTotalAmount] = useState(
    initialData?.total_amount?.toString() || "",
  );
  const [payerName, setPayerName] = useState(initialData?.payer_name || "");
  const [splitType, setSplitType] = useState<"equal" | "custom">(
    initialData?.split_type || "equal",
  );
  const [adjustments, setAdjustments] = useState(() =>
    memberNames.map((name) => ({
      memberId: name,
      amount: Number(
        initialData?.adjustments?.find((a) => a.user_name === name)?.amount ??
          0,
      ),
    })),
  );
  const splitError =
    splitType === "custom"
      ? customSplitError(Number(totalAmount), memberNames, adjustments)
      : null;
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || isDeleting) return;
    if (splitError) {
      setError(splitError);
      return;
    }
    setIsSaving(true);
    setError(null);

    const parsed: TransactionParsed = {
      description,
      total_amount: parseFloat(totalAmount) || 0,
      payer_name: payerName || undefined,
      split_type: splitType,
      adjustments:
        splitType === "custom"
          ? adjustments.map((a) => ({
              user_name: a.memberId,
              amount: a.amount,
            }))
          : undefined,
    };

    try {
      await onSubmit(parsed);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn’t save this expense. Try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={() => {
        if (!isSaving && !isDeleting) onCancel();
      }}
      title={onDelete ? "Edit expense" : "A little detail goes a long way."}
      description={
        onDelete
          ? "Update the details or delete this expense."
          : "Add an expense and tell us who picked up the tab."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="expense-description"
            className="block text-sm font-medium text-accent/70 mb-2"
          >
            Description
          </label>
          <input
            id="expense-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-transparent border-b-2 border-accent/20 text-accent focus:outline-none focus:border-accent"
            required
            autoFocus
          />
        </div>

        <div>
          <label
            htmlFor="expense-amount"
            className="block text-sm font-medium text-accent/70 mb-2"
          >
            Amount ($)
          </label>
          <input
            id="expense-amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className="w-full px-4 py-3 bg-transparent border-b-2 border-accent/20 text-accent focus:outline-none focus:border-accent"
            required
          />
        </div>

        <div>
          <label
            htmlFor="expense-payer"
            className="block text-sm font-medium text-accent/70 mb-2"
          >
            Paid By
          </label>
          <select
            id="expense-payer"
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            className="w-full px-4 py-3 bg-transparent border-b-2 border-accent/20 text-accent focus:outline-none focus:border-accent"
          >
            <option value="">Select payer</option>
            {memberNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-accent/70 mb-2">
            Split Type
          </label>
          <div className="flex gap-4">
            <label className="flex min-h-11 items-center">
              <input
                type="radio"
                name="split-type"
                value="equal"
                checked={splitType === "equal"}
                onChange={() => setSplitType("equal")}
                className="mr-2"
              />
              Equal
            </label>
            {
              <label className="flex min-h-11 items-center">
                <input
                  type="radio"
                  name="split-type"
                  value="custom"
                  checked={splitType === "custom"}
                  onChange={() => setSplitType("custom")}
                  className="mr-2"
                />
                Custom
              </label>
            }
          </div>
        </div>

        {splitType === "custom" && (
          <CustomSplitEditor
            members={memberNames.map((name) => ({ id: name, name }))}
            totalAmount={Number(totalAmount) || 0}
            tripId={tripId}
            existingAdjustments={adjustments}
            onChange={setAdjustments}
          />
        )}

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary flex-1"
            disabled={isSaving || isDeleting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={isSaving || isDeleting || !!splitError}
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
      {onDelete && (
        <DeleteExpenseAction
          onDelete={onDelete}
          disabled={isSaving}
          onBusyChange={setIsDeleting}
        />
      )}
    </Modal>
  );
}
