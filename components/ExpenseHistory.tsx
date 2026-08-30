"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { undoExpense } from "@/lib/transactions/history";
import { categoryLabel } from "@/lib/categories";
interface Change {
  id: string;
  expense_id: string;
  actor_id: string;
  actor_name: string;
  command: string;
  sequence: number;
  created_at: string;
  before_state: any;
  after_state: any;
}
export default function ExpenseHistory({
  tripId,
  expenseId,
  onChange,
  refreshKey,
}: {
  tripId: string | null;
  expenseId?: string;
  onChange?: () => void;
  refreshKey?: string | number;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Change[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [revision, setRevision] = useState(0);
  const operations = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!open || !tripId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      let q = (supabase as any)
        .from("expense_changes")
        .select(
          "id,expense_id,actor_id,actor_name,command,sequence,created_at,before_state,after_state",
        )
        .eq("trip_id", tripId)
        .order("sequence", { ascending: false })
        .limit(50);
      if (expenseId) q = q.eq("expense_id", expenseId);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) setError("Couldn’t load history. Try again.");
      else {
        setRows(data || []);
        setUserId(session?.user.id || "");
      }
      setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setLoading(false);
        setError("Couldn’t load history.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, tripId, expenseId, revision, refreshKey]);
  const seen = new Set<string>();
  return (
    <section className="mt-5">
      <button
        type="button"
        className="btn-secondary"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Expense history
      </button>
      {open && (
        <div className="mt-3 space-y-3 rounded-xl border border-[#e1e5dc] p-4">
          <p className="muted text-xs">
            Recent changes, including deleted expenses. You can undo your latest
            change if nobody has changed that expense since. History begins with
            changes made after this feature was enabled.
          </p>
          {loading && <p role="status">Loading history…</p>}
          {error && (
            <p role="alert" className="text-sm text-red-800">
              {error}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setRevision((n) => n + 1)}
              >
                Retry
              </button>
            </p>
          )}
          {!loading && !rows.length && !error && (
            <p className="muted text-sm">No recorded changes yet.</p>
          )}
          {rows.map((row) => {
            const latest = !seen.has(row.expense_id);
            seen.add(row.expense_id);
            const before = row.before_state?.expense,
              after = row.after_state?.expense;
            const detail =
              before && after && before.category !== after.category
                ? `Category: ${categoryLabel(before.category)} → ${categoryLabel(after.category)}`
                : before &&
                    after &&
                    Number(before.total_amount) !== Number(after.total_amount)
                  ? `Amount: $${Number(before.total_amount).toFixed(2)} → $${Number(after.total_amount).toFixed(2)}`
                  : null;
            return (
              <div
                key={row.id}
                className="border-t border-[#e1e5dc] pt-3 text-sm"
              >
                <p>
                  <strong>{row.actor_name}</strong>{" "}
                  {{
                    create: "added",
                    update: "edited",
                    delete: "deleted",
                    undo: "undid a change to",
                  }[row.command] || "changed"}{" "}
                  <strong>
                    {(after || before)?.description || "an expense"}
                  </strong>
                </p>
                {detail && <p className="muted mt-1 text-xs">{detail}</p>}
                <p className="muted mt-1 text-xs">
                  {new Date(row.created_at).toLocaleString()}
                </p>
                {latest &&
                  row.command !== "undo" &&
                  row.actor_id === userId && (
                    <button
                      type="button"
                      className="mt-2 min-h-10 text-sm underline"
                      disabled={!!busy}
                      onClick={async () => {
                        if (!tripId || busy) return;
                        setBusy(row.id);
                        setError("");
                        try {
                          await undoExpense(
                            tripId,
                            row.id,
                            (operations.current[row.id] ||=
                              crypto.randomUUID()),
                          );
                          setRevision((n) => n + 1);
                          onChange?.();
                        } catch (e) {
                          setError(
                            e instanceof Error ? e.message : "Couldn’t undo",
                          );
                        } finally {
                          setBusy("");
                        }
                      }}
                    >
                      {busy === row.id ? "Undoing…" : "Undo this change"}
                    </button>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
