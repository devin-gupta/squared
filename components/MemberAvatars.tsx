'use client'

import { motion } from 'framer-motion'

interface MemberAvatarsProps {
  members: Array<{ id: string; display_name: string }>
  maxVisible?: number
  onClick?: () => void
}

export default function MemberAvatars({ members, maxVisible = 3, onClick }: MemberAvatarsProps) {
  const visibleMembers = members.slice(0, maxVisible)
  const remainingCount = members.length - maxVisible

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="flex items-center gap-2" onClick={onClick}>
      {visibleMembers.map((member, index) => (
        <motion.div
          key={member.id}
          className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent border border-accent/10"
          style={{ marginLeft: index > 0 ? '-8px' : '0' }}
          whileHover={{ scale: 1.05, borderColor: 'rgba(45, 48, 46, 0.3)' }}
          transition={{ duration: 0.15 }}
        >
          {getInitials(member.display_name)}
        </motion.div>
      ))}
      {remainingCount > 0 && (
        <motion.div
          className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-medium text-accent border border-accent/10"
          style={{ marginLeft: '-8px' }}
          whileHover={{ scale: 1.05, borderColor: 'rgba(45, 48, 46, 0.3)' }}
          transition={{ duration: 0.15 }}
        >
          +{remainingCount}
        </motion.div>
      )}
    </div>
  )
}
