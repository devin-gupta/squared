import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const transactionId = resolvedParams.id

    const { error } = await supabase
      .from('transactions')
      // @ts-expect-error - Supabase type inference issue with update
      .update({ status: 'finalized' })
      .eq('id', transactionId)

    if (error) {
      throw new Error(`Failed to finalize transaction: ${error.message}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error finalizing transaction:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to finalize transaction' },
      { status: 500 }
    )
  }
}
