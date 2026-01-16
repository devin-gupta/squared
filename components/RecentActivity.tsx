'use client'

import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions'
import TransactionCard from './TransactionCard'
import { Transaction } from '@/types/transaction'

interface RecentActivityProps {
  tripId: string | null
  limit?: number
  onEdit?: (transaction: Transaction) => void
  onDelete?: (transactionId: string) => void
}

export default function RecentActivity({
  tripId,
  limit = 5,
  onEdit,
  onDelete,
}: RecentActivityProps) {
  const { transactions, loading } = useRealtimeTransactions(tripId)

  const recentTransactions = transactions.slice(0, limit)

  if (loading) {
    return (
      <div className="px-6 py-4">
        <div className="w-6 h-6 border-2 border-success border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    )
  }

  if (recentTransactions.length === 0) {
    return null
  }

  return (
    <div className="px-6 py-4">
      <h2 className="text-xs uppercase tracking-wider text-accent/60 mb-4 font-medium">
        Recent Activity
      </h2>
      <div className="space-y-3">
        {recentTransactions.map((transaction) => (
          <TransactionCard
            key={transaction.id}
            transaction={transaction as any}
            onEdit={() => onEdit?.(transaction)}
            onDelete={() => onDelete?.(transaction.id)}
            canEdit={true}
          />
        ))}
      </div>
    </div>
  )
}
