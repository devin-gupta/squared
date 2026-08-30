"use client";

import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { disconnectPushForSignOut } from "@/lib/push/client";
import {
  clearDevicePreferences,
  normalizeInvite,
  pendingInvite,
  rememberEmail,
  rememberInvite,
  signInRedirect,
} from "@/lib/auth/preferences";

interface AuthState {
  user: User | null;
  loading: boolean;
}
const initialState: AuthState = { user: null, loading: true };
let state = initialState;
const listeners = new Set<() => void>();
let started = false;
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    // One session observer for the whole app. INITIAL_SESSION waits for stored
    // session recovery/refresh, avoiding a separate, racing getSession request.
    supabase.auth.onAuthStateChange((_event, session) => {
      state = { user: session?.user ?? null, loading: false };
      listeners.forEach((notify) => notify());
    });
  }
  return () => {
    listeners.delete(listener);
  };
}
const getSnapshot = () => state;
const getServerSnapshot = () => initialState;

async function signIn(email: string, inviteCode?: string | null) {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get("code");
  if (url.searchParams.has("code") && !normalizeInvite(fromUrl)) {
    throw new Error(
      "This invite is incomplete. Ask your friend for a fresh link.",
    );
  }
  const invite = normalizeInvite(inviteCode || fromUrl) || pendingInvite();
  if (invite) rememberInvite(invite);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: signInRedirect(window.location.origin, invite),
    },
  });
  if (error) throw error;
  rememberEmail(email);
}
async function signOut() {
  await disconnectPushForSignOut();
  // Signing out here should not sign the user out of their other devices.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
  clearDevicePreferences();
}
export function useAuth() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return { ...snapshot, signIn, signOut };
}
