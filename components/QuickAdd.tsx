"use client";

import { useEffect, useId, useRef, useState, useMemo } from "react";
import { useDraftContext } from "./ExpenseDraftContext";
import CameraButton from "./CameraButton";
import Icon from "./Icon";
import ExpenseProgress from "./ExpenseProgress";
import { receiptSourceFileError, transferredFiles } from "@/lib/receipts/files";
import { prepareReceiptFile } from "@/lib/receipts/prepare";
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
  const draftContext = useDraftContext();
  const [localInput, setLocalInput] = useState("");
  const [localImage, setLocalImage] = useState<File>();
  const input = draftContext ? draftContext.draft?.text || "" : localInput;
  const attached = draftContext?.draft?.image;
  const imageFile = useMemo(
    () =>
      draftContext
        ? attached
          ? new File([attached.blob], attached.name, { type: attached.type })
          : undefined
        : localImage,
    [attached, localImage, !!draftContext],
  );
  const locked = !!draftContext?.draft?.submission;
  const setInput = (text: string) => {
    if (draftContext) void draftContext.update({ text }).catch(() => {});
    else setLocalInput(text);
  };
  const setImageFile = (file: File | undefined) => {
    if (draftContext)
      void draftContext
        .update({
          image: file
            ? { blob: file, name: file.name, type: file.type }
            : undefined,
        })
        .catch(() => {});
    else setLocalImage(file);
  };
  const [imagePreview, setImagePreview] = useState("");
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const [submitting, setSubmitting] = useState(false);
  const [converting, setConverting] = useState(false);
  const conversionInFlight = useRef(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Extract<
    ExpenseEntryResult,
    { status: "saved" }
  > | null>(null);
  const busy = submitting || !!isProcessing;
  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);
  const attachFiles = async (files: File[]) => {
    if (
      busy ||
      converting ||
      conversionInFlight.current ||
      locked ||
      inFlight.current ||
      !files.length
    )
      return;
    if (files.length !== 1) {
      setError(
        "Attach one image per expense. Your existing draft is unchanged.",
      );
      return;
    }
    const message = receiptSourceFileError(files[0]);
    if (message) {
      setError(message);
      return;
    }
    conversionInFlight.current = true;
    setConverting(true);
    setError("");
    try {
      setImageFile(await prepareReceiptFile(files[0]));
      setSaved(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "This image couldn’t be prepared. Try another image.",
      );
    } finally {
      conversionInFlight.current = false;
      setConverting(false);
    }
  };
  const reset = () => {
    setSaved(null);
    setError("");
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      inFlight.current ||
      conversionInFlight.current ||
      busy ||
      (!input.trim() && !imageFile)
    )
      return;
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
      } else if (result?.status !== "draft") onReview?.();
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
  if (draftContext && !draftContext.ready)
    return (
      <p role="status" className="muted p-5">
        Restoring your draft…
      </p>
    );
  return (
    <section
      className={`${embedded ? "" : "panel overflow-hidden"} ${dragging ? "rounded-2xl ring-2 ring-[#557344]" : ""}`}
      onPaste={(event) => {
        const files = transferredFiles(event.clipboardData);
        if (!files.length) return; // Ordinary text paste must keep working.
        event.preventDefault();
        attachFiles(files);
      }}
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        dragDepth.current++;
        if (!busy && !converting) setDragging(true);
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = busy || converting ? "none" : "copy";
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.stopPropagation();
        dragDepth.current = 0;
        setDragging(false);
        attachFiles(transferredFiles(event.dataTransfer));
      }}
    >
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
            disabled={locked}
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
            aria-describedby={`${inputId}-hint${error ? ` ${inputId}-error` : ""}`}
          />
          <p
            id={`${inputId}-hint`}
            className="muted mt-2 text-xs"
            aria-live="polite"
          >
            {converting
              ? "Converting Apple photo to JPEG…"
              : dragging
                ? "Drop one image to attach it."
                : "Type an expense, or paste/drop a receipt or booking image. JPEG, PNG, WebP, HEIC or HEIF."}
          </p>
          {draftContext &&
            (input || imageFile || draftContext.draft?.parsed || locked) && (
              <div className="mt-3 text-xs" role="status">
                {draftContext.storageStatus === "unavailable" ? (
                  <p className="text-red-800">
                    This browser couldn’t preserve your draft. Keep this page
                    open.
                  </p>
                ) : (
                  <p className="muted">
                    {draftContext.storageStatus === "saving"
                      ? "Saving draft on this device…"
                      : draftContext.offline
                        ? "Saved on this device · Not synced yet"
                        : "Draft saved on this device · Not saved to the trip"}
                  </p>
                )}
                {locked && (
                  <p className="mt-2">
                    The last save wasn’t confirmed. Retry to check it before
                    changing this expense; it won’t create a duplicate.
                  </p>
                )}
                {!locked && (
                  <button
                    type="button"
                    className="mt-2 min-h-8 underline"
                    onClick={() => void draftContext.clear().catch(() => {})}
                  >
                    Discard draft
                  </button>
                )}
              </div>
            )}
          {imageFile && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-[#edf1e9] px-3 py-2 text-xs">
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Attached expense image preview"
                  className="h-14 w-14 shrink-0 rounded object-contain bg-white"
                />
              )}
              <span className="min-w-0 flex-1 break-words" role="status">
                Image: {imageFile.name || "Pasted image"}
              </span>
              <button
                type="button"
                onClick={() => setImageFile(undefined)}
                disabled={locked}
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
            <CameraButton
              onImageCapture={(file) => attachFiles([file])}
              disabled={busy || converting || locked}
            />
            <button
              type="submit"
              disabled={converting || (!input.trim() && !imageFile)}
              className="btn-primary"
            >
              {draftContext?.offline
                ? "Save draft"
                : locked
                  ? "Check saved expense"
                  : error
                    ? "Try again"
                    : "Add expense"}
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
