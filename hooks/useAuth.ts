'use client'

import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, isSupabaseReady } from '@/lib/supabase'
import { syncFromCloud } from '@/lib/sync'

export type SyncState = 'idle' | 'syncing' | 'done' | 'error'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncState, setSyncState] = useState<SyncState>('idle')

  const runSync = useCallback(async () => {
    setSyncState('syncing')
    try {
      await syncFromCloud()
      setSyncState('done')
    } catch {
      setSyncState('error')
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseReady()) { setLoading(false); return }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) runSync()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (event === 'SIGNED_IN') runSync()
        if (event === 'SIGNED_OUT') setSyncState('idle')
      },
    )

    return () => subscription.unsubscribe()
  }, [runSync])

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { user, loading, syncState, signInWithGoogle, signOut }
}
