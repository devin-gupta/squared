import { NextRequest, NextResponse } from 'next/server'
import { listTrips } from '@/lib/trips/list'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userName = searchParams.get('user_name') || undefined
    const userId = searchParams.get('user_id') || undefined

    const trips = await listTrips(userName, userId)

    return NextResponse.json({ trips })
  } catch (error) {
    console.error('Error fetching trips:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch trips' },
      { status: 500 }
    )
  }
}
