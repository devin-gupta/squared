import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

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

    // Get authenticated user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Verify token and get user
    const tempClient = createClient<Database>(supabaseUrl, supabasePublishableKey)
    const { data: { user }, error: authError } = await tempClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      )
    }
    
    // Create authenticated Supabase client with session
    const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })
    
    // Set the session explicitly
    await supabase.auth.setSession({
      access_token: token,
      refresh_token: '', // Not needed for server-side
    } as any)

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
    const updateResult = await supabase
      .from('transactions')
      // @ts-expect-error - Supabase type inference issue with update
      .update(updateData)
      .eq('id', transactionId)

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/473fdca0-8c87-48f9-a206-a717977155d0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:87',message:'Update result with auth',data:{error:updateResult.error?.message,errorCode:updateResult.error?.code,data:updateResult.data,status:updateResult.status},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (updateResult.error) {
      throw new Error(`Failed to update transaction: ${updateResult.error.message}`)
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

    // Get authenticated user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/473fdca0-8c87-48f9-a206-a717977155d0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:161',message:'DELETE handler with auth',data:{transactionId,hasToken:!!token,tokenLength:token.length,tokenPrefix:token.substring(0,20)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Verify token and get user
    const tempClient = createClient<Database>(supabaseUrl, supabasePublishableKey)
    const { data: { user }, error: authError } = await tempClient.auth.getUser(token)
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/473fdca0-8c87-48f9-a206-a717977155d0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:168',message:'Token verification',data:{hasUser:!!user,userId:user?.id,authError:authError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      )
    }
    
    // Create authenticated Supabase client with session
    const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })
    
    // Set the session explicitly
    await supabase.auth.setSession({
      access_token: token,
      refresh_token: '', // Not needed for server-side
    } as any)

    const deleteResult = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId)

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/473fdca0-8c87-48f9-a206-a717977155d0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:162',message:'Delete result with auth',data:{error:deleteResult.error?.message,errorCode:deleteResult.error?.code,data:deleteResult.data,status:deleteResult.status},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (deleteResult.error) {
      throw new Error(`Failed to delete transaction: ${deleteResult.error.message}`)
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
