'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions'
import TransactionCard from './TransactionCard'
import TransactionEditForm from './TransactionEditForm'
import { Transaction } from '@/types/transaction'
import { supabase } from '@/lib/supabase/client'

interface LiveFeedProps {
  tripId: string | null
}

export default function LiveFeed({ tripId }: LiveFeedProps) {
  const { transactions, loading } = useRealtimeTransactions(tripId)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [memberNames, setMemberNames] = useState<{ id: string; name: string }[]>([])

  // Load member names for editing
  useEffect(() => {
    if (tripId) {
      supabase
        .from('trip_members')
        .select('id, display_name')
        .eq('trip_id', tripId)
        .then(({ data }) => {
          if (data) {
            setMemberNames(data.map((m) => ({ id: m.id, name: m.display_name })))
          }
        })
    }
  }, [tripId])

  const handleEdit = async (data: Partial<Transaction>) => {
    if (!editingTransaction) return

    try {
      const response = await fetch(`/api/transactions/${editingTransaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to update transaction')
      }

      setEditingTransaction(null)
    } catch (error) {
      console.error('Error updating transaction:', error)
      alert('Failed to update transaction')
    }
  }

  const handleDelete = async (transactionId: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) {
      return
    }

    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete transaction')
      }
    } catch (error) {
      console.error('Error deleting transaction:', error)
      alert('Failed to delete transaction')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-success border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-2xl font-serif text-accent/40 mb-2">No transactions yet</div>
          <div className="text-sm text-accent/60">Add your first expense to get started</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen px-6 py-8">
        <h1 className="text-3xl font-serif font-bold text-accent mb-8">Ledger</h1>
        <div className="space-y-2">
          {transactions.map((transaction) => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction as any}
              onEdit={() => setEditingTransaction(transaction)}
              onDelete={() => handleDelete(transaction.id)}
              canEdit={true}
            />
          ))}
        </div>
      </div>

      {editingTransaction && memberNames.length > 0 && (
        <TransactionEditForm
          transaction={editingTransaction as any}
          memberNames={memberNames}
          onSubmit={handleEdit}
          onCancel={() => setEditingTransaction(null)}
        />
      )}
    </>
  )
}
