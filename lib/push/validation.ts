export function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (!url.port || url.port === "443") &&
      url.pathname.length > 1 &&
      (host === "fcm.googleapis.com" ||
        host === "updates.push.services.mozilla.com" ||
        host.endsWith(".push.apple.com") ||
        host.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
export function validPushSubscription(value: any): boolean {
  return (
    validPushEndpoint(value?.endpoint) &&
    typeof value?.keys?.p256dh === "string" &&
    /^[A-Za-z0-9_-]{87}$/.test(value.keys.p256dh) &&
    typeof value?.keys?.auth === "string" &&
    /^[A-Za-z0-9_-]{22}$/.test(value.keys.auth)
  );
}
