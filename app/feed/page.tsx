'use client'

import { useState, useEffect } from 'react'
import LiveFeed from '@/components/LiveFeed'

export default function FeedPage() {
  const [tripId, setTripId] = useState<string | null>(null)

  useEffect(() => {
    const storedTripId = localStorage.getItem('tripId')
    if (storedTripId) {
      setTripId(storedTripId)
    }
  }, [])

  return (
    <div className="pb-16">
      <LiveFeed tripId={tripId} />
    </div>
  )
}
