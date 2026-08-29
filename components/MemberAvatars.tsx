"use client";

export const avatarColors = ["#e4ecd6", "#f1dfcf", "#dce7ed", "#e9dff0"];
export default function MemberAvatars({
  members,
  maxVisible = 3,
  onClick,
}: {
  members: Array<{ id: string; display_name: string }>;
  maxVisible?: number;
  onClick?: () => void;
}) {
  const avatars = (
    <span className="flex -space-x-2">
      {members.slice(0, maxVisible).map((member, i) => (
        <span
          key={member.id}
          title={member.display_name}
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-base text-[11px] font-semibold"
          style={{ backgroundColor: avatarColors[i % avatarColors.length] }}
        >
          {member.display_name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </span>
      ))}
      {members.length > maxVisible && (
        <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-base bg-[#e9ede5] text-xs">
          +{members.length - maxVisible}
        </span>
      )}
    </span>
  );
  return onClick ? (
    <button
      onClick={onClick}
      aria-label={`View ${members.length} trip members`}
      className="flex min-h-11 items-center"
    >
      {avatars}
    </button>
  ) : (
    avatars
  );
}
