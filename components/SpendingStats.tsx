'use client'

import { useEffect, useState } from 'react'
import StatCard from './StatCard'

interface SpendingStatsProps {
  tripId: string | null
  currentUserName?: string
}

interface Statistics {
  totalSpent: number
  transactionCount: number
  averagePerTransaction: number
  userSpending: number
  categoryBreakdown: Array<{ category: string; amount: number; percentage: number }>
}

export default function SpendingStats({ tripId, currentUserName }: SpendingStatsProps) {
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tripId) {
      setLoading(false)
      return
    }

    const fetchStats = async () => {
      try {
        const url = `/api/trips/${tripId}/statistics${currentUserName ? `?userName=${encodeURIComponent(currentUserName)}` : ''}`
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error('Failed to fetch statistics')
        }
        const { statistics } = await response.json()
        setStats(statistics)
      } catch (error) {
        console.error('Error fetching statistics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [tripId, currentUserName])

  if (loading) {
    return (
      <div className="px-6 py-4">
        <div className="w-6 h-6 border-2 border-success border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="px-6 py-6">
      <h2 className="text-2xl font-serif font-bold text-accent mb-6">Statistics</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard label="Total Spent" value={stats.totalSpent} isCurrency />
        <StatCard label="Transactions" value={stats.transactionCount} />
        <StatCard label="Average" value={stats.averagePerTransaction} isCurrency />
        {currentUserName && (
          <StatCard label="You Paid" value={stats.userSpending} isCurrency />
        )}
      </div>
    </div>
  )
}
