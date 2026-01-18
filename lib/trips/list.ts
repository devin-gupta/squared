import { supabase } from '../supabase/client'

export async function listTrips(userName?: string, userId?: string): Promise<Array<{
  id: string
  name: string
  invite_code: string
  created_at: string
  created_by: string
}>> {
  let query = supabase.from('trips').select('id, name, invite_code, created_at, created_by')

  // Filter by user_id if authenticated, otherwise fall back to display_name
  if (userId) {
    const { data: memberTrips } = await supabase
      .from('trip_members')
      .select('trip_id')
      .eq('user_id', userId)

    if (memberTrips && memberTrips.length > 0) {
      const tripIds = (memberTrips as Array<{ trip_id: string }>).map((m) => m.trip_id)
      query = query.in('id', tripIds)
    } else {
      return []
    }
  } else if (userName) {
    // Fallback to display_name for backward compatibility
    const { data: memberTrips } = await supabase
      .from('trip_members')
      .select('trip_id')
      .eq('display_name', userName)

    if (memberTrips && memberTrips.length > 0) {
      const tripIds = (memberTrips as Array<{ trip_id: string }>).map((m) => m.trip_id)
      query = query.in('id', tripIds)
    } else {
      return []
    }
  }

  const { data: trips, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch trips: ${error.message}`)
  }

  return trips || []
}
