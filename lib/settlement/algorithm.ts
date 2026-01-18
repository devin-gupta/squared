interface Debt {
  from: string
  to: string
  amount: number
}

interface Settlement {
  from: string
  to: string
  amount: number
}

export function calculateOptimalSettlement(
  balances: Map<string, number>
): Settlement[] {
  const settlements: Settlement[] = []
  const creditors: Array<{ id: string; amount: number }> = []
  const debtors: Array<{ id: string; amount: number }> = []

  // Separate creditors and debtors
  balances.forEach((balance, id) => {
    if (balance > 0.01) {
      // Creditor (owed money)
      creditors.push({ id, amount: balance })
    } else if (balance < -0.01) {
      // Debtor (owes money)
      debtors.push({ id, amount: Math.abs(balance) })
    }
  })

  // Sort by amount (largest first)
  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  // Greedy algorithm: match largest creditor with largest debtor
  let creditorIdx = 0
  let debtorIdx = 0

  while (creditorIdx < creditors.length && debtorIdx < debtors.length) {
    const creditor = creditors[creditorIdx]
    const debtor = debtors[debtorIdx]

    const settlementAmount = Math.min(creditor.amount, debtor.amount)

    settlements.push({
      from: debtor.id,
      to: creditor.id,
      amount: settlementAmount,
    })

    creditor.amount -= settlementAmount
    debtor.amount -= settlementAmount

    if (creditor.amount < 0.01) {
      creditorIdx++
    }
    if (debtor.amount < 0.01) {
      debtorIdx++
    }
  }

  return settlements
}

export async function calculateBalances(
  tripId: string,
  memberMap: Map<string, string> // member_id -> display_name
): Promise<Map<string, number>> {
  const { supabase } = require('../supabase/client')
  
  const balances = new Map<string, number>()

  // Initialize all members with 0 balance
  memberMap.forEach((_, memberId) => {
    balances.set(memberId, 0)
  })

  // Fetch all transactions
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select(`
      *,
      payer:trip_members!transactions_payer_id_fkey(id, display_name),
      adjustments:transaction_adjustments(
        *,
        member:trip_members!transaction_adjustments_member_id_fkey(id, display_name)
      )
    `)
    .eq('trip_id', tripId)
    .eq('status', 'finalized')

  if (error || !transactions) {
    throw new Error('Failed to fetch transactions')
  }

  // Calculate balances
  for (const tx of transactions as any[]) {
    const payerId = tx.payer_id
    const totalAmount = parseFloat(tx.total_amount)

    // Handle line items (receipts with item-level splits)
    if (tx.line_items && Array.isArray(tx.line_items) && tx.line_items.length > 0) {
      const lineItems = tx.line_items as Array<{
        description: string
        amount: number
        category: string
        split_among?: string[]
      }>

      // Build a map of member name/ID to member ID for lookups
      const nameToIdMap = new Map<string, string>()
      memberMap.forEach((name, id) => {
        nameToIdMap.set(name.toLowerCase(), id)
        nameToIdMap.set(id, id)
      })

      for (const item of lineItems) {
        const itemAmount = parseFloat(item.amount.toString()) || 0
        
        if (item.split_among && item.split_among.length > 0) {
          // Split among specified members
          const splitMemberIds = item.split_among
            .map((nameOrId) => {
              const id = nameToIdMap.get(nameOrId.toLowerCase()) || nameToIdMap.get(nameOrId)
              return id
            })
            .filter((id): id is string => id !== undefined)

          if (splitMemberIds.length > 0) {
            const perPerson = itemAmount / splitMemberIds.length
            splitMemberIds.forEach((memberId) => {
              balances.set(memberId, (balances.get(memberId) || 0) - perPerson)
            })
          }
        } else {
          // Split among all members
          const perPerson = itemAmount / memberMap.size
          memberMap.forEach((_, memberId) => {
            balances.set(memberId, (balances.get(memberId) || 0) - perPerson)
          })
        }
      }

      // Add to payer's balance (they paid, so they're owed)
      balances.set(payerId, (balances.get(payerId) || 0) + totalAmount)
      continue
    }

    // Get all members who should pay
    const membersToPay = new Set<string>()
    memberMap.forEach((_, memberId) => {
      membersToPay.add(memberId)
    })

    // Apply adjustments
    const adjustments = new Map<string, number>()
    if (tx.adjustments && tx.adjustments.length > 0) {
      for (const adj of tx.adjustments) {
        adjustments.set(adj.member.id, parseFloat(adj.amount))
      }
    }

    // Calculate split
    if (tx.split_type === 'equal') {
      const numMembers = membersToPay.size
      const perPerson = totalAmount / numMembers

      membersToPay.forEach((memberId) => {
        const adjustment = adjustments.get(memberId) || 0
        const amount = perPerson + adjustment
        balances.set(memberId, (balances.get(memberId) || 0) - amount)
      })
    } else {
      // Custom split - use adjustments
      membersToPay.forEach((memberId) => {
        const adjustment = adjustments.get(memberId) || 0
        balances.set(memberId, (balances.get(memberId) || 0) - adjustment)
      })
    }

    // Add to payer's balance (they paid, so they're owed)
    balances.set(payerId, (balances.get(payerId) || 0) + totalAmount)
  }

  return balances
}
