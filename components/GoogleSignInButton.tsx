"use client";

import { useRef, useState } from "react";
import { signInWithGoogle } from "@/lib/auth/google";

export default function GoogleSignInButton({
  inviteCode,
  disabled = false,
  onBusyChange,
}: {
  inviteCode?: string | null;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const signIn = async () => {
    if (pending.current || disabled) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    onBusyChange?.(true);
    try {
      await signInWithGoogle(inviteCode);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Couldn’t open Google sign-in. Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  };
  return (
    <div>
      <button
        type="button"
        className="btn-secondary w-full"
        onClick={signIn}
        disabled={disabled || busy}
      >
        <img src="/google-g.png" alt="" width="18" height="18" />
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
    </div>
  );
}
