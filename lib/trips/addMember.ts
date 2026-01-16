import { supabase } from '../supabase/client'

export async function addMember(
  tripId: string,
  displayName: string
): Promise<{ id: string; display_name: string }> {
  // Check if member already exists
  const { data: existing } = await supabase
    .from('trip_members')
    .select('id, display_name')
    .eq('trip_id', tripId)
    .eq('display_name', displayName)
    .single()

  if (existing) {
    return existing
  }

  // Add new member
  const { data: member, error } = await supabase
    .from('trip_members')
    .insert({
      trip_id: tripId,
      display_name: displayName,
    })
    .select('id, display_name')
    .single()

  if (error) {
    throw new Error(`Failed to add member: ${error.message}`)
  }

  return member
}
