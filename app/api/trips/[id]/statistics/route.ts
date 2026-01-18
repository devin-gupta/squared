import { NextRequest, NextResponse } from 'next/server'
import { calculateStatistics } from '@/lib/statistics/calculate'
import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const tripId = resolvedParams.id
    const userName = request.nextUrl.searchParams.get('userName')

    // Get current user's member ID if userName provided
    let currentUserId: string | undefined
    if (userName) {
      const { data: member } = await supabase
        .from('trip_members')
        .select('id')
        .eq('trip_id', tripId)
        .eq('display_name', userName)
        .single()

      if (member) {
        currentUserId = (member as { id: string }).id
      }
    }

    const statistics = await calculateStatistics(tripId, currentUserId)

    return NextResponse.json({ statistics })
  } catch (error) {
    console.error('Error calculating statistics:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate statistics' },
      { status: 500 }
    )
  }
}
