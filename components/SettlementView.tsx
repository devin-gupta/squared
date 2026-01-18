'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import SpendingStats from './SpendingStats'
import CategoryPieChart from './CategoryPieChart'

interface SettlementViewProps {
  tripId: string | null
  currentUserName?: string
}

interface Settlement {
  from: string
  fromId?: string
  to: string
  toId?: string
  amount: number
}

export default function SettlementView({ tripId, currentUserName }: SettlementViewProps) {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [memberNames, setMemberNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [categoryData, setCategoryData] = useState<Array<{ category: string; amount: number; percentage: number }>>([])

  useEffect(() => {
    if (!tripId) {
      setLoading(false)
      return
    }

    const computeSettlement = async () => {
      try {
        const [settlementResponse, statsResponse] = await Promise.all([
          fetch(`/api/settlement?tripId=${tripId}`),
          fetch(`/api/trips/${tripId}/statistics${currentUserName ? `?userName=${encodeURIComponent(currentUserName)}` : ''}`)
        ])

        if (!settlementResponse.ok) {
          throw new Error('Failed to compute settlement')
        }

        const { settlements } = await settlementResponse.json()
        setSettlements(settlements)

        // Build member map for display
        const memberMap = new Map<string, string>()
        settlements.forEach((s: any) => {
          if (s.fromId) memberMap.set(s.fromId, s.from)
          if (s.toId) memberMap.set(s.toId, s.to)
        })
        setMemberNames(memberMap)

        // Load category data for chart
        if (statsResponse.ok) {
          const { statistics } = await statsResponse.json()
          if (statistics?.categoryBreakdown) {
            setCategoryData(statistics.categoryBreakdown)
          }
        }
      } catch (error) {
        console.error('Error computing settlement:', error)
      } finally {
        setLoading(false)
      }
    }

    computeSettlement()
  }, [tripId, currentUserName])

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-success border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base">
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-accent mb-8">Balance</h1>
      </div>

      {settlements.length === 0 && (
        <div className="flex items-center justify-center py-12 px-6">
          <div className="text-center">
            <div className="text-2xl font-serif text-accent/50 mb-2">All settled</div>
            <div className="text-sm text-accent/60">No payments needed</div>
          </div>
        </div>
      )}

      {settlements.length > 0 && (
        <>
          <SpendingStats tripId={tripId} currentUserName={currentUserName} />

          {categoryData.length > 0 && (
            <CategoryPieChart data={categoryData} />
          )}

          <div className="px-6 py-6">
            <h2 className="text-xl md:text-2xl font-serif font-bold text-accent mb-6">Settlements</h2>
            <div className="space-y-3">
              {settlements.map((settlement, idx) => (
                <motion.div
                  key={`${settlement.from}-${settlement.to}-${idx}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1, duration: 0.15 }}
                  className="px-5 py-4 bg-accent/8 border border-accent/15 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                  whileHover={{ scale: 1.01, backgroundColor: 'rgba(45, 48, 46, 0.12)' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold text-accent font-sans">
                        {settlement.from} → {settlement.to}
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-accent font-sans">
                      {formatAmount(settlement.amount)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
