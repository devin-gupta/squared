export interface TransactionParsed {
  description: string
  total_amount: number
  payer_id?: string
  payer_name?: string
  split_type: 'equal' | 'custom'
  adjustments?: { user_id?: string; user_name?: string; amount: number }[]
  line_items?: LineItem[]
  category?: string
}

export interface LineItem {
  description: string
  amount: number
  category: string
  split_among?: string[] // member names or IDs
}

export interface Transaction {
  id: string
  trip_id: string
  description: string
  total_amount: number
  payer_id: string
  split_type: 'equal' | 'custom'
  receipt_url?: string | null
  line_items?: LineItem[] | null
  created_at: string
  updated_at: string
  status: 'pending' | 'finalized'
}

export interface TransactionAdjustment {
  id: string
  transaction_id: string
  member_id: string
  amount: number
}
