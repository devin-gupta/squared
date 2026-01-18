import { supabase } from '../supabase/client'

export async function deleteTrip(tripId: string, userId: string): Promise<void> {
  // Verify user is trip creator or member
  const { data: trip, error: tripError } = await (supabase
    .from('trips') as any)
    .select('created_by')
    .eq('id', tripId)
    .single()

  if (tripError || !trip) {
    throw new Error('Trip not found')
  }

  // Check if user is a member of the trip
  const { data: member, error: memberError } = await (supabase
    .from('trip_members') as any)
    .select('user_id, display_name')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single()

  if (memberError || !member) {
    throw new Error('You are not authorized to delete this trip')
  }

  // Verify user is trip creator
  const memberData = member as { user_id: string; display_name: string }
  const tripData = trip as { created_by: string }
  
  if (memberData.display_name !== tripData.created_by) {
    throw new Error('Only the trip creator can delete the trip')
  }

  // Delete trip (cascade will handle related records)
  const { error: deleteError } = await (supabase
    .from('trips') as any)
    .delete()
    .eq('id', tripId)

  if (deleteError) {
    throw new Error(`Failed to delete trip: ${deleteError.message}`)
  }
}
