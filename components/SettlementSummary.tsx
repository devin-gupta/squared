"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Icon from "./Icon";
import Modal from "./Modal";
import { money } from "./TransactionCard";
import {
  Settlement,
  SettlementMember,
  involvesMember,
  settlementTotals,
} from "@/lib/settlement/transfers";
import { normalizeVenmoUsername, venmoLinks } from "@/lib/payments/venmo";
export type { Settlement } from "@/lib/settlement/transfers";

type VenmoAction = {
  person: SettlementMember;
  direction: "pay" | "charge";
  amount: number;
};

export default function SettlementSummary({
  settlements,
  loading,
  error,
  hasTrip = true,
  basePath = "",
  currentMember,
  tripId,
  tripName,
  statistics,
}: {
  settlements: Settlement[];
  loading?: boolean;
  error?: string | null;
  hasTrip?: boolean;
  basePath?: string;
  currentMember?: SettlementMember | null;
  tripId?: string | null;
  tripName?: string;
  statistics?: ReactNode;
}) {
  const storageKey = `squared:venmo:${basePath || "app"}:${tripId || "trip"}`;
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [editingPerson, setEditingPerson] = useState<SettlementMember | null>(
    null,
  );
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [storageNote, setStorageNote] = useState("");
  const [lastAction, setLastAction] = useState<VenmoAction | null>(null);
  const [copied, setCopied] = useState(false);
  const totals = currentMember
    ? settlementTotals(settlements, currentMember)
    : null;
  const note = tripName ? `Squared: ${tripName}` : "Squared trip settlement";
  const showPaymentDetails =
    !loading && !error && hasTrip && settlements.length > 0;
  const hasSidebar = !!statistics || showPaymentDetails;
  useEffect(() => {
    setUsernames({});
    setLastAction(null);
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(storageKey) || "{}",
      );
      if (saved && typeof saved === "object" && !Array.isArray(saved))
        setUsernames(
          Object.fromEntries(
            Object.entries(saved)
              .filter(
                ([, value]) =>
                  typeof value === "string" && normalizeVenmoUsername(value),
              )
              .map(([id, value]) => [
                id,
                normalizeVenmoUsername(String(value))!,
              ]),
          ),
        );
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
  }, [storageKey]);
  const editUsername = (person: SettlementMember) => {
    setEditingPerson(person);
    setUsername(usernames[person.id] || "");
    setUsernameError("");
  };
  const saveUsername = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeVenmoUsername(username);
    if (!normalized || !editingPerson) {
      setUsernameError(
        "Enter a Venmo username using letters, numbers, hyphens, or underscores.",
      );
      return;
    }
    const next = { ...usernames, [editingPerson.id]: normalized };
    setUsernames(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageNote(
        "Username saved on this device. Tap the transfer to open Venmo.",
      );
    } catch {
      setStorageNote(
        "Username is available for this session, but this browser couldn’t save it.",
      );
    }
    setEditingPerson(null);
  };
  const actionFor = (transfer: Settlement): VenmoAction | null => {
    if (!currentMember) return null;
    if (involvesMember(transfer, "from", currentMember))
      return {
        person: {
          id: transfer.toId || `name:${transfer.to}`,
          name: transfer.to,
        },
        direction: "pay",
        amount: transfer.amount,
      };
    if (involvesMember(transfer, "to", currentMember))
      return {
        person: {
          id: transfer.fromId || `name:${transfer.from}`,
          name: transfer.from,
        },
        direction: "charge",
        amount: transfer.amount,
      };
    return null;
  };
  const people = Array.from(
    new Map(
      settlements.flatMap((transfer) => {
        const action = actionFor(transfer);
        return action ? [[action.person.id, action.person] as const] : [];
      }),
    ).values(),
  );
  const content = (transfer: Settlement, action: VenmoAction | null) => (
    <>
      <span className="icon-tile">
        <Icon name="arrow" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {transfer.from}{" "}
          <span className="font-normal text-[#5e6b5f]">pays</span> {transfer.to}
        </span>
        <span className="mt-1 block text-xs text-[#5e6b5f]">
          {action
            ? `${action.direction === "pay" ? "Pay" : "Request"} in Venmo${usernames[action.person.id] ? ` · @${usernames[action.person.id]}` : " · add username"}`
            : "Between other group members"}
        </span>
      </span>
      <span className="shrink-0 text-lg font-semibold tabular-nums">
        {money(transfer.amount)}
      </span>
    </>
  );
  const rowClass =
    "flex w-full items-center gap-3 border-b border-[#edf0e8] p-4 text-left last:border-0 sm:p-5";
  const lastLinks =
    lastAction && usernames[lastAction.person.id]
      ? venmoLinks(
          usernames[lastAction.person.id],
          lastAction.direction,
          lastAction.amount,
          note,
        )
      : null;
  return (
    <>
      <header className="mb-8">
        <p className="eyebrow mb-4">A little balance goes a long way</p>
        <h1 className="page-title">Leave with good memories.</h1>
        <p className="muted mt-3">
          A clear plan for settling your shared expenses.
        </p>
      </header>
      {!loading &&
        !error &&
        hasTrip &&
        (totals ? (
          <section aria-label="Your settlement totals" className="mb-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="panel p-5">
                <p className="text-xs text-[#5e6b5f]">You owe</p>
                <p className="my-3 text-2xl font-semibold tabular-nums">
                  {money(totals.outgoing)}
                </p>
                <p className="text-xs text-[#5e6b5f]">
                  {totals.outgoingCount} outgoing{" "}
                  {totals.outgoingCount === 1 ? "transfer" : "transfers"}
                </p>
              </div>
              <div className="panel p-5">
                <p className="text-xs text-[#5e6b5f]">You’re owed</p>
                <p className="my-3 text-2xl font-semibold tabular-nums">
                  {money(totals.incoming)}
                </p>
                <p className="text-xs text-[#5e6b5f]">
                  {totals.incomingCount} incoming{" "}
                  {totals.incomingCount === 1 ? "transfer" : "transfers"}
                </p>
              </div>
              <div className="col-span-2 rounded-2xl bg-accent p-5 text-white sm:col-span-1">
                <p className="text-xs text-[#d4e1cf]">Net owed</p>
                <p className="my-3 text-2xl font-semibold tabular-nums">
                  {totals.net > 0 ? "+" : totals.net < 0 ? "−" : ""}
                  {money(Math.abs(totals.net))}
                </p>
                <p className="text-xs text-[#d4e1cf]">
                  {totals.net > 0
                    ? "You’ll get this back"
                    : totals.net < 0
                      ? "You still need to pay this"
                      : "You’re all square"}
                </p>
              </div>
            </div>
            <p className="muted mt-3 text-xs">
              {money(totals.incoming)} incoming − {money(totals.outgoing)}{" "}
              outgoing = {totals.net < 0 ? "−" : ""}
              {money(Math.abs(totals.net))} net. Totals sum the transfers
              involving you below.
            </p>
          </section>
        ) : (
          <p className="panel mb-6 p-4 text-sm text-[#5e6b5f]">
            Your trip membership couldn’t be identified. Personal totals and
            Venmo actions are unavailable.
          </p>
        ))}
      {storageNote && (
        <p role="status" className="panel mb-4 p-4 text-xs">
          {storageNote}
        </p>
      )}
      {lastAction && lastLinks && (
        <div className="panel mb-6 p-4 text-sm">
          <p>
            Confirm{" "}
            <strong>
              {lastAction.direction === "pay" ? "payment to" : "request from"} @
              {usernames[lastAction.person.id]}
            </strong>{" "}
            for <strong>{money(lastAction.amount)}</strong> inside Venmo.
          </p>
          <p className="muted mt-2 text-xs">
            If Venmo didn’t open or prefill the details, use the profile link or
            copy the details. Opening Venmo does not mark this transfer as paid.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a
              href={lastLinks.profile}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Open Venmo profile
            </a>
            <button
              className="btn-secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${lastAction.direction === "pay" ? "Pay" : "Request from"} @${usernames[lastAction.person.id]}: ${money(lastAction.amount)} — ${note}`,
                  );
                  setCopied(true);
                } catch {
                  setStorageNote(
                    "Copying isn’t available in this browser. The username and amount are shown above.",
                  );
                }
              }}
            >
              {copied ? "Copied" : "Copy details"}
            </button>
          </div>
        </div>
      )}
      <div
        className={
          hasSidebar
            ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
            : ""
        }
      >
        <div className="min-w-0">
          {loading ? (
            <div role="status" className="empty-state muted">
              Working out the balances…
            </div>
          ) : error ? (
            <div role="alert" className="empty-state">
              <h2 className="font-semibold">We couldn’t load your balances.</h2>
              <p className="muted">{error}</p>
              <Link href={basePath || "/"} className="btn-secondary">
                Back to overview
              </Link>
            </div>
          ) : !hasTrip ? (
            <div className="empty-state">
              <span className="icon-tile">
                <Icon name="travel" />
              </span>
              <h2 className="font-serif text-2xl">First, a trip to share.</h2>
              <p className="muted">
                Choose or create a trip to see its balances.
              </p>
              <Link className="btn-primary" href={basePath || "/"}>
                Go to overview
              </Link>
            </div>
          ) : !settlements.length ? (
            <div className="empty-state">
              <span className="icon-tile">
                <Icon name="check" />
              </span>
              <h2 className="font-serif text-3xl">All square.</h2>
              <p className="muted">No payments needed right now.</p>
              <Link className="btn-secondary mt-2" href={basePath || "/"}>
                Back to the trip
              </Link>
            </div>
          ) : (
            <section className="panel overflow-hidden">
              <div className="border-b border-[#e1e5dc] p-5">
                <h2 className="font-semibold">Suggested payments</h2>
                <p className="muted mt-1 text-xs">
                  Tap your transfers to pay or request in Venmo. Other members’
                  transfers are shown for context.
                </p>
              </div>
              {settlements.map((transfer, index) => {
                const action = actionFor(transfer);
                const key = `${transfer.fromId || transfer.from}-${transfer.toId || transfer.to}-${index}`;
                if (!action)
                  return (
                    <div key={key} className={rowClass}>
                      {content(transfer, null)}
                    </div>
                  );
                if (!usernames[action.person.id])
                  return (
                    <button
                      key={key}
                      onClick={() => editUsername(action.person)}
                      className={`${rowClass} transition-colors hover:bg-[#f5f8ef]`}
                    >
                      {content(transfer, action)}
                    </button>
                  );
                const links = venmoLinks(
                  usernames[action.person.id],
                  action.direction,
                  action.amount,
                  note,
                );
                return (
                  <a
                    key={key}
                    href={links.app}
                    onClick={() => {
                      setLastAction(action);
                      setCopied(false);
                    }}
                    className={`${rowClass} transition-colors hover:bg-[#f5f8ef]`}
                  >
                    {content(transfer, action)}
                  </a>
                );
              })}
            </section>
          )}
        </div>
        {hasSidebar && (
          <aside className="min-w-0 space-y-6" aria-label="Trip details">
            {statistics}
            {showPaymentDetails && (
              <>
                <section className="panel p-5">
                  <h2 className="font-semibold">Venmo usernames</h2>
                  <p className="muted mt-2 text-xs">
                    Saved only on this device. Confirm each username with your
                    friend before paying.
                  </p>
                  <div className="mt-3 divide-y divide-[#edf0e8]">
                    {people.map((person) => (
                      <button
                        key={person.id}
                        onClick={() => editUsername(person)}
                        className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left"
                      >
                        <span className="min-w-0 text-sm">
                          <span className="block">{person.name}</span>
                          <span className="block break-all text-xs text-[#5e6b5f]">
                            {usernames[person.id]
                              ? `@${usernames[person.id]}`
                              : "Not added yet"}
                          </span>
                        </span>
                        <span className="text-xs underline">
                          {usernames[person.id] ? "Edit" : "Add"}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="rounded-2xl bg-[#eaf0df] p-6">
                  <Icon name="balance" className="mb-4 text-[#6c8452]" />
                  <h2 className="font-serif text-2xl">Confirm in Venmo.</h2>
                  <p className="muted mt-3 text-xs">
                    These links open a payment or request; they don’t send money
                    automatically. Verify the recipient and amount. Squared
                    can’t confirm completed payments, so totals won’t change
                    just because you opened Venmo.
                  </p>
                </section>
              </>
            )}
          </aside>
        )}
      </div>
      {!loading && !error && hasTrip && tripId && (
        <section className="panel mt-8 p-6">
          <h2 className="font-serif text-2xl">Same crew. New plans.</h2>
          <p className="muted mt-2 text-sm">
            Start another trip with these names already added. Expenses and
            balances stay with this trip.
          </p>
          <Link
            className="btn-primary mt-4"
            href={`/?newTripFrom=${encodeURIComponent(tripId)}`}
          >
            Start another trip with this group
          </Link>
        </section>
      )}
      {editingPerson && (
        <Modal
          open
          onClose={() => setEditingPerson(null)}
          title={`${editingPerson.name}’s Venmo`}
          description="Save their username, then tap the suggested transfer to open Venmo."
        >
          <form onSubmit={saveUsername} className="space-y-4">
            <label
              htmlFor="venmo-username"
              className="block text-sm font-medium"
            >
              Venmo username
            </label>
            <input
              id="venmo-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              required
              autoFocus
              className="w-full"
            />
            <p className="muted text-xs">
              Ask your friend for their exact username. Squared doesn’t verify
              Venmo account ownership.
            </p>
            {usernameError && (
              <p role="alert" className="text-sm text-red-800">
                {usernameError}
              </p>
            )}
            <button className="btn-primary w-full" type="submit">
              Save username
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
