"use client";

import { motion } from "framer-motion";

interface MemberCardProps {
  member: {
    id: string;
    display_name: string;
    user_id?: string | null;
  };
  onRemove?: () => void;
  canRemove?: boolean;
  removeLabel?: string;
}

export default function MemberCard({
  member,
  onRemove,
  canRemove = false,
  removeLabel = "Remove",
}: MemberCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-accent/10 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-full bg-accent/20 flex items-center justify-center text-sm font-medium text-accent">
          {getInitials(member.display_name)}
        </div>
        <div className="min-w-0">
          <div className="break-words font-medium text-accent">
            {member.display_name}
          </div>
          {member.user_id !== undefined && (
            <p className="muted text-xs">
              {member.user_id ? "Joined" : "Not joined yet"}
            </p>
          )}
        </div>
      </div>
      {canRemove && onRemove && (
        <button
          onClick={onRemove}
          aria-label={`${removeLabel} ${member.display_name}`}
          className="min-h-11 shrink-0 text-sm text-red-600 hover:text-red-700 px-3 py-1"
        >
          {removeLabel}
        </button>
      )}
    </div>
  );
}
