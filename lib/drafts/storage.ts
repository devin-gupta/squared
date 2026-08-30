import type { TransactionParsed } from "@/types/transaction";
import type { PreparedExpense } from "../transactions/create";
export interface ExpenseDraft {
  id: string;
  text: string;
  image?: { blob: Blob; name: string; type: string };
  parsed?: TransactionParsed;
  receiptUrl?: string | null;
  submission?: PreparedExpense;
  mode: "quick" | "manual";
  updatedAt: number;
}
export function newDraft(): ExpenseDraft {
  return {
    id: crypto.randomUUID(),
    text: "",
    mode: "quick",
    updatedAt: Date.now(),
  };
}
export function draftKey(userId: string, tripId: string) {
  return `account:${userId}:trip:${tripId}`;
}
let connection: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (!connection)
    connection = new Promise((resolve, reject) => {
      const req = indexedDB.open("squared-expense-drafts", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("drafts");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        connection = undefined;
        reject(req.error);
      };
      req.onblocked = () => {
        connection = undefined;
        reject(new Error("Draft storage is blocked by another tab."));
      };
    });
  return connection;
}
export async function readDraft(
  key: string,
): Promise<ExpenseDraft | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction("drafts").objectStore("drafts").get(key);
    req.onsuccess = () => {
      try {
        const value = req.result;
        if (value?.image?.bytes) {
          value.image = {
            blob: new Blob([value.image.bytes], { type: value.image.type }),
            name: value.image.name,
            type: value.image.type,
          };
        }
        resolve(value);
      } catch (error) {
        reject(error);
      }
    };
    req.onerror = () => reject(req.error);
  });
}
export async function writeDraft(
  key: string,
  draft: ExpenseDraft,
): Promise<void> {
  const db = await database();
  // WebKit can reject Blob/File persistence in private browser contexts.
  // Store the image bytes instead; restore a Blob only when reading the draft.
  const stored = draft.image
    ? {
        ...draft,
        image: {
          bytes: await draft.image.blob.arrayBuffer(),
          name: draft.image.name,
          type: draft.image.type,
        },
      }
    : draft;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").put(stored, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new Error("Draft write was interrupted"));
  });
}
export async function removeDraft(key: string): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
