"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { completeGoogleSignIn } from "@/lib/auth/google";
import { pendingInvite, signInRedirect } from "@/lib/auth/preferences";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<string | null>(null);
  const [backTo, setBackTo] = useState("/");
  const completion = useRef<Promise<string> | null>(null);
  useEffect(() => {
    let cancelled = false;
    completion.current ??= completeGoogleSignIn();
    completion.current
      .then((destination) => {
        if (!cancelled) router.replace(destination);
      })
      .catch((error) => {
        if (!cancelled) {
          const savedInvite = pendingInvite();
          setInvite(savedInvite);
          const destination = new URL(
            signInRedirect(window.location.origin, savedInvite),
          );
          setBackTo(destination.pathname + destination.search);
          setError(
            error instanceof Error
              ? error.message
              : "Couldn’t finish sign-in. Please try again.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);
  return (
    <section className="panel mx-auto my-8 max-w-md p-6 sm:p-8">
      <h1 className="font-serif text-3xl">
        {error ? "Let’s try that again." : "Signing you in…"}
      </h1>
      {error ? (
        <div className="mt-5 space-y-5">
          <p role="alert" className="muted">
            {error}
          </p>
          <GoogleSignInButton inviteCode={invite} />
          <Link href={backTo} className="btn-secondary w-full">
            Back to sign-in
          </Link>
        </div>
      ) : (
        <p role="status" className="muted mt-4">
          Finishing your Google sign-in and opening your trip.
        </p>
      )}
    </section>
  );
}
