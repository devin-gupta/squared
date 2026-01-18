import { NextRequest, NextResponse } from 'next/server'
import { deleteTrip } from '@/lib/trips/delete'
import { supabase } from '@/lib/supabase/client'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const tripId = resolvedParams.id

    // Get authenticated user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user from Supabase auth
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    await deleteTrip(tripId, user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting trip:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete trip' },
      { status: 500 }
    )
  }
}
