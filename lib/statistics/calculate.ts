import type { SupabaseClient } from '@supabase/supabase-js'
import { Transaction } from '@/types/transaction'
import { expenseAllocations } from '@/lib/transactions/allocation'

export interface TripStatistics {
  totalSpent: number
  transactionCount: number
  averagePerTransaction: number
  userPaid: number
  userSpent: number
  categoryBreakdown: Array<{ category: string; amount: number; percentage: number }>
}

export async function calculateStatistics(
  client: SupabaseClient,
  tripId: string,
  currentUserId?: string
): Promise<TripStatistics> {
  // Fetch all finalized transactions
  const { data: transactions, error } = await client
    .from('transactions')
    .select(`
      *,
      adjustments:transaction_adjustments(member_id, amount)
    `)
    .eq('trip_id', tripId)
    .eq('status', 'finalized')
    .order('created_at', { ascending: false })

  if (error || !transactions) {
    throw new Error('Failed to fetch transactions for statistics')
  }

  const typedTransactions = transactions as any[] as Array<
    Transaction & {
      adjustments?: Array<{ member_id: string; amount: number | string }>
    }
  >

  const { data: members, error: membersError } = await client
    .from('trip_members')
    .select('id, display_name')
    .eq('trip_id', tripId)

  if (membersError || !members) {
    throw new Error('Failed to fetch trip members for statistics')
  }

  // Calculate totals
  const totalSpent = typedTransactions.reduce((sum, tx) => {
    const amount = typeof tx.total_amount === 'number' ? tx.total_amount : parseFloat(String(tx.total_amount))
    return sum + amount
  }, 0)
  const transactionCount = typedTransactions.length
  const averagePerTransaction = transactionCount > 0 ? totalSpent / transactionCount : 0

  // Keep personal cash outlay and allocated consumption distinct. Their
  // difference is the member's balance (the amount owed to or by them).
  let userPaid = 0
  let userSpent = 0
  if (currentUserId) {
    userPaid = typedTransactions
      .filter((tx) => tx.payer_id === currentUserId)
      .reduce((sum, tx) => {
        const amount = typeof tx.total_amount === 'number' ? tx.total_amount : parseFloat(String(tx.total_amount))
        return sum + amount
      }, 0)
    userSpent = typedTransactions.reduce((sum, transaction) => {
      const allocation = expenseAllocations(transaction, members).find(
        ({ memberId }) => memberId === currentUserId,
      )
      return sum + (allocation?.amount || 0)
    }, 0)
  }

  // Calculate category breakdown
  const categoryMap = new Map<string, number>()
  
  typedTransactions.forEach((tx) => {
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
    userPaid,
    userSpent,
    categoryBreakdown,
  }
}
