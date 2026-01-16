'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Trip {
  id: string
  name: string
  invite_code: string
}

interface TripSelectorProps {
  trips: Trip[]
  currentTripId: string | null
  onSelectTrip: (tripId: string) => void
  onCreateNew: () => void
}

export default function TripSelector({ trips, currentTripId, onSelectTrip, onCreateNew }: TripSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const currentTrip = trips.find((t) => t.id === currentTripId)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-accent/70 hover:text-accent transition-colors"
      >
        <span>{currentTrip?.name || 'Select Trip'}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full mt-2 right-0 bg-base border border-accent/10 rounded-lg shadow-lg z-50 min-w-[200px]"
            >
              <div className="py-2">
                {trips.map((trip) => (
                  <button
                    key={trip.id}
                    onClick={() => {
                      onSelectTrip(trip.id)
                      setIsOpen(false)
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-accent/5 transition-colors ${
                      trip.id === currentTripId ? 'bg-accent/10 font-medium' : ''
                    }`}
                  >
                    {trip.name}
                  </button>
                ))}
                <div className="border-t border-accent/10 my-1" />
                <button
                  onClick={() => {
                    onCreateNew()
                    setIsOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-accent/70 hover:bg-accent/5 transition-colors"
                >
                  + New Trip
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
