import { supabase } from '../supabase/client'
import { Transaction } from '@/types/transaction'

export interface TripStatistics {
  totalSpent: number
  transactionCount: number
  averagePerTransaction: number
  userSpending: number // amount paid by current user
  categoryBreakdown: Array<{ category: string; amount: number; percentage: number }>
}

export async function calculateStatistics(
  tripId: string,
  currentUserId?: string
): Promise<TripStatistics> {
  // Fetch all finalized transactions
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select(`
      *,
      payer:trip_members!transactions_payer_id_fkey(id, display_name)
    `)
    .eq('trip_id', tripId)
    .eq('status', 'finalized')
    .order('created_at', { ascending: false })

  if (error || !transactions) {
    throw new Error('Failed to fetch transactions for statistics')
  }

  // Calculate totals
  const totalSpent = transactions.reduce((sum, tx) => sum + parseFloat(tx.total_amount.toString()), 0)
  const transactionCount = transactions.length
  const averagePerTransaction = transactionCount > 0 ? totalSpent / transactionCount : 0

  // Calculate user spending (amounts they paid)
  let userSpending = 0
  if (currentUserId) {
    userSpending = transactions
      .filter((tx) => tx.payer_id === currentUserId)
      .reduce((sum, tx) => sum + parseFloat(tx.total_amount.toString()), 0)
  }

  // Calculate category breakdown
  const categoryMap = new Map<string, number>()
  
  transactions.forEach((tx) => {
    // Check line items for categories (primary source)
    if (tx.line_items && Array.isArray(tx.line_items) && tx.line_items.length > 0) {
      tx.line_items.forEach((item: any) => {
        if (item.category) {
          const current = categoryMap.get(item.category) || 0
          categoryMap.set(item.category, current + parseFloat(item.amount.toString()))
        }
      })
    } else {
      // If no line items, check if transaction has category field
      // Otherwise, use description to infer or default to "Other"
      const category = (tx as any).category || 'Other'
      const current = categoryMap.get(category) || 0
      categoryMap.set(category, current + parseFloat(tx.total_amount.toString()))
    }
  })

  // Convert to array and calculate percentages
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  return {
    totalSpent,
    transactionCount,
    averagePerTransaction,
    userSpending,
    categoryBreakdown,
  }
}
