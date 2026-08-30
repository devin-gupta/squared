"use client";

import { useState } from "react";
import Modal from "./Modal";
import DeleteExpenseAction from "./DeleteExpenseAction";
import { Transaction, LineItem } from "@/types/transaction";
import ReceiptLineItemEditor from "./ReceiptLineItemEditor";
import CustomSplitEditor from "./CustomSplitEditor";
import { customSplitError } from "@/lib/transactions/splits";
import CurrencyReference from "./CurrencyReference";

interface TransactionEditFormProps {
  transaction: Transaction & {
    payer?: { display_name: string };
    adjustments?: Array<{
      member_id: string;
      amount: number | string;
      member?: { id: string; display_name: string };
    }>;
  };
  memberNames: { id: string; name: string }[];
  tripId: string | null;
  onSubmit: (
    data: Partial<Transaction> & {
      lineItems?: LineItem[];
      adjustments?: Array<{ memberId: string; amount: number }>;
    },
  ) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onCancel: () => void;
}

export default function TransactionEditForm({
  transaction,
  memberNames,
  tripId,
  onSubmit,
  onDelete,
  onCancel,
}: TransactionEditFormProps) {
  const [description, setDescription] = useState(transaction.description);
  const [totalAmount, setTotalAmount] = useState(
    transaction.total_amount.toString(),
  );
  const [payerId, setPayerId] = useState(transaction.payer_id);
  const [splitType, setSplitType] = useState<"equal" | "custom">(
    transaction.split_type,
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(
    transaction.line_items || [],
  );
  const [adjustments, setAdjustments] = useState<
    Array<{ memberId: string; amount: number }>
  >(() =>
    (transaction.adjustments || [])
      .map((a) => ({
        memberId: a.member_id || a.member?.id || "",
        amount: Number(a.amount),
      }))
      .filter((a) => a.memberId),
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReceipt = transaction.line_items && transaction.line_items.length > 0;

  const splitError =
    !isReceipt && splitType === "custom"
      ? customSplitError(
          Number(totalAmount),
          memberNames.map((m) => m.id),
          adjustments,
        )
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || isDeleting) return;
    if (splitError) {
      setError(splitError);
      return;
    }
    setIsSaving(true);
    setError(null);

    const submitData: Partial<Transaction> & {
      lineItems?: LineItem[];
      adjustments?: Array<{ memberId: string; amount: number }>;
    } = {
      description,
      total_amount: parseFloat(totalAmount) || 0,
      payer_id: payerId,
      split_type: splitType,
    };

    if (isReceipt) {
      submitData.lineItems = lineItems;
    }

    if (splitType === "custom") {
      submitData.adjustments = adjustments;
    }

    try {
      await onSubmit(submitData);
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
      title="Edit expense"
      description="Keep the details in sync with your trip."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {transaction.currency_conversion && (
          <div className="space-y-2">
            <CurrencyReference conversion={transaction.currency_conversion} />
            <p className="muted text-xs">
              Amounts and shares below are in USD. Changing the total replaces
              the conversion reference with your edited USD amount.
            </p>
          </div>
        )}
        <div>
          <label
            htmlFor="edit-description"
            className="block text-sm font-medium text-accent/70 mb-2"
          >
            Description
          </label>
          <input
            id="edit-description"
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
            htmlFor="edit-amount"
            className="block text-sm font-medium text-accent/70 mb-2"
          >
            Amount ($)
          </label>
          <input
            id="edit-amount"
            inputMode="decimal"
            min="0.01"
            type="number"
            step="0.01"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className="w-full px-4 py-3 bg-transparent border-b-2 border-accent/20 text-accent focus:outline-none focus:border-accent"
            required
          />
        </div>

        <div>
          <label
            htmlFor="edit-payer"
            className="block text-sm font-medium text-accent/70 mb-2"
          >
            Paid By
          </label>
          <select
            id="edit-payer"
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            className="w-full px-4 py-3 bg-transparent border-b-2 border-accent/20 text-accent focus:outline-none focus:border-accent"
          >
            {memberNames.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>

        {!isReceipt && (
          <div>
            <label className="block text-sm font-medium text-accent/70 mb-2">
              Split Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
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
              <label className="flex items-center">
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
            </div>
          </div>
        )}

        {isReceipt ? (
          <ReceiptLineItemEditor
            lineItems={lineItems}
            members={memberNames}
            totalAmount={parseFloat(totalAmount) || 0}
            onChange={setLineItems}
          />
        ) : splitType === "custom" ? (
          <CustomSplitEditor
            members={memberNames}
            totalAmount={parseFloat(totalAmount) || 0}
            tripId={tripId}
            existingAdjustments={adjustments}
            onChange={setAdjustments}
          />
        ) : null}

        {error && (
          <p role="alert" className="text-sm text-red-800">
            {error}
          </p>
        )}
        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving || isDeleting}
            className="btn-secondary flex-1"
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
