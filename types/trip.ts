export interface Trip {
  id: string
  name: string
  created_at: string
  invite_code: string
  created_by: string
}

export interface TripMember {
  id: string
  trip_id: string
  display_name: string
  joined_at: string
}
