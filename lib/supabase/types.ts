export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      trips: {
        Row: {
          id: string
          name: string
          created_at: string
          invite_code: string
          created_by: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          invite_code: string
          created_by: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          invite_code?: string
          created_by?: string
        }
      }
      trip_members: {
        Row: {
          id: string
          trip_id: string
          display_name: string
          joined_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          display_name: string
          joined_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          display_name?: string
          joined_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          trip_id: string
          description: string
          total_amount: number
          payer_id: string
          split_type: 'equal' | 'custom'
          receipt_url: string | null
          line_items: Json | null
          created_at: string
          updated_at: string
          status: 'pending' | 'finalized'
        }
        Insert: {
          id?: string
          trip_id: string
          description: string
          total_amount: number
          payer_id: string
          split_type?: 'equal' | 'custom'
          receipt_url?: string | null
          line_items?: Json | null
          created_at?: string
          updated_at?: string
          status?: 'pending' | 'finalized'
        }
        Update: {
          id?: string
          trip_id?: string
          description?: string
          total_amount?: number
          payer_id?: string
          split_type?: 'equal' | 'custom'
          receipt_url?: string | null
          line_items?: Json | null
          created_at?: string
          updated_at?: string
          status?: 'pending' | 'finalized'
        }
      }
      transaction_adjustments: {
        Row: {
          id: string
          transaction_id: string
          member_id: string
          amount: number
        }
        Insert: {
          id?: string
          transaction_id: string
          member_id: string
          amount: number
        }
        Update: {
          id?: string
          transaction_id?: string
          member_id?: string
          amount?: number
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
