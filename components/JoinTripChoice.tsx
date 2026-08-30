"use client";
import { useState } from "react";
import type { InviteContext } from "@/lib/trips/join";

export default function JoinTripChoice({
  context,
  defaultName,
  onJoin,
  onLeave,
}: {
  context: InviteContext;
  defaultName: string;
  onJoin: (memberId: string | null, name: string) => Promise<void>;
  onLeave: () => void;
}) {
  const [selection, setSelection] = useState(
    context.members.length ? "" : "new",
  );
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="panel mx-auto max-w-lg p-6 sm:p-8">
      <p className="eyebrow mb-3">You’re invited</p>
      <h1 className="page-title">Join {context.tripName}</h1>
      <p className="muted mt-4">
        Which person are you? Choosing your name connects you to expenses
        already added for you.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !selection) return;
          setBusy(true);
          setError("");
          try {
            await onJoin(selection === "new" ? null : selection, name);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Couldn’t join. Try again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="space-y-2">
          <legend className="sr-only">Choose your name</legend>
          {context.members.map((member) => (
            <label
              key={member.id}
              className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-[#e1e5dc] p-4"
            >
              <input
                type="radio"
                name="join-person"
                value={member.id}
                checked={selection === member.id}
                onChange={() => setSelection(member.id)}
              />
              <span>{member.name}</span>
            </label>
          ))}
          <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-[#e1e5dc] p-4">
            <input
              type="radio"
              name="join-person"
              value="new"
              checked={selection === "new"}
              onChange={() => setSelection("new")}
            />
            <span>Add myself as someone new</span>
          </label>
          {selection === "new" && (
            <div className="pt-3">
              <label
                htmlFor="join-name"
                className="mb-2 block text-sm font-medium"
              >
                Your name
              </label>
              <input
                id="join-name"
                maxLength={80}
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full"
              />
            </div>
          )}
        </fieldset>
        <p className="muted text-xs">
          Choose only your own name. Names already connected to an account
          aren’t available.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-800">
            {error}
          </p>
        )}
        <button
          className="btn-primary w-full"
          disabled={busy || !selection || (selection === "new" && !name.trim())}
        >
          {busy ? "Joining…" : `Join ${context.tripName}`}
        </button>
        <button
          type="button"
          className="btn-secondary w-full"
          disabled={busy}
          onClick={onLeave}
        >
          Not your trip?
        </button>
      </form>
    </section>
  );
}
