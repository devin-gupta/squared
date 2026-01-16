'use client'

import { motion, AnimatePresence } from 'framer-motion'
import MemberCard from './MemberCard'

interface Member {
  id: string
  display_name: string
}

interface MemberListModalProps {
  isOpen: boolean
  onClose: () => void
  members: Member[]
  onRemoveMember: (memberId: string) => void
  canRemove?: boolean
}

export default function MemberListModal({
  isOpen,
  onClose,
  members,
  onRemoveMember,
  canRemove = true,
}: MemberListModalProps) {
  const handleRemove = (memberId: string) => {
    if (confirm('Are you sure you want to remove this member?')) {
      onRemoveMember(memberId)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-accent/20 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-base rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
              <div className="p-6 border-b border-accent/10">
                <h2 className="text-2xl font-serif font-bold text-accent">Trip Members</h2>
                <p className="text-sm text-accent/60 mt-1">{members.length} member{members.length !== 1 ? 's' : ''}</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {members.length === 0 ? (
                  <div className="text-center text-accent/60 py-8">
                    No members yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => (
                      <MemberCard
                        key={member.id}
                        member={member}
                        onRemove={() => handleRemove(member.id)}
                        canRemove={canRemove && members.length > 1}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-accent/10">
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-accent text-base rounded-full font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
