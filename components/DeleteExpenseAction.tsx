"use client";

import { useState } from "react";

export default function DeleteExpenseAction({
  onDelete,
  disabled,
  onBusyChange,
}: {
  onDelete: () => void | Promise<void>;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    onBusyChange?.(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn’t delete this expense. Please try again.",
      );
    } finally {
      setDeleting(false);
      onBusyChange?.(false);
    }
  };
  return (
    <div className="mt-6 border-t border-[#e1e5dc] pt-4">
      {confirming ? (
        <div className="rounded-xl bg-red-50 p-4">
          <p className="text-sm font-medium text-red-900">
            Delete this expense?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-red-800">
            This removes it from the trip and updates everyone’s totals. You
            can’t undo this.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="btn-secondary flex-1"
            >
              Keep expense
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={disabled || deleting}
              className="btn-primary flex-1 !bg-[#a04436]"
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={disabled}
          className="min-h-11 w-full text-sm font-medium text-[#a04436]"
        >
          Delete expense
        </button>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
