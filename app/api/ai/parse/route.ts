import { NextRequest, NextResponse } from 'next/server'
import { parseTransactionText } from '@/lib/ai/parser'
import { supabase } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
  try {
    const { text, tripId } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    // Get member names for context
    let memberNames: string[] = []
    if (tripId) {
      const { data: members } = await supabase
        .from('trip_members')
        .select('display_name')
        .eq('trip_id', tripId)

      if (members) {
        memberNames = members.map((m) => m.display_name)
      }
    }

    const parsed = await parseTransactionText(text, memberNames)

    return NextResponse.json({ parsed })
  } catch (error) {
    console.error('Error parsing transaction:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse transaction' },
      { status: 500 }
    )
  }
}
