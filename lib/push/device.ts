// Shared with push-worker.js. This marker prevents notifications for a previous
// account from appearing after sign-out or switching accounts on a shared device.
export interface PushOwner {
  userId: string;
  endpoint: string;
}
function deviceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("squared-push-settings", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("settings");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readPushOwner(): Promise<PushOwner | null> {
  const db = await deviceDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings");
    const request = tx.objectStore("settings").get("owner");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
export async function writePushOwner(owner: PushOwner | null): Promise<void> {
  const db = await deviceDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings", "readwrite");
    if (owner) tx.objectStore("settings").put(owner, "owner");
    else tx.objectStore("settings").delete("owner");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Couldn’t update notification settings."));
    };
  });
}
