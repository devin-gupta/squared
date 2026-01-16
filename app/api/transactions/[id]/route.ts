import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const transactionId = params.id

    // Update transaction
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (description !== undefined) updateData.description = description
    if (totalAmount !== undefined) updateData.total_amount = totalAmount
    if (payerId !== undefined) updateData.payer_id = payerId
    if (splitType !== undefined) updateData.split_type = splitType
    if (lineItems !== undefined) updateData.line_items = lineItems

    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId)
      .select()
      .single()

    if (txError) {
      throw new Error(`Failed to update transaction: ${txError.message}`)
    }

    // Update adjustments if custom split
    if (splitType === 'custom' && adjustments) {
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
          .insert(adjustmentInserts)

        if (adjError) {
          console.error('Failed to update adjustments:', adjError)
        }
      }
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
  { params }: { params: { id: string } }
) {
  try {
    const transactionId = params.id

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
