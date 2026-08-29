"use client";

import MemberCard from "./MemberCard";
import Modal from "./Modal";

export default function MemberListModal({
  isOpen,
  onClose,
  members,
  onRemoveMember,
  canRemove = true,
}: {
  isOpen: boolean;
  onClose: () => void;
  members: Array<{ id: string; display_name: string }>;
  onRemoveMember: (id: string) => void;
  canRemove?: boolean;
}) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="The whole crew."
      description={`${members.length} ${members.length === 1 ? "person" : "people"}, one shared trip.`}
    >
      <div className="space-y-2">
        {members.length ? (
          members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              canRemove={canRemove && members.length > 1}
              onRemove={() => {
                if (confirm(`Remove ${member.display_name} from this trip?`))
                  onRemoveMember(member.id);
              }}
            />
          ))
        ) : (
          <p className="muted py-6 text-center">
            No members yet. Invite someone along.
          </p>
        )}
      </div>
    </Modal>
  );
}
