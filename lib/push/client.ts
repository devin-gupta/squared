import { supabase } from "../supabase/client";
import { readPushOwner, writePushOwner } from "./device";
export async function subscriptionRequest(body: Record<string, unknown>) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in to manage notifications.");
  const response = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Couldn’t update notifications.");
  return result;
}
export async function requestPushDelivery() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/push/dispatch", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      keepalive: true,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* The durable queue remains available to a later flush or cron. */
  }
}
export async function disableDevicePush() {
  const owner = await readPushOwner().catch(() => null);
  const registration =
    "serviceWorker" in navigator
      ? await navigator.serviceWorker.getRegistration("/")
      : undefined;
  const subscription = await registration?.pushManager?.getSubscription();
  // Clear the recipient guard before any network work, including sign-out.
  await writePushOwner(null);
  const endpoint = subscription?.endpoint || owner?.endpoint;
  const [remote, local] = await Promise.allSettled([
    endpoint
      ? subscriptionRequest({ action: "unsubscribe", endpoint })
      : Promise.resolve(),
    subscription ? subscription.unsubscribe() : Promise.resolve(true),
  ]);
  if (
    remote.status === "rejected" &&
    (local.status === "rejected" || !local.value)
  )
    throw new Error(
      "Notifications are muted here, but this device could not be disconnected. Try again when online.",
    );
}
export async function disconnectPushForSignOut() {
  if (typeof navigator === "undefined" || !("indexedDB" in globalThis)) return;
  const owner = await readPushOwner().catch(() => null);
  if (owner) await disableDevicePush();
}
export function applicationServerKey(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(bytes, (c) => c.charCodeAt(0));
}
