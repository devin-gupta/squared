'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Transaction } from '@/types/transaction'

export function useRealtimeTransactions(tripId: string | null) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tripId) {
      setLoading(false)
      return
    }

    // Initial fetch
    const fetchTransactions = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          payer:trip_members!transactions_payer_id_fkey(display_name)
        `)
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setTransactions(data as any)
      }
      setLoading(false)
    }

    fetchTransactions()

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`transactions:${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `trip_id=eq.${tripId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Fetch the full transaction with relations
            const { data } = await supabase
              .from('transactions')
              .select(`
                *,
                payer:trip_members!transactions_payer_id_fkey(display_name)
              `)
              .eq('id', payload.new.id)
              .single()

            if (data) {
              setTransactions((prev) => {
                const existing = prev.findIndex((t) => t.id === data.id)
                if (existing >= 0) {
                  const updated = [...prev]
                  updated[existing] = data as any
                  return updated
                } else {
                  return [data as any, ...prev].sort(
                    (a, b) =>
                      new Date(b.created_at).getTime() -
                      new Date(a.created_at).getTime()
                  )
                }
              })
            }
          } else if (payload.eventType === 'DELETE') {
            setTransactions((prev) => prev.filter((t) => t.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tripId])

  return { transactions, loading }
}
