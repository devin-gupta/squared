import { supabase } from '../supabase/client'

export async function removeMember(tripId: string, memberId: string): Promise<void> {
  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('id', memberId)
    .eq('trip_id', tripId)

  if (error) {
    throw new Error(`Failed to remove member: ${error.message}`)
  }
}
