import { supabase } from '../supabase/client'

export async function addMember(
  tripId: string,
  displayName: string,
  userId?: string
): Promise<{ id: string; display_name: string }> {
  // Check if member already exists (by user_id if authenticated, or display_name)
  let existing
  if (userId) {
    const { data } = await (supabase
      .from('trip_members') as any)
      .select('id, display_name')
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .single()
    existing = data
  } else {
    const { data } = await (supabase
      .from('trip_members') as any)
      .select('id, display_name')
      .eq('trip_id', tripId)
      .eq('display_name', displayName)
      .single()
    existing = data
  }

  if (existing) {
    return existing as { id: string; display_name: string }
  }

  // Add new member (with user_id if authenticated)
  const memberData: { trip_id: string; display_name: string; user_id?: string } = {
    trip_id: tripId,
    display_name: displayName,
  }
  
  if (userId) {
    memberData.user_id = userId
  }

  const { data: member, error } = await (supabase
    .from('trip_members') as any)
    .insert(memberData)
    .select('id, display_name')
    .single()

  if (error || !member) {
    throw new Error(`Failed to add member: ${error?.message || 'Unknown error'}`)
  }

  return member as { id: string; display_name: string }
}
