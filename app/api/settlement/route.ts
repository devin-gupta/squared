import { NextRequest, NextResponse } from 'next/server'
import { calculateOptimalSettlement, calculateBalances } from '@/lib/settlement/algorithm'
import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const tripId = request.nextUrl.searchParams.get('tripId')

    if (!tripId) {
      return NextResponse.json(
        { error: 'tripId is required' },
        { status: 400 }
      )
    }

    // Get all members
    const { data: members } = await supabase
      .from('trip_members')
      .select('id, display_name')
      .eq('trip_id', tripId)

    if (!members) {
      return NextResponse.json(
        { error: 'Failed to fetch members' },
        { status: 500 }
      )
    }

    const memberMap = new Map<string, string>()
    members.forEach((m: { id: string; display_name: string }) => {
      memberMap.set(m.id, m.display_name)
    })

    // Calculate balances
    const balances = await calculateBalances(tripId, memberMap)

    // Calculate optimal settlement
    const settlements = calculateOptimalSettlement(balances)

    // Map settlement IDs to names
    const settlementsWithNames = settlements.map((s) => ({
      from: memberMap.get(s.from) || s.from,
      fromId: s.from,
      to: memberMap.get(s.to) || s.to,
      toId: s.to,
      amount: s.amount,
    }))

    return NextResponse.json({ settlements: settlementsWithNames })
  } catch (error) {
    console.error('Error computing settlement:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compute settlement' },
      { status: 500 }
    )
  }
}
