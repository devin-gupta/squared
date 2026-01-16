'use client'

import { motion } from 'framer-motion'

interface MemberCardProps {
  member: {
    id: string
    display_name: string
  }
  onRemove?: () => void
  canRemove?: boolean
}

export default function MemberCard({ member, onRemove, canRemove = false }: MemberCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-accent/10 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-sm font-medium text-accent">
          {getInitials(member.display_name)}
        </div>
        <div>
          <div className="font-medium text-accent">{member.display_name}</div>
        </div>
      </div>
      {canRemove && onRemove && (
        <button
          onClick={onRemove}
          className="text-sm text-red-600 hover:text-red-700 px-3 py-1"
        >
          Remove
        </button>
      )}
    </div>
  )
}
