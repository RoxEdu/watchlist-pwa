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
    if (sortBy === 'my_rating_desc') {
      const rA = a.myRating ?? 0
      const rB = b.myRating ?? 0
      if (rA === rB) return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      return rB - rA
    }
    if (sortBy === 'imdb_rating_desc') {
      const rA = a.imdbRating ?? 0
      const rB = b.imdbRating ?? 0
      if (rA === rB) return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      return rB - rA
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

// Cache of show/anime ID -> season episode counts
const metadataCache: Record<string, Record<number, number>> = {}

export async function getEpisodesInSeason(
  imdbId: string,
  type: MediaType,
  season: number
): Promise<number | null> {
  if (!imdbId) return null
  
  if (metadataCache[imdbId]) {
    return metadataCache[imdbId][season] ?? null
  }
  
  try {
    const cached = localStorage.getItem(`episodes_${imdbId}`)
    if (cached) {
      const parsed = JSON.parse(cached)
      metadataCache[imdbId] = parsed
      return parsed[season] ?? null
    }
  } catch {}

  try {
    const seasonMap: Record<number, number> = {}
    
    if (imdbId.startsWith('tt')) {
      const lookupRes = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${imdbId}`)
      if (lookupRes.ok) {
        const show = await lookupRes.json()
        const showId = show.id
        const epsRes = await fetch(`https://api.tvmaze.com/shows/${showId}/episodes`)
        if (epsRes.ok) {
          const episodes = await epsRes.json()
          episodes.forEach((ep: any) => {
            const s = ep.season ?? 1
            seasonMap[s] = (seasonMap[s] ?? 0) + 1
          })
        }
      }
    } else if (imdbId.startsWith('jikan-')) {
      const malId = imdbId.replace('jikan-', '')
      const malRes = await fetch(`https://api.jikan.moe/v4/anime/${malId}`)
      if (malRes.ok) {
        const json = await malRes.json()
        const totalEp = json.data?.episodes ?? null
        if (totalEp) {
          seasonMap[1] = totalEp
        }
      }
    } else if (imdbId.startsWith('tvmaze-')) {
      const showId = imdbId.replace('tvmaze-', '')
      const epsRes = await fetch(`https://api.tvmaze.com/shows/${showId}/episodes`)
      if (epsRes.ok) {
        const episodes = await epsRes.json()
        episodes.forEach((ep: any) => {
          const s = ep.season ?? 1
          seasonMap[s] = (seasonMap[s] ?? 0) + 1
        })
      }
    }

    if (Object.keys(seasonMap).length > 0) {
      metadataCache[imdbId] = seasonMap
      try {
        localStorage.setItem(`episodes_${imdbId}`, JSON.stringify(seasonMap))
      } catch {}
      return seasonMap[season] ?? null
    }
  } catch (err) {
    console.error('Error fetching season/episode metadata:', err)
  }

  return null
}

export async function incrementEpisode(item: WatchlistItem): Promise<void> {
  let nextEpisode = item.currentEpisode + 1
  let nextSeason = item.currentSeason

  const episodesInCurrentSeason = await getEpisodesInSeason(item.imdbId, item.type, item.currentSeason)
  if (episodesInCurrentSeason !== null && nextEpisode > episodesInCurrentSeason) {
    nextSeason = item.currentSeason + 1
    nextEpisode = 1
  }

  await updateItem(item.id, {
    currentSeason: nextSeason,
    currentEpisode: nextEpisode,
    status: item.status === 'want_to_watch' ? 'watching' : item.status,
  })
  const updated = await db.items.get(item.id)
  if (updated) pushItem(updated).catch(() => {})
}

export async function removeFromWatchlist(item: WatchlistItem): Promise<void> {
  await deleteItem(item.id)
  deleteItemFromCloud(item.imdbId).catch(() => {})
}

export async function syncWatchlistMetadata(
  onProgress: (msg: string) => void
): Promise<{ updatedCount: number; newSeasons: string[] }> {
  const allItems = await db.items.toArray()
  const shows = allItems.filter(
    (item) => item.type === 'series' || item.type === 'anime' || item.type === 'mini_series'
  )

  let updatedCount = 0
  const newSeasons: string[] = []

  for (let i = 0; i < shows.length; i++) {
    const show = shows[i]
    onProgress(`Checking (${i + 1}/${shows.length}): "${show.title}"...`)

    try {
      if (show.imdbId && show.imdbId.startsWith('tt')) {
        // TVMaze Lookup
        const lookupRes = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${show.imdbId}`)
        if (lookupRes.ok) {
          const showData = await lookupRes.json()
          const tvmazeId = showData.id
          
          // Fetch Seasons
          const seasonsRes = await fetch(`https://api.tvmaze.com/shows/${tvmazeId}/seasons`)
          if (seasonsRes.ok) {
            const seasonsList = await seasonsRes.json()
            const totalSeasons = seasonsList.length
            
            const now = new Date()
            let hasUpcomingSeason = false
            seasonsList.forEach((s: any) => {
              if (s.premiereDate) {
                const prem = new Date(s.premiereDate)
                if (prem > now) hasUpcomingSeason = true
              }
            })

            const oldTotal = show.totalSeasons ?? 0
            if (totalSeasons > oldTotal || hasUpcomingSeason) {
              let msg = show.title
              if (totalSeasons > oldTotal) {
                msg += ` (Season ${totalSeasons} is available)`
              } else if (hasUpcomingSeason) {
                msg += ` (New season announced)`
              }
              if (!newSeasons.includes(msg)) newSeasons.push(msg)
            }

            if (totalSeasons !== show.totalSeasons) {
              await updateItem(show.id, { totalSeasons })
              updatedCount++
            }
          }
        }
      } else if (show.imdbId && show.imdbId.startsWith('jikan-')) {
        const malId = show.imdbId.replace('jikan-', '')
        
        // Delay to prevent MAL Jikan rate limits
        await new Promise((resolve) => setTimeout(resolve, 800))
        
        // Fetch Anime Details
        const animeRes = await fetch(`https://api.jikan.moe/v4/anime/${malId}`)
        if (animeRes.ok) {
          const json = await animeRes.json()
          const episodes = json.data?.episodes ?? null
          
          if (episodes !== show.totalEpisodes) {
            await updateItem(show.id, { totalEpisodes: episodes })
            updatedCount++
          }

          // Delay before relations fetch
          await new Promise((resolve) => setTimeout(resolve, 800))
          
          const relationsRes = await fetch(`https://api.jikan.moe/v4/anime/${malId}/relations`)
          if (relationsRes.ok) {
            const relationsJson = await relationsRes.json()
            const hasSequel = (relationsJson.data ?? []).some(
              (rel: any) => rel.relation === 'Sequel'
            )
            if (hasSequel) {
              const msg = `${show.title} (New season/sequel announced)`
              if (!newSeasons.includes(msg)) newSeasons.push(msg)
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error updating metadata for ${show.title}:`, err)
    }
  }

  // Reload local detailItem if open
  try {
    const detailItem = useUIStore.getState().detailItem
    if (detailItem) {
      const refreshed = await db.items.get(detailItem.id)
      if (refreshed) useUIStore.getState().setDetailItem(refreshed)
    }
  } catch {}

  return { updatedCount, newSeasons }
}

export { updateItem, deleteItem }
