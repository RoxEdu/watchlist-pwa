'use client'

import Dexie, { type Table } from 'dexie'
import type { WatchlistItem } from './types'

class WatchlistDB extends Dexie {
  items!: Table<WatchlistItem>

  constructor() {
    super('watchlist-pwa')
    this.version(2).stores({
      items: '++id, imdbId, type, status, addedAt, updatedAt',
    })
  }
}

export const db = new WatchlistDB()

export async function addItem(item: Omit<WatchlistItem, 'id' | 'addedAt' | 'updatedAt'>): Promise<number> {
  const now = new Date()
  return db.items.add({ ...item, addedAt: now, updatedAt: now } as WatchlistItem)
}

export async function updateItem(id: number, changes: Partial<WatchlistItem>): Promise<void> {
  await db.items.update(id, { ...changes, updatedAt: new Date() })
}

export async function deleteItem(id: number): Promise<void> {
  await db.items.delete(id)
}

export async function getItemByImdbId(imdbId: string): Promise<WatchlistItem | undefined> {
  return db.items.where('imdbId').equals(imdbId).first()
}

export async function getAllItems(): Promise<WatchlistItem[]> {
  return db.items.orderBy('updatedAt').reverse().toArray()
}

// Merge imported items: newer updatedAt wins
export async function importItems(raw: unknown[]): Promise<number> {
  let count = 0
  for (const entry of raw) {
    try {
      const item = entry as Partial<WatchlistItem>
      if (!item.imdbId || !item.title) continue
      const local = await getItemByImdbId(item.imdbId)
      const importedAt = item.updatedAt ? new Date(item.updatedAt) : new Date(0)
      if (!local) {
        await addItem({
          imdbId: item.imdbId,
          title: item.title,
          type: item.type ?? 'movie',
          status: item.status ?? 'want_to_watch',
          posterUrl: item.posterUrl ?? null,
          genres: item.genres ?? [],
          year: item.year ?? null,
          imdbRating: item.imdbRating ?? null,
          myRating: item.myRating ?? null,
          currentSeason: item.currentSeason ?? 1,
          currentEpisode: item.currentEpisode ?? 0,
          totalSeasons: item.totalSeasons ?? null,
          totalEpisodes: item.totalEpisodes ?? null,
          notes: item.notes ?? '',
          overview: item.overview ?? '',
        })
        count++
      } else if (importedAt > local.updatedAt) {
        await updateItem(local.id, { ...item, updatedAt: importedAt })
        count++
      }
    } catch {
      // skip malformed entries
    }
  }
  return count
}
