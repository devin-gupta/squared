"use client";

import { useState } from "react";
import Link from "next/link";
import MemberAvatars from "./MemberAvatars";
import Icon from "./Icon";
import Modal from "./Modal";
import { money } from "./TransactionCard";

interface Trip {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
}
export interface TripHeaderProps {
  trip: Trip | null;
  members: Array<{ id: string; display_name: string }>;
  trips: Trip[];
  onShare: () => void;
  onSwitchTrip: (tripId: string) => void;
  onCreateTrip: () => void;
  onViewMembers: () => void;
  onDelete?: () => void;
  isCreator?: boolean;
  mobileSummary?: { total: number | null; balance: number | null };
  basePath?: string;
}

export default function TripHeader({
  trip,
  members,
  trips,
  onShare,
  onSwitchTrip,
  onCreateTrip,
  onViewMembers,
  onDelete,
  isCreator,
  mobileSummary,
  basePath = "",
}: TripHeaderProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  if (!trip) return null;
  const balance =
    mobileSummary?.balance == null
      ? null
      : Math.round(mobileSummary.balance * 100) / 100;
  return (
    <header className="mb-6 border-b border-[#e1e5dc] pb-5 lg:mb-8 lg:pb-6">
      <div className="flex items-start justify-between gap-4 lg:items-center lg:gap-8">
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1">Your trips</p>
          <h1 className="font-serif text-[1.7rem] leading-[1.1] tracking-tight lg:text-4xl">
            <button
              onClick={() => setPickerOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg text-left hover:text-[#557344]"
            >
              <span className="min-w-0 break-words">{trip.name}</span>
              <Icon name="chevron" width="18" className="shrink-0" />
            </button>
          </h1>
        </div>
        {mobileSummary && (
          <div
            role="group"
            aria-label="Trip spending summary"
            className="w-[112px] shrink-0 border-l border-[#dce3d5] pl-3 lg:hidden"
          >
            <Link href={`${basePath}/feed`} className="block min-h-11 pb-1">
              <span className="block text-[10px] font-medium text-[#5e6b5f]">
                Trip total
              </span>
              <span className="block break-words text-lg font-semibold leading-snug tracking-tight tabular-nums">
                {mobileSummary.total == null ? "—" : money(mobileSummary.total)}
              </span>
            </Link>
            <Link href={`${basePath}/settle`} className="block min-h-11 pt-1">
              <span className="block text-[10px] font-medium text-[#5e6b5f]">
                {balance == null
                  ? "Your balance"
                  : balance > 0
                    ? "You’re owed"
                    : balance < 0
                      ? "You owe"
                      : "All square"}
              </span>
              <span
                className={`block break-words text-lg font-semibold leading-snug tracking-tight tabular-nums ${balance != null && balance < 0 ? "text-[#8b5149]" : "text-[#426536]"}`}
              >
                {balance == null ? "—" : money(Math.abs(balance))}
              </span>
            </Link>
          </div>
        )}
        <div className="hidden items-center gap-4 lg:flex">
          <MemberAvatars members={members} onClick={onViewMembers} />
          <button onClick={onShare} className="btn-secondary">
            <Icon name="people" width="17" />
            Invite friends
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 lg:hidden">
        <MemberAvatars members={members} onClick={onViewMembers} />
        <button
          onClick={onShare}
          className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-medium hover:bg-[#edf1e9]"
        >
          <Icon name="people" width="16" />
          Invite friends
        </button>
      </div>
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Your trips"
        description="Pick up where you left off, or plan something new."
      >
        <div className="space-y-2">
          {trips.map((item) => (
            <button
              key={item.id}
              aria-pressed={item.id === trip.id}
              onClick={() => {
                setPickerOpen(false);
                if (item.id !== trip.id) onSwitchTrip(item.id);
              }}
              className={`flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border p-4 text-left text-sm font-medium ${item.id === trip.id ? "border-[#c8d5be] bg-[#edf2e5]" : "border-[#e1e5dc] hover:bg-[#f7f9f3]"}`}
            >
              <span className="min-w-0 break-words">{item.name}</span>
              <Icon
                name={item.id === trip.id ? "check" : "arrow"}
                width="18"
                className="shrink-0"
              />
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setPickerOpen(false);
            onCreateTrip();
          }}
          className="btn-primary mt-5 w-full"
        >
          <Icon name="plus" width="17" />
          New trip
        </button>
        {isCreator && onDelete && (
          <button
            onClick={() => {
              setPickerOpen(false);
              onDelete();
            }}
            className="mt-3 min-h-11 w-full text-xs text-[#8b5149] underline underline-offset-4"
          >
            Delete this trip
          </button>
        )}
      </Modal>
    </header>
  );
}
