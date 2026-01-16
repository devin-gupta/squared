'use client'

import { motion } from 'framer-motion'
import MemberAvatars from './MemberAvatars'
import TripSelector from './TripSelector'

interface Trip {
  id: string
  name: string
  invite_code: string
  created_by: string
}

interface TripHeaderProps {
  trip: Trip | null
  members: Array<{ id: string; display_name: string }>
  trips: Trip[]
  onShare: () => void
  onSwitchTrip: (tripId: string) => void
  onCreateTrip: () => void
  onViewMembers: () => void
}

export default function TripHeader({
  trip,
  members,
  trips,
  onShare,
  onSwitchTrip,
  onCreateTrip,
  onViewMembers,
}: TripHeaderProps) {
  if (!trip) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-6 pt-6 pb-4"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-4xl font-serif font-light text-accent">{trip.name}</h1>
            {trips.length > 1 && (
              <TripSelector
                trips={trips}
                currentTripId={trip.id}
                onSelectTrip={onSwitchTrip}
                onCreateNew={onCreateTrip}
              />
            )}
          </div>
          <p className="text-sm text-accent/60">Created by {trip.created_by}</p>
        </div>
        <div className="flex items-center gap-3">
          <MemberAvatars members={members} onClick={onViewMembers} />
          <motion.button
            onClick={onShare}
            className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent"
            aria-label="Share trip"
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(45, 48, 46, 0.2)' }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l10.5-5.25M10.5 19.5l-3.283-1.637m0 0a2.25 2.25 0 01-1.07-1.916V8.25m1.07 9.597a2.25 2.25 0 001.07 1.916l3.283 1.637M18.75 4.5l-3.283 1.637m0 0a2.25 2.25 0 00-1.07 1.916v8.25m1.07-10.113a2.25 2.25 0 011.07-1.916l3.283-1.637M10.5 4.5l3.283 1.637m0 0a2.25 2.25 0 011.07 1.916V19.5m-4.353-9.597a2.25 2.25 0 000 2.186m0-2.186v9.597m0 0a2.25 2.25 0 002.186 0m-2.186 0l3.283 1.637"
              />
            </svg>
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
