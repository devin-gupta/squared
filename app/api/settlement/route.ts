import { NextRequest, NextResponse } from 'next/server'
import { calculateOptimalSettlement, calculateBalances } from '@/lib/settlement/algorithm'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
// Use service role key if available for server-side reads, otherwise fall back to anon key
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabasePublishableKey

// Create a server-side Supabase client that can bypass RLS for read-only operations
// If service role key is not available, this will still work but may be subject to RLS
const serverSupabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

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

    // Try to get auth token from header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || null

    // Create authenticated Supabase client if token is provided
    let supabaseClient = serverSupabase
    if (token) {
      const authenticatedClient = createClient<Database>(supabaseUrl, supabasePublishableKey, {
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
      await authenticatedClient.auth.setSession({
        access_token: token,
        refresh_token: '',
      } as any)
      supabaseClient = authenticatedClient
    }

    // Get all members using authenticated client
    const { data: members, error: membersError } = await supabaseClient
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

    // Calculate balances (pass authenticated client)
    const balances = await calculateBalances(tripId, memberMap, supabaseClient)

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
