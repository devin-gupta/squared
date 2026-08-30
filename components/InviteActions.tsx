"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { rememberInvite } from "@/lib/auth/preferences";
import GoogleSignInButton from "./GoogleSignInButton";
import AuthModal from "./AuthModal";

export default function InviteActions({
  inviteCode,
  tripName,
}: {
  inviteCode: string;
  tripName: string | null;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [emailOpen, setEmailOpen] = useState(false);
  const [openingGoogle, setOpeningGoogle] = useState(false);
  useEffect(() => {
    rememberInvite(inviteCode);
    // The authenticated join flow resolves the actual trip by code, ignoring
    // the public display label, and reuses any existing membership.
    if (user) router.replace(`/?code=${encodeURIComponent(inviteCode)}`);
  }, [inviteCode, user?.id, router]);
  return (
    <div className="mt-6">
      {user ? (
        <p role="status" className="muted">
          Opening your invited trip…
        </p>
      ) : (
        <>
          <GoogleSignInButton
            inviteCode={inviteCode}
            disabled={loading}
            onBusyChange={setOpeningGoogle}
          />
          <button
            type="button"
            disabled={loading || openingGoogle}
            className="btn-secondary mt-3 w-full"
            onClick={() => setEmailOpen(true)}
          >
            Continue with email
          </button>
        </>
      )}
      <AuthModal
        focusEmail
        isOpen={emailOpen}
        onClose={() => setEmailOpen(false)}
        inviteCode={inviteCode}
        tripName={tripName}
      />
      <noscript>
        <p className="muted mt-4">
          Enable JavaScript to securely sign in and join this trip.
        </p>
      </noscript>
    </div>
  );
}
