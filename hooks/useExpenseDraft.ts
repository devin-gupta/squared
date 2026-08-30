"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  draftKey,
  newDraft,
  readDraft,
  writeDraft,
  ExpenseDraft,
} from "@/lib/drafts/storage";
export function useExpenseDraft(
  userId: string | undefined,
  tripId: string | null,
) {
  const key = userId && tripId ? draftKey(userId, tripId) : null;
  const [state, setState] = useState<{
    key: string | null;
    draft: ExpenseDraft | null;
  }>({ key: null, draft: null });
  const [storageStatus, setStatus] = useState<
    "saving" | "saved" | "unavailable"
  >("saved");
  const [offline, setOffline] = useState(false);
  const current = useRef(state);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    current.current = { key: null, draft: null };
    setState(current.current);
    if (!key) return;
    readDraft(key)
      .then((value) => {
        if (cancelled) return;
        current.current = { key, draft: value || newDraft() };
        setState(current.current);
        setStatus("saved");
      })
      .catch(() => {
        if (cancelled) return;
        current.current = { key, draft: newDraft() };
        setState(current.current);
        setStatus("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [key]);
  const update = useCallback(
    (
      patch: Partial<ExpenseDraft> | ((draft: ExpenseDraft) => ExpenseDraft),
    ) => {
      if (!key || current.current.key !== key || !current.current.draft)
        return Promise.reject(new Error("Wait for your draft to load."));
      const draft =
        typeof patch === "function"
          ? patch(current.current.draft)
          : { ...current.current.draft, ...patch, updatedAt: Date.now() };
      const next = { key, draft };
      current.current = next;
      setState(next);
      setStatus("saving");
      const write = queue.current
        .catch(() => {})
        .then(() => writeDraft(key, draft));
      queue.current = write;
      write.then(
        () => {
          if (current.current === next) setStatus("saved");
        },
        () => {
          if (current.current === next) setStatus("unavailable");
        },
      );
      return write;
    },
    [key],
  );
  const clear = useCallback(() => update(() => newDraft()), [update]);
  return {
    draft: state.key === key ? state.draft : null,
    ready: state.key === key && !!state.draft,
    update,
    clear,
    offline,
    storageStatus,
  };
}
