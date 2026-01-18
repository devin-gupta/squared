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
  onDelete?: () => void
  isCreator?: boolean
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
  isCreator = false,
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
            <h1 className="text-2xl md:text-4xl font-serif font-light text-accent break-words">{trip.name}</h1>
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
          {isCreator && onDelete && (
            <motion.button
              onClick={onDelete}
              className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-red-600"
              aria-label="Delete trip"
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(220, 38, 38, 0.1)' }}
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
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
