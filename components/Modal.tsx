"use client";

import { ReactNode, useEffect, useId, useRef } from "react";
import Icon from "./Icon";

// Dialogs can overlap briefly when chat hands off to the manual editor.
let openDialogCount = 0;
let originalBodyOverflow = "";

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    const previousFocus = document.activeElement;
    element.showModal();
    if (openDialogCount === 0)
      originalBodyOverflow = document.body.style.overflow;
    openDialogCount += 1;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      openDialogCount -= 1;
      if (openDialogCount === 0)
        document.body.style.overflow = originalBodyOverflow;
      if (
        openDialogCount === 0 &&
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected
      ) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const bounds = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < bounds.left ||
            e.clientX > bounds.right ||
            e.clientY < bounds.top ||
            e.clientY > bounds.bottom
          )
            onClose();
        }
      }}
      style={{ width: "calc(100% - 2rem)", maxWidth: "28rem" }}
      className="modal-card max-h-[85dvh] overflow-y-auto overscroll-contain text-accent backdrop:bg-[#183023]/35 backdrop:backdrop-blur-sm"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            id={titleId}
            className="break-words font-serif text-3xl tracking-tight"
          >
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="muted mt-2">
              {description}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          type="button"
          aria-label="Close dialog"
          className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-[#edf1e9]"
        >
          <Icon name="close" width="18" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
