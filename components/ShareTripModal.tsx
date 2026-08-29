"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  generateShareUrl,
  shareTrip,
  copyToClipboard,
} from "@/lib/trips/share";
import Modal from "./Modal";
import Icon from "./Icon";

export default function ShareTripModal({
  isOpen,
  onClose,
  inviteCode,
  tripName,
}: {
  isOpen: boolean;
  onClose: () => void;
  inviteCode: string;
  tripName: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const shareUrl = generateShareUrl(inviteCode);
  const copy = async () => {
    setError("");
    if (await copyToClipboard(shareUrl)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else
      setError("Couldn’t copy the link. Select it below and copy it manually.");
  };
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Bring your people."
      description={`Invite friends to ${tripName}.`}
    >
      <div className="flex flex-col items-center rounded-2xl bg-[#f5f7f0] p-6">
        <div className="rounded-xl bg-white p-3">
          <QRCodeSVG value={shareUrl} size={176} />
        </div>
        <p className="muted mt-4 text-xs">Scan to join the trip</p>
        <p className="mt-3 font-mono text-lg tracking-[0.2em]">{inviteCode}</p>
      </div>
      <label
        htmlFor="trip-share-url"
        className="mb-2 mt-5 block text-sm font-medium"
      >
        Or share a link
      </label>
      <div className="flex gap-2">
        <input
          id="trip-share-url"
          value={shareUrl}
          readOnly
          className="min-w-0 flex-1 !text-sm"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button onClick={copy} className="btn-secondary">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {error}
        </p>
      )}
      <span role="status" className="sr-only">
        {copied ? "Invite link copied" : ""}
      </span>
      {typeof navigator !== "undefined" && !!navigator.share && (
        <button
          onClick={async () => {
            if (await shareTrip(inviteCode, tripName)) onClose();
          }}
          className="btn-primary mt-5 w-full"
        >
          <Icon name="people" width="18" />
          Share with friends
        </button>
      )}
    </Modal>
  );
}
