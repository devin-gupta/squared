"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import AuthModal from "./AuthModal";
import Icon from "./Icon";
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
      <div
        role="status"
        className="flex min-h-[60vh] items-center justify-center gap-3 muted"
      >
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#dfe5d7] border-t-accent" />
        Getting things ready…
      </div>
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
            {inviteCode ? "Join your people." : "Let’s get you signed in."}
          </h1>
          <p className="muted mt-4">
            {inviteCode
              ? "Sign in and we’ll take you straight to the shared trip. No new trip to create."
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
            Continue with email <Icon name="arrow" width="17" />
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
    <>
      <div className="grid min-h-[75vh] items-center gap-10 py-8 xl:grid-cols-[1.1fr_1fr]">
        <section>
          <p className="eyebrow mb-6">Good company. Clear tabs.</p>
          <h1 className="font-serif text-5xl leading-[1.08] tracking-[-0.05em] sm:text-6xl">
            Share the trip.
            <br />
            <span className="text-[#799260]">Skip the math.</span>
          </h1>
          <p className="muted mt-6 max-w-sm text-[1rem]">
            From the first coffee to the last cab home. Keep your group’s
            expenses together, and settle up without the awkward part.
          </p>
          <button
            onClick={() => setShowAuth(true)}
            className="btn-primary mt-8"
          >
            Get started
            <Icon name="arrow" width="17" />
          </button>
          <p className="muted mt-3 text-xs">
            Google or an email link. No password to remember.
          </p>
          {process.env.NODE_ENV === "development" && (
            <Link
              href="/preview"
              className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4"
            >
              Explore the sample trip
              <Icon name="arrow" width="15" />
            </Link>
          )}
        </section>
        <section className="panel relative overflow-hidden p-7 sm:p-9">
          <div className="mb-8 flex items-center justify-between">
            <span className="eyebrow">A weekend together</span>
            <span className="rounded-full bg-[#edf1e9] px-3 py-1 text-[10px] font-medium">
              ILLUSTRATION
            </span>
          </div>
          <h2 className="font-serif text-3xl">
            Little moments.
            <br />
            All accounted for.
          </h2>
          <div className="my-7 divide-y divide-[#edf0e8]">
            {[
              {
                icon: "coffee" as const,
                title: "Coffee for the road",
                subtitle: "You paid · split equally",
                amount: "$24.00",
              },
              {
                icon: "home" as const,
                title: "A place to call home",
                subtitle: "Alex paid · split equally",
                amount: "$480.00",
              },
              {
                icon: "travel" as const,
                title: "The scenic route",
                subtitle: "Sam paid · split equally",
                amount: "$96.00",
              },
            ].map((t) => (
              <div key={t.title} className="flex items-center gap-3 py-5">
                <span className="icon-tile">
                  <Icon name={t.icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="mt-1 text-xs text-[#5e6b5f]">{t.subtitle}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {t.amount}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-[#eaf0df] p-4 text-xs">
            <Icon name="check" className="shrink-0" />
            Everyone in the loop. Everything in one place.
          </div>
        </section>
      </div>
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </>
  );
}
