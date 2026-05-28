'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db, addItem, updateItem, deleteItem, getItemByImdbId, isDuplicateItem } from '@/lib/db'
import type { MediaType, Status, OMDbSearchResult, OMDbDetail, WatchlistItem } from '@/lib/types'
import { getOMDbDetail, detectMediaType, parsePosterUrl, parseRating } from '@/lib/omdb'
import { pushItem, deleteItemFromCloud } from '@/lib/sync'
import type { TMDBSearchResult } from '@/lib/tmdb'
import { useUIStore } from '@/lib/store'

function sortWatchlistItems(items: WatchlistItem[], sortBy: string): WatchlistItem[] {
  return [...items].sort((a, b) => {
    if (sortBy === 'newest_added') {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    }
    if (sortBy === 'oldest_added') {
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    }
    if (sortBy === 'alphabetical_az') {
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    }
    if (sortBy === 'alphabetical_za') {
      return b.title.localeCompare(a.title, undefined, { sensitivity: 'base' })
    }
    if (sortBy === 'newest_release') {
      const yA = a.year ?? 0
      const yB = b.year ?? 0
      if (yA === yB) return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      return yB - yA
    }
    if (sortBy === 'oldest_release') {
      const yA = a.year ?? 9999
      const yB = b.year ?? 9999
      if (yA === yB) return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      return yA - yB
    }
    return 0
  })
}

export function useWatchlist() {
  const { sortBy } = useUIStore()
  const items = useLiveQuery(async () => {
    const all = await db.items.toArray()
    return sortWatchlistItems(all, sortBy)
  }, [sortBy])
  return { items: items ?? [], isLoading: items === undefined }
}

export function useFilteredWatchlist(type?: MediaType, status?: Status | 'all') {
  const { sortBy } = useUIStore()
  const items = useLiveQuery(async () => {
    const all = await db.items.toArray()
    const filtered = all.filter((item) => {
      const typeMatch = !type || item.type === type
      const statusMatch = !status || status === 'all' || item.status === status
      return typeMatch && statusMatch
    })
    return sortWatchlistItems(filtered, sortBy)
  }, [type, status, sortBy])
  return items ?? []
}

export async function addToWatchlist(result: OMDbSearchResult): Promise<void> {
  const detail = await getOMDbDetail(result.imdbID)
  const genre = detail?.Genre ?? ''
  const type = detectMediaType(result, genre)

  const duplicate = await isDuplicateItem(result.Title, type, result.imdbID)
  if (duplicate) {
    alert(`"${result.Title}" is already in your watchlist!`)
    return
  }

  const genres = genre ? genre.split(', ') : []
  const year = result.Year ? parseInt(result.Year.split('–')[0]) : null
  const totalSeasons = detail?.totalSeasons ? parseInt(detail.totalSeasons) : null

  const newId = await addItem({
    imdbId: result.imdbID,
    title: result.Title,
    type,
    status: 'want_to_watch',
    posterUrl: parsePosterUrl(result.Poster),
    genres,
    year,
    imdbRating: detail ? parseRating(detail.imdbRating) : null,
    myRating: null,
    currentSeason: 1,
    currentEpisode: 0,
    totalSeasons,
    totalEpisodes: null,
    notes: '',
    overview: detail?.Plot ?? '',
  })

  const saved = await db.items.get(newId)
  if (saved) pushItem(saved).catch(() => {})
}

export async function addDetailToWatchlist(detail: OMDbDetail): Promise<void> {
  const type = detectMediaType(detail, detail.Genre)
  const duplicate = await isDuplicateItem(detail.Title, type, detail.imdbID)
  if (duplicate) {
    alert(`"${detail.Title}" is already in your watchlist!`)
    return
  }

  const genres = detail.Genre ? detail.Genre.split(', ') : []
  const year = detail.Year ? parseInt(detail.Year.split('–')[0]) : null

  const newId = await addItem({
    imdbId: detail.imdbID,
    title: detail.Title,
    type,
    status: 'want_to_watch',
    posterUrl: parsePosterUrl(detail.Poster),
    genres,
    year,
    imdbRating: parseRating(detail.imdbRating),
    myRating: null,
    currentSeason: 1,
    currentEpisode: 0,
    totalSeasons: detail.totalSeasons ? parseInt(detail.totalSeasons) : null,
    totalEpisodes: null,
    notes: '',
    overview: detail.Plot ?? '',
  })

  const saved = await db.items.get(newId)
  if (saved) pushItem(saved).catch(() => {})
}

export async function addSearchResultToWatchlist(result: TMDBSearchResult): Promise<void> {
  const type: MediaType =
    result.mediaType === 'movie' ? 'movie'
    : result.mediaType === 'anime' ? 'anime'
    : 'series'

  const duplicate = await isDuplicateItem(result.title, type, result.tmdbId)
  if (duplicate) {
    alert(`"${result.title}" is already in your watchlist!`)
    return
  }

  const year = result.year ? parseInt(result.year) : null

  const newId = await addItem({
    imdbId: result.tmdbId,
    title: result.title,
    type,
    status: 'want_to_watch',
    posterUrl: result.posterUrl,
    genres: [],
    year: isNaN(year as number) ? null : year,
    imdbRating: result.rating,
    myRating: null,
    currentSeason: 1,
    currentEpisode: 0,
    totalSeasons: null,
    totalEpisodes: null,
    notes: '',
    overview: result.overview,
  })

  const saved = await db.items.get(newId)
  if (saved) pushItem(saved).catch(() => {})
}

export async function addManualEntry(entry: {
  title: string
  year: string
  type: MediaType
}): Promise<void> {
  const title = entry.title.trim()
  const duplicate = await isDuplicateItem(title, entry.type)
  if (duplicate) {
    alert(`"${title}" is already in your watchlist!`)
    return
  }

  const syntheticId = `custom-${Date.now()}`
  const year = entry.year ? parseInt(entry.year) : null

  const newId = await addItem({
    imdbId: syntheticId,
    title,
    type: entry.type,
    status: 'want_to_watch',
    posterUrl: null,
    genres: [],
    year: isNaN(year as number) ? null : year,
    imdbRating: null,
    myRating: null,
    currentSeason: 1,
    currentEpisode: 0,
    totalSeasons: null,
    totalEpisodes: null,
    notes: '',
    overview: '',
  })

  const saved = await db.items.get(newId)
  if (saved) pushItem(saved).catch(() => {})
}

export async function cycleStatus(item: WatchlistItem, direction: 1 | -1 = 1): Promise<void> {
  const order: Status[] = ['want_to_watch', 'watching', 'up_to_date', 'finished', 'on_hold', 'dropped']
  const idx = order.indexOf(item.status)
  const next = order[Math.max(0, Math.min(order.length - 1, idx + direction))]
  await updateItem(item.id, { status: next })
  const updated = await db.items.get(item.id)
  if (updated) pushItem(updated).catch(() => {})
}

export async function setStatus(id: number, status: Status): Promise<void> {
  await updateItem(id, { status })
  const updated = await db.items.get(id)
  if (updated) pushItem(updated).catch(() => {})
}

export async function incrementEpisode(item: WatchlistItem): Promise<void> {
  await updateItem(item.id, {
    currentEpisode: item.currentEpisode + 1,
    status: item.status === 'want_to_watch' ? 'watching' : item.status,
  })
  const updated = await db.items.get(item.id)
  if (updated) pushItem(updated).catch(() => {})
}

export async function removeFromWatchlist(item: WatchlistItem): Promise<void> {
  await deleteItem(item.id)
  deleteItemFromCloud(item.imdbId).catch(() => {})
}

export { updateItem, deleteItem }
