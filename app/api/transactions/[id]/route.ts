import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const body = await request.json()
    const {
      description,
      totalAmount,
      payerId,
      splitType,
      lineItems,
      adjustments,
    } = body

    const resolvedParams = await Promise.resolve(params)
    const transactionId = resolvedParams.id

    // Get current transaction to check split_type
    const { data: currentTransaction, error: fetchError } = await supabase
      .from('transactions')
      .select('split_type')
      .eq('id', transactionId)
      .maybeSingle()

    if (fetchError) {
      throw new Error(`Failed to fetch transaction: ${fetchError.message}`)
    }

    if (!currentTransaction) {
      throw new Error('Transaction not found')
    }

    const currentSplitType = (currentTransaction as { split_type?: 'equal' | 'custom' }).split_type

    // Update transaction
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (description !== undefined) updateData.description = description
    if (totalAmount !== undefined) updateData.total_amount = totalAmount
    if (payerId !== undefined) updateData.payer_id = payerId
    if (splitType !== undefined) updateData.split_type = splitType
    if (lineItems !== undefined) updateData.line_items = lineItems

    // Update transaction
    const { error: updateError } = await supabase
      .from('transactions')
      // @ts-expect-error - Supabase type inference issue with update
      .update(updateData)
      .eq('id', transactionId)

    if (updateError) {
      throw new Error(`Failed to update transaction: ${updateError.message}`)
    }

    // Fetch updated transaction
    const { data: transaction, error: selectError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single()

    if (selectError || !transaction) {
      throw new Error(`Failed to fetch updated transaction: ${selectError?.message || 'Transaction not found'}`)
    }

    const finalSplitType = splitType !== undefined ? splitType : currentSplitType

    // Update adjustments based on split type
    if (finalSplitType === 'custom' && adjustments !== undefined) {
      // Delete existing adjustments
      await supabase
        .from('transaction_adjustments')
        .delete()
        .eq('transaction_id', transactionId)

      // Insert new adjustments
      if (adjustments.length > 0) {
        const adjustmentInserts = adjustments.map((adj: any) => ({
          transaction_id: transactionId,
          member_id: adj.memberId,
          amount: adj.amount,
        }))

        const { error: adjError } = await supabase
          .from('transaction_adjustments')
          .insert(adjustmentInserts as any)

        if (adjError) {
          console.error('Failed to update adjustments:', adjError)
        }
      }
    } else if (finalSplitType === 'equal' && (splitType !== undefined || adjustments !== undefined)) {
      // If changing to equal split or adjustments were explicitly set to empty, delete all adjustments
      await supabase
        .from('transaction_adjustments')
        .delete()
        .eq('transaction_id', transactionId)
    }

    return NextResponse.json({ transaction })
  } catch (error) {
    console.error('Error updating transaction:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update transaction' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const transactionId = resolvedParams.id

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId)

    if (error) {
      throw new Error(`Failed to delete transaction: ${error.message}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete transaction' },
      { status: 500 }
    )
  }
}
