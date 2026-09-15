"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AuthModal from "./AuthModal";
import Icon from "./Icon";
import PublicLanding from "./PublicLanding";
import {
  normalizeInvite,
  pendingInvite,
  rememberInvite,
  forgetInvite,
} from "@/lib/auth/preferences";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [checkingInvite, setCheckingInvite] = useState(true);
  const [linkError, setLinkError] = useState("");
  const [signOutError, setSignOutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    const explicit = url.searchParams.get("code");
    const invite = url.searchParams.has("code")
      ? normalizeInvite(explicit)
      : pendingInvite();
    if (invite) rememberInvite(invite);
    setInviteCode(invite);
    const hash = new URLSearchParams(url.hash.slice(1));
    if (hash.has("error") || url.searchParams.has("error")) {
      setLinkError(
        `This sign-in link has expired or was already used. Request a new link below.${invite ? " Your trip invite is still saved." : ""}`,
      );
      setShowAuth(true);
      // Remove the failed auth response without removing the trip code.
      url.hash = "";
      url.searchParams.delete("error");
      url.searchParams.delete("error_code");
      url.searchParams.delete("error_description");
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search,
      );
    } else if (url.searchParams.has("code") && !invite) {
      forgetInvite();
      setLinkError(
        "This trip invite is incomplete. Ask your friend for a fresh invite link.",
      );
    } else if (invite && !user) setShowAuth(true);
    setCheckingInvite(false);
  }, [user?.id]);
  if (loading || checkingInvite)
    return (
      <PublicLanding
        showAuth={showAuth}
        onOpenAuth={() => setShowAuth(true)}
        onCloseAuth={() => setShowAuth(false)}
      />
    );
  if (user)
    return (
      <>
        {children}
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e5dc] py-4 text-xs text-[#5e6b5f]">
          <span className="min-w-0 break-all">Signed in as {user.email}</span>
          <button
            className="min-h-11 underline underline-offset-4"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              setSignOutError("");
              try {
                await signOut();
                setShowAuth(false);
                setLinkError("");
              } catch {
                setSignOutError("Couldn’t sign out. Please try again.");
              } finally {
                setSigningOut(false);
              }
            }}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          {signOutError && <p role="alert">{signOutError}</p>}
        </footer>
      </>
    );
  if (inviteCode || linkError)
    return (
      <>
        <section className="mx-auto flex min-h-[65vh] max-w-md flex-col justify-center py-8">
          <span className="icon-tile mb-6">
            <Icon name="people" />
          </span>
          <p className="eyebrow mb-4">
            {inviteCode ? "You’re invited" : "Welcome back"}
          </p>
          <h1 className="page-title">
            {inviteCode
              ? "You’re invited to a trip."
              : "Let’s get you signed in."}
          </h1>
          <p className="muted mt-4">
            {inviteCode
              ? "Track expenses, split bills, and settle up together. Sign in and we’ll open your invited trip."
              : "Request a fresh link to continue."}
          </p>
          {inviteCode && (
            <p className="mt-4 text-sm">
              Invite code <strong className="font-mono">{inviteCode}</strong>
            </p>
          )}
          {linkError && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"
            >
              {linkError}
            </p>
          )}
          <button
            className="btn-primary mt-6"
            onClick={() => setShowAuth(true)}
          >
            Continue to the trip <Icon name="arrow" width="17" />
          </button>
          <button
            className="mt-4 min-h-11 text-sm underline underline-offset-4"
            onClick={() => {
              forgetInvite();
              window.location.assign("/");
            }}
          >
            Leave this invite
          </button>
        </section>
        <AuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          inviteCode={inviteCode}
          notice={linkError || undefined}
        />
      </>
    );
  return (
    <PublicLanding
      showAuth={showAuth}
      onOpenAuth={() => setShowAuth(true)}
      onCloseAuth={() => setShowAuth(false)}
    />
  );
}
