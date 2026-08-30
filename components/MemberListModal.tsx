"use client";

import MemberCard from "./MemberCard";
import Modal from "./Modal";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function MemberListModal({
  isOpen,
  onClose,
  members,
  onRemoveMember,
  onAddNames,
  canRemove = false,
  currentMemberId,
  creatorName,
}: {
  isOpen: boolean;
  onClose: () => void;
  members: Array<{ id: string; display_name: string; user_id?: string | null }>;
  onRemoveMember: (id: string) => Promise<void>;
  onAddNames?: (names: string[]) => Promise<void>;
  canRemove?: boolean;
  currentMemberId?: string;
  creatorName?: string;
}) {
  const [names, setNames] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [selected, setSelected] = useState<{
    id: string;
    display_name: string;
  } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(false);
  const leaving = selected?.id === currentMemberId;
  useEffect(() => {
    if (!isOpen) {
      setSelected(null);
      setError(null);
      setNotice(null);
    }
  }, [isOpen]);
  const confirmRemoval = async () => {
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setRemoving(true);
    setError(null);
    try {
      await onRemoveMember(selected.id);
      setNotice(`${selected.display_name} was removed from the trip.`);
      setSelected(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Couldn’t remove this member. Please try again.",
      );
    } finally {
      inFlight.current = false;
      setRemoving(false);
    }
  };
  return (
    <Modal
      open={isOpen}
      onClose={() => {
        if (!inFlight.current && !adding) onClose();
      }}
      title={
        selected
          ? leaving
            ? "Leave this trip?"
            : `Remove ${selected.display_name}?`
          : "The whole crew."
      }
      description={`${members.length} ${members.length === 1 ? "person" : "people"}, one shared trip.`}
    >
      {selected ? (
        <div>
          <p className="muted">
            {leaving
              ? "You will lose access to this trip."
              : "This person will lose access to the trip."}{" "}
            Expenses won’t be deleted or reassigned. Members with existing
            payments or shares must be reviewed first.
          </p>
          {error && (
            <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
              <p role="alert">{error}</p>
              <Link
                className="mt-2 inline-flex min-h-11 items-center underline"
                href="/feed"
              >
                Review expenses
              </Link>
            </div>
          )}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              className="btn-secondary flex-1"
              disabled={removing}
              onClick={() => {
                setSelected(null);
                setError(null);
              }}
              autoFocus
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary flex-1 !bg-[#a04436]"
              disabled={removing}
              onClick={confirmRemoval}
            >
              {removing
                ? "Removing…"
                : leaving
                  ? "Leave trip"
                  : "Remove member"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {canRemove && onAddNames && (
            <form
              className="mb-5 space-y-3 border-b border-[#e1e5dc] pb-5"
              onSubmit={async (e) => {
                e.preventDefault();
                if (adding) return;
                setAdding(true);
                setAddError("");
                try {
                  await onAddNames(
                    names
                      .split(/[\n,]/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  );
                  setNames("");
                  setNotice(
                    "Names added. Share the same trip link so friends can choose themselves.",
                  );
                } catch (e) {
                  setAddError(
                    e instanceof Error ? e.message : "Couldn’t add names",
                  );
                } finally {
                  setAdding(false);
                }
              }}
            >
              <label
                htmlFor="member-names"
                className="block text-sm font-medium"
              >
                Add friends by name
              </label>
              <textarea
                id="member-names"
                value={names}
                disabled={adding}
                onChange={(e) => setNames(e.target.value)}
                placeholder="Alex, Sam, Priya"
                className="w-full"
              />
              <p className="muted text-xs">
                No email needed. Add up to 50 names, separated by commas or new
                lines.
              </p>
              {addError && (
                <p role="alert" className="text-sm text-red-800">
                  {addError}
                </p>
              )}
              <button
                className="btn-primary"
                disabled={adding || !names.trim()}
              >
                {adding ? "Adding…" : "Add names"}
              </button>
            </form>
          )}
          {notice && (
            <p role="status" className="muted py-2">
              {notice}
            </p>
          )}
          {members.length ? (
            members.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                canRemove={
                  (canRemove || member.id === currentMemberId) &&
                  member.display_name !== creatorName &&
                  members.length > 1
                }
                removeLabel={member.id === currentMemberId ? "Leave" : "Remove"}
                onRemove={() => {
                  setError(null);
                  setNotice(null);
                  setSelected(member);
                }}
              />
            ))
          ) : (
            <p className="muted py-6 text-center">
              No members yet. Invite someone along.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
