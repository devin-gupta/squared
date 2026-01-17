import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tripId = params.id
    const body = await request.json()
    const { display_name } = body

    if (!display_name) {
      return NextResponse.json(
        { error: 'display_name is required' },
        { status: 400 }
      )
    }

    // Check if member already exists
    const { data: existing } = await supabase
      .from('trip_members')
      .select('id')
      .eq('trip_id', tripId)
      .eq('display_name', display_name)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Member already exists' },
        { status: 400 }
      )
    }

    // Add member
    const { data: member, error } = await supabase
      .from('trip_members')
      // @ts-expect-error - Supabase type inference issue with insert
      .insert({
        trip_id: tripId,
        display_name,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to add member: ${error.message}`)
    }

    return NextResponse.json({ member })
  } catch (error) {
    console.error('Error adding member:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add member' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tripId = params.id
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json(
        { error: 'memberId is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('trip_members')
      .delete()
      .eq('id', memberId)
      .eq('trip_id', tripId)

    if (error) {
      throw new Error(`Failed to remove member: ${error.message}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing member:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove member' },
      { status: 500 }
    )
  }
}
