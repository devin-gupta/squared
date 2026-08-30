/* Web Push extension imported by the existing generated service worker. */
function pushOwner() {
  return new Promise((resolve) => {
    const request = indexedDB.open("squared-push-settings", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("settings");
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("settings");
      const value = tx.objectStore("settings").get("owner");
      value.onsuccess = () => resolve(value.result || null);
      value.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    };
  });
}
function pushTripUrl(tripId) {
  const valid =
    typeof tripId === "string" &&
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(tripId);
  return new URL(
    valid ? "/?trip=" + encodeURIComponent(tripId) : "/",
    self.location.origin,
  ).href;
}
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data;
      try {
        data = event.data.json();
      } catch {
        return;
      }
      const owner = await pushOwner();
      // A queued message must not reveal a previous account's trip on a shared phone.
      if (!owner || owner.userId !== data.recipientId) return;
      await self.registration.showNotification("Squared", {
        body:
          typeof data.body === "string"
            ? data.body.slice(0, 240)
            : "A new expense was added to one of your trips.",
        icon: "/brand/icon-192-v2.png",
        badge: "/brand/icon-192-v2.png",
        tag:
          "squared-expense-" +
          String(data.changeId || data.tripId).slice(0, 80),
        renotify: false,
        data: { tripId: data.tripId, recipientId: data.recipientId },
      });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const owner = await pushOwner();
      const data = event.notification.data || {};
      const url = pushTripUrl(
        owner?.userId === data.recipientId ? data.tripId : null,
      );
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        const navigated = await existing.navigate(url);
        await (navigated || existing).focus();
      } else await self.clients.openWindow(url);
    })(),
  );
});
