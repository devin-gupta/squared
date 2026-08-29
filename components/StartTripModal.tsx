"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import Icon from "./Icon";

export default function StartTripModal({
  isOpen,
  onClose,
  onSubmit,
  defaultUserName = "",
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (tripName: string, userName: string) => Promise<void>;
  defaultUserName?: string;
}) {
  const [tripName, setTripName] = useState("");
  const [userName, setUserName] = useState(defaultUserName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (isOpen) {
      setUserName(defaultUserName);
      setTripName("");
      setError(null);
    }
  }, [isOpen, defaultUserName]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !tripName.trim() || !userName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(tripName.trim(), userName.trim());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn’t create your trip. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Something to look forward to."
      description="Give your trip a name. You can invite the crew next."
    >
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="tripName" className="mb-2 block text-sm font-medium">
            Trip name
          </label>
          <input
            id="tripName"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            placeholder="A weekend in the mountains"
            required
            autoFocus
            className="w-full"
          />
        </div>
        <div>
          <label htmlFor="userName" className="mb-2 block text-sm font-medium">
            Your name
          </label>
          <input
            id="userName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            autoComplete="given-name"
            placeholder="What should we call you?"
            required
            className="w-full"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !tripName.trim() || !userName.trim()}
            className="btn-primary flex-1"
          >
            {submitting ? "Creating…" : "Create trip"}
            <Icon name="arrow" width="16" />
          </button>
        </div>
      </form>
    </Modal>
  );
}
