import { supabase } from '../supabase/client'
import { TransactionParsed } from '@/types/transaction'
import { addMember } from '../trips/addMember'

export async function createTransaction(
  tripId: string,
  parsed: TransactionParsed,
  receiptUrl?: string | null,
  currentUserName?: string | null
): Promise<{ transactionId: string; addedMember?: { id: string; name: string } }> {
  // Get all members for this trip
  const { data: members, error: membersError } = await supabase
    .from('trip_members')
    .select('id, display_name')
    .eq('trip_id', tripId)

  if (membersError || !members || !Array.isArray(members)) {
    throw new Error('Failed to fetch trip members')
  }

  const typedMembers = members as Array<{ id: string; display_name: string }>

  // Helper function to find member by name with fuzzy matching
  const findMemberByName = (name: string): { id: string; display_name: string } | undefined => {
    if (!name) return undefined
    
    const normalizedName = name.toLowerCase().trim()
    
    // 1. Try exact match (case-insensitive)
    let payer = typedMembers.find((m) => m.display_name.toLowerCase() === normalizedName)
    if (payer) return payer
    
    // 2. Try substring match (e.g., "puja" in "poojagupta23")
    payer = typedMembers.find((m) => 
      m.display_name.toLowerCase().includes(normalizedName) || 
      normalizedName.includes(m.display_name.toLowerCase())
    )
    if (payer) return payer
    
    // 3. Try starts-with match (e.g., "raj" matches "Rajat")
    payer = typedMembers.find((m) => 
      m.display_name.toLowerCase().startsWith(normalizedName) || 
      normalizedName.startsWith(m.display_name.toLowerCase())
    )
    if (payer) return payer
    
    return undefined
  }

  // Find payer ID - try to match to existing members first
  let payerId: string
  let addedMember: { id: string; name: string } | undefined

  if (parsed.payer_name) {
    // Try to find matching member with fuzzy matching
    let payer = findMemberByName(parsed.payer_name)
    
    if (!payer) {
      // If no match found, try auto-adding as new member (but log it)
      console.log(`No match found for payer_name "${parsed.payer_name}", attempting to add as new member`)
      try {
        const newMember = await addMember(tripId, parsed.payer_name)
        payer = newMember as { id: string; display_name: string }
        addedMember = {
          id: newMember.id,
          name: newMember.display_name,
        }
      } catch (error) {
        // If auto-add fails, fall back to current user or first member
        console.error('Failed to auto-add member:', error)
        // Fall through to default logic below
        payer = undefined
      }
    }
    
    // If we still don't have a payer, default to current user or first member
    if (!payer) {
      if (currentUserName) {
        const currentUserMember = findMemberByName(currentUserName) || 
          typedMembers.find((m) => m.display_name === currentUserName)
        payerId = currentUserMember?.id || typedMembers[0].id
      } else {
        payerId = typedMembers[0].id
      }
    } else {
      payerId = payer.id
    }
  } else {
    // Default to current user (person adding the item) if provided, otherwise first member
    if (currentUserName) {
      const currentUserMember = findMemberByName(currentUserName) || 
        typedMembers.find((m) => m.display_name === currentUserName)
      payerId = currentUserMember?.id || typedMembers[0].id
    } else {
      payerId = typedMembers[0].id
    }
  }

  // Create transaction (finalize immediately for v1)
  const { data: transaction, error: txError } = await (supabase
    .from('transactions') as any)
    .insert({
      trip_id: tripId,
      description: parsed.description,
      total_amount: parsed.total_amount,
      payer_id: payerId,
      split_type: parsed.split_type,
      receipt_url: receiptUrl || null,
      line_items: parsed.line_items || null,
      status: 'finalized', // Finalize immediately for v1
    })
    .select()
    .single()

  if (txError) {
    throw new Error(`Failed to create transaction: ${txError.message}`)
  }

  // If new member was added, add it to members array for adjustments
  if (addedMember) {
    typedMembers.push({ id: addedMember.id, display_name: addedMember.name })
  }

  // Create adjustments if custom split
  if (parsed.split_type === 'custom' && parsed.adjustments && parsed.adjustments.length > 0) {
    const adjustmentInserts = parsed.adjustments
      .map((adj) => {
        const member = typedMembers.find(
          (m) => m.display_name === adj.user_name
        )
        if (!member) return null
        return {
          transaction_id: transaction.id,
          member_id: member.id,
          amount: adj.amount,
        }
      })
      .filter((adj): adj is NonNullable<typeof adj> => adj !== null)

    if (adjustmentInserts.length > 0) {
      const { error: adjError } = await (supabase
        .from('transaction_adjustments') as any)
        .insert(adjustmentInserts)

      if (adjError) {
        console.error('Failed to create adjustments:', adjError)
      }
    }
  }

  return {
    transactionId: transaction.id,
    addedMember,
  }
}
