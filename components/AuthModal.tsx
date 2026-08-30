"use client";

import { useEffect, useRef, useState } from "react";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/useAuth";
import Modal from "./Modal";
import Icon from "./Icon";
import { rememberedEmail } from "@/lib/auth/preferences";
import GoogleSignInButton from "./GoogleSignInButton";

export default function AuthModal({
  isOpen,
  onClose,
  inviteCode,
  notice,
}: {
  isOpen: boolean;
  onClose?: () => void;
  inviteCode?: string | null;
  notice?: string;
}) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openingGoogle, setOpeningGoogle] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isOpen && !success) {
      setEmail((current) => current || rememberedEmail());
      emailInput.current?.focus({ preventScroll: true });
    }
  }, [isOpen, success]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting || openingGoogle) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), inviteCode);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error && /email rate limit exceeded/i.test(err.message)
          ? "Email sign-in is temporarily rate-limited. Continue with Google above, or try email later."
          : isAuthRetryableFetchError(err)
            ? "We couldn’t reach the sign-in service. Check your connection and try again in a moment."
            : err instanceof Error
              ? err.message
              : "Couldn’t send your link. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal
      open={isOpen}
      onClose={() => onClose?.()}
      title={
        success
          ? "Check your inbox."
          : inviteCode
            ? "Sign in to join the trip."
            : "Welcome to Squared."
      }
      description={
        success
          ? "Your sign-in link is on its way."
          : inviteCode
            ? "Your invite is saved. Choose how to sign in."
            : "Sign in with Google or an email link."
      }
    >
      {success ? (
        <div role="status">
          <span className="icon-tile mb-5">
            <Icon name="mail" />
          </span>
          <p className="muted">
            We sent a magic link to{" "}
            <strong className="break-all text-accent">{email}</strong>. Open it
            to continue. If you don’t see it, check your spam folder.
          </p>
          {inviteCode && (
            <p className="mt-4 text-sm">
              After sign-in, we’ll open the invited trip automatically. You
              don’t need to create a trip.
            </p>
          )}
          <p className="muted mt-4 text-xs">
            On iPhone, open the link in the browser where you use Squared.
            Private browsing and in-app browsers can keep separate sign-ins.
          </p>
          <button
            onClick={() => {
              setSuccess(false);
              setError(null);
            }}
            className="btn-secondary mt-6 w-full"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          {notice && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
            >
              {notice}
            </p>
          )}
          <GoogleSignInButton
            inviteCode={inviteCode}
            disabled={submitting}
            onBusyChange={setOpeningGoogle}
          />
          <div className="flex items-center gap-3 text-xs text-[#5e6b5f]">
            <span className="h-px flex-1 bg-[#e1e5dc]" />
            <span>or use email</span>
            <span className="h-px flex-1 bg-[#e1e5dc]" />
          </div>
          <div>
            <label
              htmlFor="sign-in-email"
              className="mb-2 block text-sm font-medium"
            >
              Email address
            </label>
            <input
              ref={emailInput}
              id="sign-in-email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              className="w-full"
              disabled={submitting || openingGoogle}
            />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={submitting || openingGoogle || !email.trim()}
          >
            {submitting ? "Sending your link…" : "Send me a magic link"}
            <Icon name="arrow" width="17" />
          </button>
          <p className="text-center text-xs text-[#5e6b5f]">
            You’ll stay signed in on this browser until you sign out or your
            session needs renewing.
          </p>
        </form>
      )}
    </Modal>
  );
}
