import { supabase } from '../supabase/client'

export async function joinTrip(inviteCode: string, displayName: string, userId?: string): Promise<string> {
  // Find trip by invite code
  const { data: trip, error: tripError } = await (supabase
    .from('trips') as any)
    .select('id')
    .eq('invite_code', inviteCode.toUpperCase())
    .single()

  if (tripError || !trip) {
    throw new Error('Trip not found. Please check the invite code.')
  }

  const typedTrip = trip as { id: string }

  // Check if member already exists (by user_id if authenticated, or display_name)
  let existingMember
  if (userId) {
    const { data } = await (supabase
      .from('trip_members') as any)
      .select('id')
      .eq('trip_id', typedTrip.id)
      .eq('user_id', userId)
      .single()
    existingMember = data
  } else {
    const { data } = await (supabase
      .from('trip_members') as any)
      .select('id')
      .eq('trip_id', typedTrip.id)
      .eq('display_name', displayName)
      .single()
    existingMember = data
  }

  if (existingMember) {
    return typedTrip.id
  }

  // Add member (with user_id if authenticated)
  const memberData: { trip_id: string; display_name: string; user_id?: string } = {
    trip_id: typedTrip.id,
    display_name: displayName,
  }
  
  if (userId) {
    memberData.user_id = userId
  }

  const { error: memberError } = await (supabase
    .from('trip_members') as any)
    .insert(memberData)

  if (memberError) {
    throw new Error(`Failed to join trip: ${memberError.message}`)
  }

  return typedTrip.id
}
