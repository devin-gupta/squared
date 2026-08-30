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
import { invitePreviewTitle, inviteDescription } from "@/lib/trips/invite";

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
          "Couldn’t open sharing. Copy the link below, or select it and copy it manually.",
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
      <div className="overflow-hidden rounded-2xl border border-[#e1e5dc] bg-[#f5f7f0]">
        <img
          src="/brand/share-card-v2.png"
          width="1200"
          height="630"
          alt=""
          className="w-full"
        />
        <div className="p-4">
          <p className="break-words font-medium">
            {invitePreviewTitle(tripName)}
          </p>
          <p className="muted mt-1 text-xs">{inviteDescription}</p>
        </div>
      </div>
      <p className="muted mt-3 text-xs">
        The trip name is included in the public invite. Expenses and balances
        aren’t.
      </p>
      <button
        onClick={share}
        disabled={sharing || !shareUrl}
        className="btn-primary mt-5 w-full"
      >
        <Icon name="people" width="18" />
        {sharing
          ? "Opening…"
          : nativeShare
            ? "Share invite link"
            : copied
              ? "Link copied — ready to paste"
              : "Copy invite link"}
      </button>
      <details className="mt-5 rounded-2xl border border-[#e1e5dc]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          Or scan a QR code
        </summary>
        <div className="flex flex-col items-center p-5">
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG
              value={shareUrl}
              size={176}
              title={`Scan to join ${tripName} on Squared`}
            />
          </div>
          <p className="muted mt-4 text-xs">Scan to join the trip</p>
          <p className="mt-3 font-mono text-lg tracking-[0.2em]">
            {inviteCode}
          </p>
        </div>
      </details>
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
    </Modal>
  );
}
