'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { joinTrip } from '@/lib/trips/join'

export default function JoinTripPage() {
  const router = useRouter()
  const params = useParams()
  const inviteCode = params.id as string
  const [displayName, setDisplayName] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      setError('Please enter your name')
      return
    }

    setIsJoining(true)
    setError(null)

    try {
      const tripId = await joinTrip(inviteCode, displayName.trim())
      localStorage.setItem('tripId', tripId)
      localStorage.setItem('currentUser', displayName.trim())
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join trip')
      setIsJoining(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <h1 className="text-4xl font-serif text-accent mb-8 text-center">
          Join Trip
        </h1>
        
        <form onSubmit={handleJoin} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-accent/70 mb-2">
              Your Name
            </label>
            <input
              id="name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              className="w-full px-4 py-3 bg-transparent border-b-2 border-accent/20 text-accent text-lg focus:outline-none focus:border-accent transition-colors"
              disabled={isJoining}
              autoFocus
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-red-600"
            >
              {error}
            </motion.div>
          )}

          <motion.button
            type="submit"
            disabled={!displayName.trim() || isJoining}
            className="w-full py-3 bg-accent text-base rounded-full font-medium disabled:opacity-30 disabled:cursor-not-allowed"
            whileTap={{ scale: 0.95 }}
          >
            {isJoining ? 'Joining...' : 'Join Trip'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  )
}
