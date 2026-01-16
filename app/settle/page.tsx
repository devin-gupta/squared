'use client'

import { useState, useEffect } from 'react'
import SettlementView from '@/components/SettlementView'

export default function SettlePage() {
  const [tripId, setTripId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)

  useEffect(() => {
    const storedTripId = localStorage.getItem('tripId')
    const storedUser = localStorage.getItem('currentUser')
    if (storedTripId) {
      setTripId(storedTripId)
    }
    if (storedUser) {
      setCurrentUser(storedUser)
    }
  }, [])

  return (
    <div className="pb-16">
      <SettlementView tripId={tripId} currentUserName={currentUser || undefined} />
    </div>
  )
}
