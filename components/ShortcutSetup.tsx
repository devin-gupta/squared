"use client";

import { useEffect, useState } from "react";
import { aiRequestHeaders } from "@/lib/ai/client-headers";

interface ShortcutStatus {
  enabled: boolean;
  tripName?: string;
  connected?: boolean;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
}

interface ShortcutSecret {
  token: string;
  uploadUrl: string;
  tripName: string;
}

export default function ShortcutSetup({ active }: { active: boolean }) {
  const [tripId, setTripId] = useState<string | null>(null);
  const [status, setStatus] = useState<ShortcutStatus | null>(null);
  const [secret, setSecret] = useState<ShortcutSecret | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!active) return;
    const selectedTrip = localStorage.getItem("tripId");
    setTripId(selectedTrip);
    setSecret(null);
    setError("");
    if (!selectedTrip) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const response = await fetch(
        `/api/shortcut/config?tripId=${encodeURIComponent(selectedTrip)}`,
        {
          headers: await aiRequestHeaders(),
          signal: AbortSignal.timeout(10000),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (!cancelled) setStatus(result);
    })().catch((reason) => {
      if (!cancelled)
        setError(reason?.message || "Couldn’t load shortcut settings.");
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const connect = async () => {
    if (!tripId || busy) return;
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const response = await fetch("/api/shortcut/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await aiRequestHeaders()),
        },
        body: JSON.stringify({ tripId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSecret(result);
      setStatus((current) => ({
        enabled: true,
        tripName: result.tripName,
        connected: true,
        expiresAt: null,
        lastUsedAt: current?.lastUsedAt || null,
      }));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn’t connect the shortcut.",
      );
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!tripId || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/shortcut/config", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(await aiRequestHeaders()),
        },
        body: JSON.stringify({ tripId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSecret(null);
      setStatus((current) => ({ ...current!, connected: false }));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn’t disconnect the shortcut.",
      );
    } finally {
      setBusy(false);
    }
  };

  const setupText = secret
    ? `Add to Squared setup\nURL: ${secret.uploadUrl}\nAuthorization: Bearer ${secret.token}\nForm field: file`
    : "";

  return (
    <section className="border-t border-[#e1e5dc] pt-5">
      <h3 className="font-semibold">Add receipts from Apple Photos</h3>
      <p className="muted mt-2">
        An optional iPhone Shortcut can receive a shared receipt, record you as
        the payer, split it equally with everyone in the selected trip, and save
        it without opening Squared.
      </p>
      {!tripId ? (
        <p className="muted mt-3">Open a trip before connecting a Shortcut.</p>
      ) : !status && !error ? (
        <p role="status" className="muted mt-3">
          Checking Shortcut access…
        </p>
      ) : status && !status.enabled ? (
        <p className="muted mt-3">Shortcut entry is not configured yet.</p>
      ) : secret ? (
        <div className="mt-3 space-y-3 text-sm">
          <p>
            This key connects only to <strong>{secret.tripName}</strong>. It is
            shown once; creating another key disconnects the old one.
          </p>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={async () => {
              await navigator.clipboard.writeText(setupText);
              setCopied(true);
            }}
          >
            {copied ? "Setup details copied" : "Copy Shortcut setup details"}
          </button>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              In Apple Shortcuts, create <strong>Add to Squared</strong>, enable
              “Show in Share Sheet,” and accept Images.
            </li>
            <li>Add “Convert Image” and choose JPEG.</li>
            <li>
              Add “Get Contents of URL”: use the copied URL, POST, a Form body
              with a File field named <strong>file</strong>, and the copied
              Authorization header.
            </li>
            <li>
              Add “Get Dictionary Value” for <strong>message</strong>, followed
              by “Show Notification.”
            </li>
          </ol>
          <p className="muted text-xs">
            After setup: take a photo, tap Share, choose Add to Squared, and
            wait for the saved notification before dismissing the share sheet.
          </p>
        </div>
      ) : status?.connected ? (
        <div className="mt-3 space-y-3">
          <p role="status" className="text-sm text-[#355745]">
            Connected to {status.tripName}. The secret key is hidden after
            setup.
          </p>
          <button
            type="button"
            className="btn-secondary w-full"
            disabled={busy}
            onClick={connect}
          >
            {busy ? "Updating…" : "Replace upload key"}
          </button>
          <button
            type="button"
            className="min-h-11 w-full text-sm text-red-700 underline"
            disabled={busy}
            onClick={disconnect}
          >
            Disconnect Add to Squared
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn-secondary mt-3 w-full"
          disabled={busy}
          onClick={connect}
        >
          {busy ? "Creating secure key…" : "Connect Add to Squared"}
        </button>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    </section>
  );
}
