"use client";

import { useId, useRef, useState } from "react";
import CameraButton from "./CameraButton";
import Icon from "./Icon";
import ExpenseProgress from "./ExpenseProgress";
import type {
  ExpenseEntryProgress,
  ExpenseEntryResult,
} from "@/lib/transactions/entry";

interface QuickAddProps {
  onSubmit: (
    text: string,
    imageFile?: File,
  ) => void | ExpenseEntryResult | Promise<void | ExpenseEntryResult>;
  isProcessing?: boolean;
  progress?: ExpenseEntryProgress | null;
  onManual?: (draft?: string) => void;
  onDone?: () => void;
  onReview?: () => void;
  autoFocus?: boolean;
  embedded?: boolean;
}

export default function QuickAdd({
  onSubmit,
  isProcessing,
  progress,
  onManual,
  onDone,
  onReview,
  autoFocus = false,
  embedded = false,
}: QuickAddProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Extract<
    ExpenseEntryResult,
    { status: "saved" }
  > | null>(null);
  const busy = submitting || !!isProcessing;
  const reset = () => {
    setSaved(null);
    setError("");
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current || busy || (!input.trim() && !imageFile)) return;
    inFlight.current = true;
    setSubmitting(true);
    setError("");
    setSaved(null);
    inputRef.current?.blur(); // Let the iPhone keyboard make room for progress.
    try {
      const result = await onSubmit(input.trim(), imageFile);
      if (result?.status === "saved") {
        setSaved(result);
        setInput("");
        setImageFile(undefined);
      } else onReview?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn’t add this expense. Your draft is still here.",
      );
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };
  return (
    <section className={embedded ? "" : "panel overflow-hidden"}>
      <div
        className={
          embedded
            ? "mb-3 flex justify-end"
            : "flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-6"
        }
      >
        {!embedded && (
          <h2 className="text-[1rem] font-semibold">Add an expense</h2>
        )}
        <span className="flex items-center gap-1.5 rounded-full bg-[#edf2e5] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[#557344]">
          <Icon
            name={saved && !busy ? "check" : "sparkles"}
            width="12"
            height="12"
          />
          {saved && !busy ? "SAVED" : busy ? "WORKING ON IT" : "AI ASSISTED"}
        </span>
      </div>
      {busy || saved ? (
        <ExpenseProgress
          embedded={embedded}
          progress={
            progress || {
              stage: "reading",
              kind: imageFile ? "receipt" : "text",
            }
          }
          draft={input}
          receiptName={imageFile?.name}
          saved={busy ? null : saved}
          onAnother={reset}
          onDone={
            onDone
              ? () => {
                  reset();
                  onDone();
                }
              : undefined
          }
        />
      ) : (
        <form
          onSubmit={handleSubmit}
          className={embedded ? "" : "p-5 pt-4 sm:p-6 sm:pt-4"}
        >
          <label htmlFor={inputId} className="sr-only">
            Describe your expense
          </label>
          <textarea
            ref={inputRef}
            id={inputId}
            autoFocus={autoFocus}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Dinner was $120, Alex paid. Split it equally."
            className="min-h-[112px] w-full resize-y rounded-xl border border-[#e1e5dc] bg-[#fafbf8] p-4 text-[1rem] leading-relaxed"
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
          {imageFile && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-[#edf1e9] px-3 py-2 text-xs">
              <span className="truncate">Receipt: {imageFile.name}</span>
              <button
                type="button"
                onClick={() => setImageFile(undefined)}
                aria-label="Remove receipt"
                className="p-2"
              >
                <Icon name="close" width="14" height="14" />
              </button>
            </div>
          )}
          {error && (
            <div
              id={`${inputId}-error`}
              role="alert"
              className="mt-3 rounded-xl bg-red-50 p-4 text-sm text-red-800"
            >
              <p>{error}</p>
              <p className="mt-2 text-xs">
                Your draft is still here. You can try again or enter the details
                manually.
              </p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <CameraButton onImageCapture={setImageFile} />
            <button
              type="submit"
              disabled={!input.trim() && !imageFile}
              className="btn-primary"
            >
              {error ? "Try again" : "Add expense"}
              <Icon name="arrow" width="16" />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0e8] pt-4">
            <p className="muted text-xs">
              Just say who paid and how to split it.
            </p>
            {onManual && (
              <button
                type="button"
                onClick={() => onManual(input)}
                className="min-h-8 text-xs font-medium underline underline-offset-4"
              >
                Enter manually
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
