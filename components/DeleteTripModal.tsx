"use client";

import Modal from "./Modal";

export default function DeleteTripModal({
  isOpen,
  onClose,
  onConfirm,
  tripName,
  isDeleting = false,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tripName: string;
  isDeleting?: boolean;
  error?: string | null;
}) {
  return (
    <Modal
      open={isOpen}
      onClose={() => {
        if (!isDeleting) onClose();
      }}
      title="Delete this trip?"
      description={tripName}
    >
      <p className="rounded-xl bg-red-50 p-4 text-sm leading-relaxed text-red-800">
        This permanently deletes the trip and all its expenses. This action
        can’t be undone.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          onClick={onClose}
          className="btn-secondary flex-1"
          disabled={isDeleting}
          autoFocus
        >
          Keep trip
        </button>
        <button
          onClick={onConfirm}
          disabled={isDeleting}
          className="btn-primary flex-1 !bg-[#a04436] hover:!bg-[#8c362a]"
        >
          {isDeleting ? "Deleting…" : "Delete trip"}
        </button>
      </div>
    </Modal>
  );
}
