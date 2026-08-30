import { supabase } from "@/lib/supabase/client";
import {
  normalizeInvite,
  pendingInvite,
  rememberInvite,
  signInRedirect,
} from "./preferences";

export function googleCallbackUrl(origin: string, inviteCode: string | null) {
  const url = new URL("/auth/callback", origin);
  const invite = normalizeInvite(inviteCode);
  if (invite) url.searchParams.set("invite", invite);
  return url.toString();
}

export async function signInWithGoogle(inviteCode?: string | null) {
  const currentUrl = new URL(window.location.href);
  // The home page uses `code` for trip invitations. OAuth responses go to a
  // dedicated path, so an authorization code can never become a trip code.
  const explicit =
    currentUrl.pathname === "/auth/callback"
      ? currentUrl.searchParams.get("invite")
      : currentUrl.searchParams.get("code");
  if (explicit !== null && !normalizeInvite(explicit)) {
    throw new Error(
      "This invite is incomplete. Ask your friend for a fresh link.",
    );
  }
  const invite = normalizeInvite(inviteCode || explicit) || pendingInvite();
  if (invite) rememberInvite(invite);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: googleCallbackUrl(window.location.origin, invite),
      skipBrowserRedirect: true,
      // Squared only needs identity. Do not request offline access to Google
      // APIs or force a new consent screen on every sign-in.
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    throw new Error("Couldn’t open Google sign-in. Please try again.");
  }
  window.location.assign(data.url);
}

export async function completeGoogleSignIn(): Promise<string> {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const explicitInvite = url.searchParams.get("invite");
  const invite =
    explicitInvite === null ? pendingInvite() : normalizeInvite(explicitInvite);
  if (invite) rememberInvite(invite);
  const providerError = hash.get("error") || url.searchParams.get("error");
  const hasProviderError = ["error", "error_code", "error_description"].some(
    (key) => hash.has(key) || url.searchParams.has(key),
  );
  if (hasProviderError || url.searchParams.has("code")) {
    // Do not render provider error text or keep auth parameters in history.
    const cleanUrl = new URL(googleCallbackUrl(url.origin, invite));
    window.history.replaceState(
      window.history.state,
      "",
      cleanUrl.pathname + cleanUrl.search,
    );
    throw new Error(
      providerError === "access_denied"
        ? `Google sign-in wasn’t completed. You can try again.${invite ? " Your trip invite is still saved." : ""}`
        : "We couldn’t complete Google sign-in. Please try again from this browser.",
    );
  }
  if (explicitInvite !== null && !invite) {
    throw new Error(
      "This trip invite is incomplete. Ask your friend for a fresh link.",
    );
  }
  // The shared browser client consumes the implicit OAuth fragment and persists
  // the Supabase session. A server cookie callback would not populate this store.
  // Check initialization itself: a failed OAuth response can leave an older
  // session in storage, which getSession() alone would incorrectly call success.
  const { error: initializationError } = await supabase.auth.initialize();
  if (initializationError) {
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search,
    );
    throw new Error("We couldn’t complete Google sign-in. Please try again.");
  }
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session) {
    throw new Error(
      "This sign-in couldn’t be completed. Try Google again in the browser where you use Squared.",
    );
  }
  // Only return to our home page, optionally with a validated trip invite.
  // Never honor arbitrary `next` or redirect URLs supplied by a callback.
  const destination = new URL(signInRedirect(url.origin, invite));
  return destination.pathname + destination.search;
}
