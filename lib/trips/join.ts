import { supabase } from '../supabase/client'

export async function joinTrip(inviteCode: string, displayName: string): Promise<string> {
  // Find trip by invite code
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id')
    .eq('invite_code', inviteCode.toUpperCase())
    .single()

  if (tripError || !trip) {
    throw new Error('Trip not found. Please check the invite code.')
  }

  // Check if member already exists
  const { data: existingMember } = await supabase
    .from('trip_members')
    .select('id')
    .eq('trip_id', trip.id)
    .eq('display_name', displayName)
    .single()

  if (existingMember) {
    return trip.id
  }

  // Add member
  const { error: memberError } = await supabase
    .from('trip_members')
    .insert({
      trip_id: trip.id,
      display_name: displayName,
    })

  if (memberError) {
    throw new Error(`Failed to join trip: ${memberError.message}`)
  }

  return trip.id
}
