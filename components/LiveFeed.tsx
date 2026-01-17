'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions'
import TransactionCard from './TransactionCard'
import TransactionEditForm from './TransactionEditForm'
import { Transaction, LineItem } from '@/types/transaction'
import { supabase } from '@/lib/supabase/client'

interface TransactionWithPayer extends Transaction {
  payer?: { display_name: string }
}

interface LiveFeedProps {
  tripId: string | null
}

export default function LiveFeed({ tripId }: LiveFeedProps) {
  const { transactions, loading } = useRealtimeTransactions(tripId)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [memberNames, setMemberNames] = useState<{ id: string; name: string }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')

  // Load member names for editing
  useEffect(() => {
    if (tripId) {
      supabase
        .from('trip_members')
        .select('id, display_name')
        .eq('trip_id', tripId)
        .then(({ data }) => {
          if (data && Array.isArray(data)) {
            setMemberNames(
              data.map((m) => ({
                id: (m as { id: string; display_name: string }).id,
                name: (m as { id: string; display_name: string }).display_name,
              }))
            )
          }
        })
    }
  }, [tripId])

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Filter transactions based on search
  const filteredTransactions = useMemo(() => {
    if (!debouncedSearchQuery) return transactions
    const query = debouncedSearchQuery.toLowerCase()
    return transactions.filter((t) => {
      const tx = t as TransactionWithPayer
      const descriptionMatch = tx.description.toLowerCase().includes(query)
      const payerMatch = tx.payer?.display_name?.toLowerCase().includes(query) || false
      return descriptionMatch || payerMatch
    })
  }, [transactions, debouncedSearchQuery])

  // Export to CSV
  const exportToCSV = useCallback(() => {
    const headers = ['Date/Time', 'Description', 'Payer', 'Amount', 'Split Type']
    const rows = filteredTransactions.map((t) => {
      const tx = t as TransactionWithPayer
      const date = new Date(tx.created_at)
      const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
      return [
        formattedDate,
        tx.description,
        tx.payer?.display_name || 'Unknown',
        tx.total_amount.toString(),
        tx.split_type,
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `transactions-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [filteredTransactions])

  const handleEdit = async (
    data: Partial<Transaction> & {
      lineItems?: LineItem[]
      adjustments?: Array<{ memberId: string; amount: number }>
    }
  ) => {
    if (!editingTransaction) return

    try {
      const updateData: any = {
        description: data.description,
        totalAmount: data.total_amount,
        payerId: data.payer_id,
        splitType: data.split_type,
      }

      if (data.lineItems !== undefined) {
        updateData.lineItems = data.lineItems
      }

      if (data.adjustments !== undefined) {
        updateData.adjustments = data.adjustments
      }

      const response = await fetch(`/api/transactions/${editingTransaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
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
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-serif font-bold text-accent">Ledger</h1>
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-transparent border-b-2 border-accent/20 text-accent placeholder-accent/40 focus:outline-none focus:border-accent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-accent/60 hover:text-accent"
                >
                  ×
                </button>
              )}
            </div>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 border border-accent/20 text-accent rounded-full hover:bg-accent/5 text-sm whitespace-nowrap"
            >
              Export CSV
            </button>
          </div>
        </div>
        {searchQuery && (
          <div className="mb-4 text-sm text-accent/60">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </div>
        )}
        <div className="space-y-2">
          {filteredTransactions.map((transaction) => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction as any}
              onEdit={() => setEditingTransaction(transaction)}
              onDelete={() => handleDelete(transaction.id)}
              canEdit={true}
            />
          ))}
        </div>
        {filteredTransactions.length === 0 && transactions.length > 0 && (
          <div className="text-center py-8 text-accent/60">
            No transactions match your search
          </div>
        )}
      </div>

      {editingTransaction && memberNames.length > 0 && (
        <TransactionEditForm
          transaction={editingTransaction as any}
          memberNames={memberNames}
          tripId={tripId}
          onSubmit={handleEdit}
          onCancel={() => setEditingTransaction(null)}
        />
      )}
    </>
  )
}
