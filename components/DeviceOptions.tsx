"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Modal from "./Modal";
import { useAuth } from "@/hooks/useAuth";
import {
  applicationServerKey,
  disableDevicePush,
  requestPushDelivery,
  subscriptionRequest,
} from "@/lib/push/client";
import { readPushOwner, writePushOwner } from "@/lib/push/device";
import { ensureBackgroundWorker } from "@/lib/push/registration";
import ShortcutSetup from "./ShortcutSetup";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export default function DeviceOptions() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false),
    [installed, setInstalled] = useState(false),
    [ios, setIos] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [supported, setSupported] = useState(false),
    [enabled, setEnabled] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [config, setConfig] = useState<{
    enabled: boolean;
    publicKey: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    // Register silently; installation and notification permission stay opt-in.
    if (
      process.env.NODE_ENV === "production" &&
      window.isSecureContext &&
      "serviceWorker" in navigator
    ) {
      void ensureBackgroundWorker().catch(() => {});
    }
    const media = window.matchMedia("(display-mode: standalone)");
    const update = () =>
      setInstalled(media.matches || !!(navigator as any).standalone);
    update();
    setIos(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    setSupported(
      window.isSecureContext &&
        "Notification" in window &&
        "PushManager" in window &&
        "serviceWorker" in navigator,
    );
    if ("Notification" in window) setPermission(Notification.permission);
    const defer = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const done = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", defer);
    window.addEventListener("appinstalled", done);
    media.addEventListener("change", update);
    return () => {
      window.removeEventListener("beforeinstallprompt", defer);
      window.removeEventListener("appinstalled", done);
      media.removeEventListener("change", update);
    };
  }, []);
  useEffect(() => {
    if (loading) return;
    void readPushOwner()
      .then((owner) => {
        if (owner && owner.userId !== user?.id) return writePushOwner(null);
      })
      .catch(() => {});
    // Only flush existing, server-recorded activity. This never asks for permission.
    if (user) void requestPushDelivery();
  }, [loading, user?.id]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setChecking(true);
    setError("");
    setEnabled(false);
    (async () => {
      if ("Notification" in window) setPermission(Notification.permission);
      const response = await fetch("/api/push/config", {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw new Error(
          "Couldn’t load notification settings. Close this menu and try again.",
        );
      const cfg = await response.json();
      if (!cancelled) setConfig(cfg);
      if (user && supported) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager?.getSubscription();
        if (subscription) {
          const status = await subscriptionRequest({
            action: "status",
            endpoint: subscription.endpoint,
          });
          const owner = await readPushOwner();
          if (!cancelled)
            setEnabled(
              !!status.enabled &&
                owner?.userId === user.id &&
                Notification.permission === "granted",
            );
        }
      }
    })()
      .catch((e) => {
        if (!cancelled) setError(e.message || "Couldn’t load settings.");
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, user?.id, supported]);
  const enable = async () => {
    if (!user || !config?.publicKey || busy) return;
    setBusy(true);
    setError("");
    let subscription: PushSubscription | null = null;
    let newSubscription = false;
    try {
      // This must be the first async operation in the click handler on iPhone.
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== "granted") return;
      const registration = await ensureBackgroundWorker();
      subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(config.publicKey),
        });
        newSubscription = true;
      }
      await writePushOwner({
        userId: user.id,
        endpoint: subscription.endpoint,
      });
      await subscriptionRequest({
        action: "subscribe",
        subscription: subscription.toJSON(),
      });
      setEnabled(true);
    } catch (e) {
      await writePushOwner(null).catch(() => {});
      if (newSubscription) await subscription?.unsubscribe().catch(() => {});
      setError(
        e instanceof Error ? e.message : "Couldn’t enable notifications.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-4 pb-14 lg:pb-0">
      <button
        type="button"
        className="mx-auto block min-h-11 text-xs text-[#5e6b5f] underline underline-offset-4"
        onClick={() => setOpen(true)}
      >
        App &amp; notifications
      </button>
      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Squared, close at hand."
        description="Your trip on your Home Screen. Notifications only when you choose them."
      >
        <div className="space-y-6 text-left">
          <section>
            <h3 className="font-semibold">Add to Home Screen</h3>
            {installed ? (
              <p className="muted mt-2">
                You’re already using the installed app.
              </p>
            ) : (
              <>
                <p className="muted mt-2">
                  Open Squared like an app, with the same trip, saved drafts and
                  familiar icon.
                </p>
                {installEvent ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn-primary mt-3 w-full"
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await installEvent.prompt();
                        await installEvent.userChoice;
                        setInstallEvent(null);
                      } catch {
                        setError("Use your browser’s menu to install Squared.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Add Squared to Home Screen
                  </button>
                ) : ios ? (
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
                    <li>Open Squared in Safari.</li>
                    <li>
                      Tap Share, then <strong>Add to Home Screen</strong>.
                    </li>
                    <li>Tap Add, then open Squared from its new icon.</li>
                  </ol>
                ) : (
                  <p className="muted mt-3">
                    Open your browser’s menu and choose{" "}
                    <strong>Install Squared</strong> or{" "}
                    <strong>Add to Home Screen</strong>, if available.
                  </p>
                )}
              </>
            )}
          </section>
          <section className="border-t border-[#e1e5dc] pt-5">
            <h3 className="font-semibold">Expense notifications</h3>
            <p className="muted mt-2">
              Get a notification when someone else adds an expense to one of
              your trips. No amounts or receipt details appear in notifications.
            </p>
            {!user ? (
              <Link
                className="btn-secondary mt-3 w-full"
                href="/"
                onClick={() => setOpen(false)}
              >
                Sign in to enable notifications
              </Link>
            ) : ios && !installed ? (
              <p className="muted mt-3">
                On iPhone or iPad (iOS 16.4 or later), add Squared to your Home
                Screen and open it there first. Then return here to enable
                notifications.
              </p>
            ) : !supported ? (
              <p className="muted mt-3">
                This browser doesn’t support push notifications. Try an
                installed Home Screen app or a supported browser.
              </p>
            ) : checking ? (
              <p role="status" className="muted mt-3">
                Checking this device…
              </p>
            ) : permission === "denied" ? (
              <p className="muted mt-3">
                Notifications are blocked. Allow them in your browser or device
                notification settings, then reopen this menu.
              </p>
            ) : !config?.enabled ? (
              <p className="muted mt-3">
                Notifications are being set up. Home Screen installation is
                available now.
              </p>
            ) : (
              <>
                <p role="status" className="muted mt-3">
                  {enabled ? "Enabled on this device" : "Off on this device"}
                </p>
                <button
                  type="button"
                  className="btn-secondary mt-3 w-full"
                  disabled={busy}
                  onClick={
                    enabled
                      ? async () => {
                          setBusy(true);
                          setError("");
                          try {
                            await disableDevicePush();
                            setEnabled(false);
                          } catch (e) {
                            setError(
                              e instanceof Error
                                ? e.message
                                : "Couldn’t disable notifications.",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }
                      : enable
                  }
                >
                  {busy
                    ? "Updating…"
                    : enabled
                      ? "Disable notifications"
                      : "Enable notifications"}
                </button>
              </>
            )}
          </section>
          {user && <ShortcutSetup active={open} />}
          {error && (
            <p role="alert" className="text-sm text-red-800">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
