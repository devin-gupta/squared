"use client";

import { useEffect, useRef, useState } from "react";
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
  const [sharing, setSharing] = useState(false);
  const [nativeShare, setNativeShare] = useState(false);
  const pending = useRef(false);
  const shareUrl = generateShareUrl(inviteCode, tripName);
  useEffect(() => {
    setNativeShare(typeof navigator.share === "function");
    if (isOpen) {
      setCopied(false);
      setError("");
    }
  }, [isOpen, inviteCode, tripName]);
  const copy = async () => {
    setError("");
    if (await copyToClipboard(shareUrl)) {
      setCopied(true);
    } else
      setError("Couldn’t copy the link. Select it below and copy it manually.");
  };
  const share = async () => {
    if (pending.current) return;
    pending.current = true;
    setSharing(true);
    setError("");
    try {
      const result = await shareTrip(inviteCode, tripName);
      if (result === "shared") onClose();
      else if (result === "copied") setCopied(true);
      else if (result === "failed")
        setError(
          "Couldn’t open sharing. Use Copy above, or select the link and copy it manually.",
        );
    } finally {
      pending.current = false;
      setSharing(false);
    }
  };
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Invite friends to the trip."
      description="Share one link. Everyone can track expenses and split bills together."
    >
      <div className="flex flex-col items-center rounded-2xl bg-[#f5f7f0] p-5 sm:p-6">
        <div className="w-full max-w-[224px] rounded-xl bg-white p-3">
          <QRCodeSVG
            value={shareUrl}
            size={200}
            marginSize={4}
            className="h-auto w-full"
            title={`Scan to join ${tripName} on Squared`}
          />
        </div>
        <p className="muted mt-4 w-full break-words text-center text-xs">
          Scan to join {tripName}
        </p>
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
      {nativeShare && (
        <button
          onClick={share}
          disabled={sharing || !shareUrl}
          className="btn-primary mt-5 w-full"
        >
          <Icon name="people" width="18" />
          {sharing ? "Opening…" : "Share invite link"}
        </button>
      )}
      <p className="muted mt-4 text-xs">
        The trip name is included in the public invite. Expenses and balances
        aren’t.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {error}
        </p>
      )}
      <span role="status" className="sr-only">
        {copied ? "Invite link copied" : ""}
      </span>
    </Modal>
  );
}
