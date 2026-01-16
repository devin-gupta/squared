import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      tripId,
      description,
      totalAmount,
      payerId,
      splitType,
      receiptUrl,
      lineItems,
      adjustments,
    } = body

    // Validate required fields
    if (!tripId || !description || !totalAmount || !payerId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        trip_id: tripId,
        description,
        total_amount: totalAmount,
        payer_id: payerId,
        split_type: splitType || 'equal',
        receipt_url: receiptUrl || null,
        line_items: lineItems || null,
        status: 'pending',
      })
      .select()
      .single()

    if (txError) {
      throw new Error(`Failed to create transaction: ${txError.message}`)
    }

    // Create adjustments if custom split
    if (splitType === 'custom' && adjustments && adjustments.length > 0) {
      const adjustmentInserts = adjustments.map((adj: any) => ({
        transaction_id: transaction.id,
        member_id: adj.memberId,
        amount: adj.amount,
      }))

      const { error: adjError } = await supabase
        .from('transaction_adjustments')
        .insert(adjustmentInserts)

      if (adjError) {
        console.error('Failed to create adjustments:', adjError)
        // Don't fail the whole request, just log
      }
    }

    return NextResponse.json({ transaction })
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create transaction' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tripId = searchParams.get('tripId')

    if (!tripId) {
      return NextResponse.json(
        { error: 'tripId is required' },
        { status: 400 }
      )
    }

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        *,
        payer:trip_members!transactions_payer_id_fkey(display_name),
        adjustments:transaction_adjustments(
          *,
          member:trip_members!transaction_adjustments_member_id_fkey(display_name)
        )
      `)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`)
    }

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}
