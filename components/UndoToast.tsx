"use client";
import { useEffect, useRef, useState } from "react";
export default function UndoToast({
  show,
  message,
  onUndo,
  onDismiss,
  itemId,
}: {
  show: boolean;
  type: "transaction" | "member";
  message: string;
  onUndo: () => void | Promise<void>;
  onDismiss: () => void;
  itemId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    setError("");
  }, [itemId]);
  useEffect(() => {
    if (!show || busy || error) return;
    const timer = setTimeout(() => dismiss.current(), 30000);
    return () => clearTimeout(timer);
  }, [show, busy, error, itemId]);
  if (!show) return null;
  return (
    <div
      role="status"
      className="fixed bottom-[calc(160px+env(safe-area-inset-bottom))] lg:bottom-6 left-4 right-4 z-[70] mx-auto max-w-lg rounded-2xl bg-accent p-4 text-white shadow-lg"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">{message}</span>
        <button
          className="min-h-11 font-medium underline"
          disabled={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              await onUndo();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Couldn’t undo. Try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Undoing…" : "Undo"}
        </button>
        <button
          aria-label="Dismiss undo"
          className="min-h-11 px-2"
          disabled={busy}
          onClick={onDismiss}
        >
          ×
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
