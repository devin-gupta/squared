"use client";

import { useState, useEffect, useRef } from "react";
import { useDraftContext } from "./ExpenseDraftContext";
import Modal from "./Modal";
import DeleteExpenseAction from "./DeleteExpenseAction";
import CustomSplitEditor from "./CustomSplitEditor";
import ReceiptLineItemEditor from "./ReceiptLineItemEditor";
import CurrencySelector from "./CurrencySelector";
import { customSplitError } from "@/lib/transactions/splits";
import { TransactionParsed } from "@/types/transaction";
import { CATEGORIES, normalizeCategory } from "@/lib/categories";

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
  const draftContext = useDraftContext();
  const editingDraftId = useRef(draftContext?.draft?.id);
  const writer = useRef(draftContext?.update);
  writer.current = draftContext?.update;
  const locked = !!draftContext?.draft?.submission;
  const [participants, setParticipants] = useState(
    initialData?.participants?.length
      ? initialData.participants.filter((n) => memberNames.includes(n))
      : memberNames,
  );
  const [category, setCategory] = useState(
    normalizeCategory(initialData?.category),
  );
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [totalAmount, setTotalAmount] = useState(
    initialData?.total_amount?.toString() || "",
  );
  const [payerName, setPayerName] = useState(initialData?.payer_name || "");
  const [currency, setCurrency] = useState(initialData?.currency || "USD");
  const [lineItems, setLineItems] = useState(initialData?.line_items || []);
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
    !lineItems.length && splitType === "equal" && !participants.length
      ? "Choose at least one person to split with."
      : lineItems.length
        ? Math.abs(
            lineItems.reduce((sum, item) => sum + item.amount, 0) -
              Number(totalAmount),
          ) > 0.005
          ? "Receipt items must add up to the expense amount."
          : null
        : splitType === "custom"
          ? customSplitError(
              Number(totalAmount),
              memberNames,
              adjustments,
              currency,
            )
          : null;
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedDraft: TransactionParsed = {
    description,
    total_amount: parseFloat(totalAmount) || 0,
    currency,
    category: lineItems.length ? undefined : category,
    line_items: lineItems.length ? lineItems : undefined,
    payer_name: payerName || undefined,
    split_type: splitType,
    participants,
    adjustments:
      splitType === "custom" && !lineItems.length
        ? adjustments.map((a) => ({ user_name: a.memberId, amount: a.amount }))
        : undefined,
  };
  useEffect(() => {
    if (
      !locked &&
      writer.current &&
      draftContext?.draft?.id === editingDraftId.current
    )
      void writer
        .current({ parsed: parsedDraft, mode: "manual" })
        .catch(() => {});
  }, [
    description,
    totalAmount,
    currency,
    category,
    lineItems,
    payerName,
    splitType,
    adjustments,
    participants,
    locked,
  ]);

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
      ...parsedDraft,
      line_items:
        !lineItems.length &&
        splitType === "equal" &&
        participants.length < memberNames.length
          ? [
              {
                description,
                amount: parseFloat(totalAmount) || 0,
                category,
                split_among: participants,
              },
            ]
          : parsedDraft.line_items,
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
        {draftContext && (
          <p role="status" className="muted text-xs">
            {draftContext.storageStatus === "unavailable"
              ? "This browser couldn’t preserve your draft. Keep this page open."
              : locked
                ? "The last save wasn’t confirmed. Retry to check the same expense without making a duplicate."
                : draftContext.offline
                  ? "Saved on this device · Not synced yet. Save to the trip when you’re online."
                  : draftContext.storageStatus === "saving"
                    ? "Saving draft on this device…"
                    : "Draft saved on this device · Not saved to the trip"}
          </p>
        )}
        {locked && draftContext && (
          <button
            type="button"
            className="min-h-11 text-xs underline"
            disabled={isSaving}
            onClick={async () => {
              if (
                !window.confirm(
                  "Discard this local draft? Its expense may already be saved to the trip. Check the trip before adding it again. This will not delete any saved expense.",
                )
              )
                return;
              try {
                await draftContext.clear();
                onCancel();
              } catch {
                setError(
                  "Couldn’t clear this draft. Keep this page open and try again.",
                );
              }
            }}
          >
            Discard local draft
          </button>
        )}
        <fieldset disabled={locked} className="space-y-5">
          {initialData?.amount_text && (
            <p className="rounded-xl bg-[#edf1e9] p-3 text-sm">
              Printed total: <strong>{initialData.amount_text}</strong>. Check
              the amount and currency before saving.
            </p>
          )}
          {initialData?.review_note && (
            <p role="alert" className="text-sm text-amber-800">
              {initialData.review_note}
            </p>
          )}
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
              Amount ({currency === "USD" ? "$" : currency})
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

          {tripId && (
            <CurrencySelector
              currency={currency}
              amount={Number(totalAmount)}
              onChange={setCurrency}
            />
          )}

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

          {!lineItems.length && (
            <div>
              <label
                htmlFor="expense-category"
                className="block text-sm font-medium text-accent/70 mb-2"
              >
                Category
              </label>
              <select
                id="expense-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 bg-transparent border-b-2 border-accent/20 text-accent focus:outline-none focus:border-accent"
              >
                {CATEGORIES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!lineItems.length && splitType === "equal" && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Split with</legend>
              <div className="flex flex-wrap gap-2">
                {memberNames.map((name) => (
                  <label
                    key={name}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-[#e1e5dc] px-3"
                  >
                    <input
                      type="checkbox"
                      checked={participants.includes(name)}
                      onChange={(e) =>
                        setParticipants((p) =>
                          e.target.checked
                            ? [...p, name]
                            : p.filter((n) => n !== name),
                        )
                      }
                    />
                    {name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {lineItems.length ? (
            <ReceiptLineItemEditor
              lineItems={lineItems}
              members={memberNames.map((name) => ({ id: name, name }))}
              totalAmount={Number(totalAmount) || 0}
              currency={currency}
              onChange={setLineItems}
            />
          ) : (
            splitType === "custom" && (
              <CustomSplitEditor
                members={memberNames.map((name) => ({ id: name, name }))}
                totalAmount={Number(totalAmount) || 0}
                currency={currency}
                tripId={tripId}
                existingAdjustments={adjustments}
                onChange={setAdjustments}
              />
            )
          )}
        </fieldset>
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
            {isSaving
              ? "Saving…"
              : draftContext?.offline
                ? "Save draft"
                : locked
                  ? "Retry save"
                  : "Save"}
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
