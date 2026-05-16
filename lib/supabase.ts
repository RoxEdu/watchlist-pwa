'use client'

import { createBrowserClient } from '@supabase/ssr'

// Use a valid fallback during prerender/build so the module
// doesn't crash when env vars are not yet configured
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const url = rawUrl.startsWith('https://') ? rawUrl : 'https://placeholder.supabase.co'
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createBrowserClient(url, key)

export function isSupabaseReady(): boolean {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return u.startsWith('https://') && !u.includes('placeholder')
}

export type SupabaseRow = {
  id: string
  user_id: string
  imdb_id: string
  title: string
  type: string
  status: string
  poster_url: string | null
  genres: string[]
  year: number | null
  imdb_rating: number | null
  my_rating: number | null
  current_season: number
  current_episode: number
  total_seasons: number | null
  total_episodes: number | null
  notes: string
  overview: string
  added_at: string
  updated_at: string
}
