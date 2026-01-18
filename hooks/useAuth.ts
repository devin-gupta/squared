'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

interface AuthState {
  user: User | null
  loading: boolean
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
  })

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState({
        user: session?.user ?? null,
        loading: false,
      })
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState({
        user: session?.user ?? null,
        loading: false,
      })
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string) => {
    // Use window.location.origin to get the current domain (works in both dev and production)
    // In production, this will be the Vercel deployment URL
    const redirectUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/`
      : '/'
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return {
    user: authState.user,
    loading: authState.loading,
    signIn,
    signOut,
  }
}
