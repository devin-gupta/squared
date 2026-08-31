let pending: Promise<ServiceWorkerRegistration> | null = null;

// next-pwa 5 injects its registration into the Pages Router entry. App Router
// pages must register the same generated worker themselves.
export function ensureBackgroundWorker(): Promise<ServiceWorkerRegistration> {
  if (pending) return pending;
  let timer: ReturnType<typeof setTimeout>;
  pending = Promise.race([
    (async () => {
      await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      return navigator.serviceWorker.ready;
    })(),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Worker activation timed out")),
        20000,
      );
    }),
  ])
    .catch(() => {
      throw new Error(
        "Squared couldn’t start notifications. Check your connection and tap Enable notifications again.",
      );
    })
    .finally(() => {
      clearTimeout(timer);
      pending = null;
    });
  return pending;
}
