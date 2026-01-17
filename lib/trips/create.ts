import { supabase } from '../supabase/client'

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed confusing chars
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function createTrip(displayName: string, tripName?: string): Promise<{ tripId: string; inviteCode: string }> {
  // Generate a short, readable invite code
  const inviteCode = generateInviteCode()

  // Create trip
  const { data: trip, error: tripError } = await (supabase
    .from('trips') as any)
    .insert({
      name: tripName || `Trip ${new Date().toLocaleDateString()}`,
      invite_code: inviteCode,
      created_by: displayName,
    })
    .select()
    .single()

  if (tripError) {
    throw new Error(`Failed to create trip: ${tripError.message}`)
  }

  // Add creator as first member
  const { data: member, error: memberError } = await (supabase
    .from('trip_members') as any)
    .insert({
      trip_id: trip.id,
      display_name: displayName,
    })
    .select()
    .single()

  if (memberError) {
    throw new Error(`Failed to add member: ${memberError.message}`)
  }

  return {
    tripId: trip.id,
    inviteCode: trip.invite_code,
  }
}
