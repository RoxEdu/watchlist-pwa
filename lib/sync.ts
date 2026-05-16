'use client'

import { supabase, isSupabaseReady, type SupabaseRow } from './supabase'
import { db, addItem, updateItem, getItemByImdbId } from './db'
import type { WatchlistItem } from './types'

async function getUserId(): Promise<string | null> {
  if (!isSupabaseReady()) return null
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}

function toRow(item: WatchlistItem, userId: string): Omit<SupabaseRow, 'id'> {
  return {
    user_id: userId,
    imdb_id: item.imdbId,
    title: item.title,
    type: item.type,
    status: item.status,
    poster_url: item.posterUrl,
    genres: item.genres,
    year: item.year,
    imdb_rating: item.imdbRating,
    my_rating: item.myRating,
    current_season: item.currentSeason,
    current_episode: item.currentEpisode,
    total_seasons: item.totalSeasons,
    total_episodes: item.totalEpisodes,
    notes: item.notes,
    overview: item.overview,
    added_at: item.addedAt.toISOString(),
    updated_at: item.updatedAt.toISOString(),
  }
}

function fromRow(row: SupabaseRow): Omit<WatchlistItem, 'id'> {
  return {
    imdbId: row.imdb_id,
    title: row.title,
    type: row.type as WatchlistItem['type'],
    status: row.status as WatchlistItem['status'],
    posterUrl: row.poster_url,
    genres: row.genres ?? [],
    year: row.year,
    imdbRating: row.imdb_rating,
    myRating: row.my_rating,
    currentSeason: row.current_season,
    currentEpisode: row.current_episode,
    totalSeasons: row.total_seasons,
    totalEpisodes: row.total_episodes,
    notes: row.notes ?? '',
    overview: row.overview ?? '',
    addedAt: new Date(row.added_at),
    updatedAt: new Date(row.updated_at),
  }
}

// Push one item to Supabase (upsert by user_id + imdb_id)
export async function pushItem(item: WatchlistItem): Promise<void> {
  const userId = await getUserId()
  if (!userId) return
  await supabase.from('watchlist_items').upsert(toRow(item, userId), {
    onConflict: 'user_id,imdb_id',
  })
}

// Delete one item from Supabase
export async function deleteItemFromCloud(imdbId: string): Promise<void> {
  const userId = await getUserId()
  if (!userId) return
  await supabase.from('watchlist_items')
    .delete()
    .match({ user_id: userId, imdb_id: imdbId })
}

// Full two-way sync on login — newer updated_at wins
export async function syncFromCloud(): Promise<void> {
  const userId = await getUserId()
  if (!userId) return

  const { data, error } = await supabase
    .from('watchlist_items')
    .select('*')
    .eq('user_id', userId)

  if (error || !data) return

  // Pull remote → local
  for (const row of data as SupabaseRow[]) {
    const local = await getItemByImdbId(row.imdb_id)
    const remoteTs = new Date(row.updated_at)
    if (!local) {
      await addItem(fromRow(row))
    } else if (remoteTs > local.updatedAt) {
      await updateItem(local.id, fromRow(row))
    }
  }

  // Push local-only items → remote
  const allLocal = await db.items.toArray()
  const remoteIds = new Set(data.map((r: SupabaseRow) => r.imdb_id))
  const toUpload = allLocal.filter((i) => !remoteIds.has(i.imdbId))
  if (toUpload.length > 0) {
    await supabase.from('watchlist_items').upsert(
      toUpload.map((i) => toRow(i, userId)),
      { onConflict: 'user_id,imdb_id' },
    )
  }
}
