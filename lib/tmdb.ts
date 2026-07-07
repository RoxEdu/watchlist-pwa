// No API key required — uses iTunes, TVMaze, and Jikan (MyAnimeList)
import type { WatchlistItem } from './types'
import { CURATED_POOL_MOVIES, CURATED_POOL_SERIES, CURATED_POOL_ANIME } from './curated_pools'
import type { CuratedItem } from './curated_pools'

export interface TMDBSearchResult {
  tmdbId: string
  title: string
  year: string | null
  mediaType: 'movie' | 'tv' | 'anime'
  posterUrl: string | null
  overview: string
  rating: number | null
}

// ─── iTunes (movies) ──────────────────────────────────────────────────────────

function scaleItunes(url: string): string {
  // Scale Apple artwork to portrait movie-poster dimensions
  return url.replace(/\d+x\d+bb/, '300x450bb')
}

function yearFrom(dateStr?: string | null): string | null {
  if (!dateStr) return null
  return dateStr.split('T')[0]?.split('-')[0] ?? null
}

async function searchItunesMovies(query: string, limit = 8): Promise<TMDBSearchResult[]> {
  try {
    const params = new URLSearchParams({
      term: query,
      limit: String(Math.max(30, limit * 4)),
      country: 'us',
    })
    // iTunes has no CORS headers → in the browser go through our proxy route.
    // On the server we can hit iTunes directly.
    const url =
      typeof window === 'undefined'
        ? `https://itunes.apple.com/search?${params}`
        : `/api/itunes?${params}`
    const res = await fetch(url)
    if (!res.ok) return []
    const json = await res.json()
    const rawResults = json.results ?? []
    return rawResults
      .filter((r: any) => r.kind === 'feature-movie')
      .slice(0, limit)
      .map((r: Record<string, unknown>) => ({
        tmdbId: `itunes-movie-${r.trackId}`,
        title: String(r.trackName ?? ''),
        year: yearFrom(r.releaseDate as string),
        mediaType: 'movie' as const,
        posterUrl: r.artworkUrl100 ? scaleItunes(r.artworkUrl100 as string) : null,
        overview: String(r.longDescription ?? r.shortDescription ?? ''),
        rating: null,
      }))
  } catch {
    return []
  }
}

// ─── TVMaze (TV series) ───────────────────────────────────────────────────────

interface TVMazeShow {
  id: number
  name: string
  premiered?: string | null
  image?: { medium: string } | null
  summary?: string | null
  rating?: { average: number | null }
  externals?: { imdb?: string | null }
  language?: string | null
  genres?: string[] | null
  type?: string | null
}

async function tvMazeSearch(query: string, limit = 8): Promise<TMDBSearchResult[]> {
  try {
    const res = await fetch(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`,
    )
    if (!res.ok) return []
    const data: Array<{ show: TVMazeShow }> = await res.json()
    return data.slice(0, limit).map(({ show }) => {
      const isAnime =
        show.language === 'Japanese' ||
        show.genres?.includes('Anime') ||
        show.type === 'Animation'

      return {
        tmdbId: show.externals?.imdb || `tvmaze-${show.id}`,
        title: show.name,
        year: yearFrom(show.premiered),
        mediaType: isAnime ? ('anime' as const) : ('tv' as const),
        posterUrl: show.image?.medium ?? null,
        overview: show.summary?.replace(/<[^>]+>/g, '') ?? '',
        rating: show.rating?.average ?? null,
      }
    })
  } catch {
    return []
  }
}

// ─── Jikan (anime via MyAnimeList) ───────────────────────────────────────────

interface JikanAnime {
  mal_id: number
  title: string
  title_english?: string
  year?: number
  images: { jpg: { image_url: string; large_image_url?: string } }
  synopsis?: string
  score?: number
}

function mapJikan(a: JikanAnime): TMDBSearchResult {
  return {
    tmdbId: `jikan-${a.mal_id}`,
    title: a.title_english ?? a.title,
    year: a.year ? String(a.year) : null,
    mediaType: 'anime',
    posterUrl: a.images?.jpg?.large_image_url ?? a.images?.jpg?.image_url ?? null,
    overview: a.synopsis ?? '',
    rating: a.score ?? null,
  }
}

async function searchJikanAnime(query: string, limit = 6): Promise<TMDBSearchResult[]> {
  try {
    const res = await fetch(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=${limit}`,
    )
    if (!res.ok) return []
    const json: { data: JikanAnime[] } = await res.json()
    return (json.data ?? []).map(mapJikan)
  } catch {
    return []
  }
}

// ─── IMDb Suggestions (keyless autocomplete) ──────────────────────────────────

interface ImdbSuggestionItem {
  id: string
  l: string
  q?: string
  qid?: string
  s?: string
  y?: number
  i?: [string, number, number]
}

function mapImdb(item: ImdbSuggestionItem): TMDBSearchResult {
  let mediaType: 'movie' | 'tv' | 'anime' = 'movie'
  if (item.qid === 'tvSeries' || item.qid === 'tvMiniSeries') {
    mediaType = 'tv'
  }
  return {
    tmdbId: item.id,
    title: item.l,
    year: item.y ? String(item.y) : null,
    mediaType,
    posterUrl: item.i ? item.i[0] : null,
    overview: item.s ? `Starring: ${item.s}` : '',
    rating: null,
  }
}

async function searchImdb(query: string, limit = 8): Promise<TMDBSearchResult[]> {
  try {
    const cleanQuery = query.toLowerCase().trim()
    if (!cleanQuery) return []
    
    const res = await fetch(`/api/imdb?q=${encodeURIComponent(cleanQuery)}`)
    if (!res.ok) return []
    const items: ImdbSuggestionItem[] = await res.json()
    
    return items
      .filter((item) => {
        if (!item.id.startsWith('tt')) return false
        if (item.qid === 'videoGame' || item.q === 'video game') return false
        return true
      })
      .slice(0, limit)
      .map(mapImdb)
  } catch {
    return []
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Unified search: IMDb suggests + iTunes movies + TVMaze shows + Jikan anime, interleaved & deduped
export async function searchTMDB(query: string): Promise<TMDBSearchResult[]> {
  const [imdbResults, movies, shows, anime] = await Promise.all([
    searchImdb(query, 8),
    searchItunesMovies(query, 6),
    tvMazeSearch(query, 6),
    searchJikanAnime(query, 6),
  ])
  const out: TMDBSearchResult[] = []
  const max = Math.max(imdbResults.length, movies.length, shows.length, anime.length)
  for (let i = 0; i < max; i++) {
    if (imdbResults[i]) out.push(imdbResults[i])
    if (movies[i]) out.push(movies[i])
    if (shows[i]) out.push(shows[i])
    if (anime[i]) out.push(anime[i])
  }

  // 1. Group by ID first to merge metadata for the same ID (e.g. IMDb vs TVMaze vs Jikan)
  const idMap = new Map<string, TMDBSearchResult>()
  for (const item of out) {
    const id = item.tmdbId
    const existing = idMap.get(id)
    if (existing) {
      const merged = { ...existing }
      const newIsAnime = item.mediaType === 'anime'
      const oldIsAnime = existing.mediaType === 'anime'

      if (newIsAnime && !oldIsAnime) {
        merged.mediaType = 'anime'
      } else if (item.mediaType === 'tv' && merged.mediaType === 'movie') {
        merged.mediaType = 'tv'
      }

      merged.title = existing.title || item.title
      merged.posterUrl = existing.posterUrl || item.posterUrl
      merged.overview = existing.overview || item.overview
      merged.rating = existing.rating || item.rating
      idMap.set(id, merged)
    } else {
      idMap.set(id, item)
    }
  }

  // 2. Deduplicate/merge by normalized title + mediaType
  const mergedMap = new Map<string, TMDBSearchResult>()
  for (const item of idMap.values()) {
    const normTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!normTitle) continue

    const key = `${normTitle}_${item.mediaType}`
    const existing = mergedMap.get(key)
    if (existing) {
      let preferred = existing
      if (item.tmdbId.startsWith('tt') && !existing.tmdbId.startsWith('tt')) {
        preferred = {
          ...item,
          posterUrl: item.posterUrl || existing.posterUrl,
          overview: item.overview || existing.overview,
          rating: item.rating || existing.rating,
        }
      } else {
        preferred = {
          ...existing,
          posterUrl: existing.posterUrl || item.posterUrl,
          overview: existing.overview || item.overview,
          rating: existing.rating || item.rating,
        }
      }
      mergedMap.set(key, preferred)
    } else {
      mergedMap.set(key, item)
    }
  }

  return Array.from(mergedMap.values())
}

const CURATED_MOVIES = [
  'Dune Part Two 2024',
  'Oppenheimer 2023',
  'Barbie 2023',
  'The Dark Knight',
  'Interstellar',
  'Spider-Man: Across the Spider-Verse',
  'Knives Out',
  'Spider-Man: No Way Home',
  'Inception',
  'Everything Everywhere All at Once',
  'The Batman 2022',
  'Top Gun: Maverick',
  'Parasite 2019',
  'Joker 2019',
  'Avengers: Endgame',
  'John Wick 4',
  'Whiplash',
  'La La Land',
  'The Godfather',
  'Pulp Fiction',
  'Fight Club',
  'The Wolf of Wall Street',
  'Gladiator',
  'Guardians of the Galaxy Vol 3',
]

export async function getPopularMovies(): Promise<TMDBSearchResult[]> {
  const settled = await Promise.allSettled(
    CURATED_MOVIES.map(async (q) => {
      const r = await searchItunesMovies(q, 1)
      return r[0] ?? null
    }),
  )
  const seen = new Set<string>()
  return settled
    .filter(
      (r): r is PromiseFulfilledResult<TMDBSearchResult> =>
        r.status === 'fulfilled' && r.value != null,
    )
    .map((r) => r.value!)
    .filter((r) => {
      if (seen.has(r.tmdbId)) return false
      seen.add(r.tmdbId)
      return true
    })
}

// Discover — series: search TVMaze for curated hit shows
const CURATED_SERIES = [
  'Breaking Bad',
  'Game of Thrones',
  'Stranger Things',
  'Chernobyl',
  'Dark',
  'Squid Game',
  'Rick and Morty',
  'The Last of Us',
  'The Bear',
  'Better Call Saul',
  'Succession',
  'The Boys',
  'House of the Dragon',
  'True Detective',
  'Peaky Blinders',
  'Wednesday',
  'Severance',
  'The Mandalorian',
  'Fargo',
  'Sherlock',
  'Westworld',
  'Loki',
  'The Witcher',
  'Money Heist',
]

export async function getPopularSeries(): Promise<TMDBSearchResult[]> {
  const settled = await Promise.allSettled(
    CURATED_SERIES.map(async (q) => {
      const r = await tvMazeSearch(q, 1)
      return r[0] ?? null
    }),
  )
  return settled
    .filter(
      (r): r is PromiseFulfilledResult<TMDBSearchResult> =>
        r.status === 'fulfilled' && r.value != null,
    )
    .map((r) => r.value!)
}

// Discover — anime: Jikan top anime (single request)
export async function getPopularAnime(): Promise<TMDBSearchResult[]> {
  try {
    const res = await fetch('https://api.jikan.moe/v4/top/anime?type=tv&limit=24')
    if (!res.ok) return []
    const json: { data: JikanAnime[] } = await res.json()
    return (json.data ?? []).map(mapJikan)
  } catch {
    return []
  }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export async function getRecommendations(
  category: 'movies' | 'series' | 'anime',
  watchlistItems: WatchlistItem[]
): Promise<TMDBSearchResult[]> {
  const watchedTitles = new Set(watchlistItems.map(item => normalizeTitle(item.title)))
  const watchedImdbIds = new Set(watchlistItems.map(item => item.imdbId))

  const isAlreadyWatched = (title: string, id: string) => {
    return watchedImdbIds.has(id) || watchedTitles.has(normalizeTitle(title))
  }

  // 1. ANIME: Try live Jikan Recommendations API first
  if (category === 'anime') {
    const userAnime = watchlistItems.filter(
      item => item.type === 'anime' && item.myRating && item.myRating >= 4
    )

    if (userAnime.length > 0) {
      // Sort by rating descending, then updated time descending
      const sortedFavorites = [...userAnime].sort((a, b) => {
        const ratingDiff = (b.myRating || 0) - (a.myRating || 0)
        if (ratingDiff !== 0) return ratingDiff
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })

      // Take the top favorite that has a Jikan ID
      const target = sortedFavorites.find(item => item.imdbId && item.imdbId.startsWith('jikan-'))
      if (target) {
        const malId = target.imdbId.replace('jikan-', '')
        try {
          const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}/recommendations`)
          if (res.ok) {
            const json = await res.json()
            const recsData = json.data ?? []

            // Map and filter
            const mappedRecs: TMDBSearchResult[] = recsData
              .map((r: any) => ({
                tmdbId: `jikan-${r.entry.mal_id}`,
                title: r.entry.title,
                year: null,
                mediaType: 'anime' as const,
                posterUrl: r.entry.images?.jpg?.large_image_url || r.entry.images?.jpg?.image_url || null,
                overview: `Recommended based on your interest in ${target.title}.`,
                rating: null,
              }))
              .filter((r: TMDBSearchResult) => !isAlreadyWatched(r.title, r.tmdbId))

            if (mappedRecs.length > 0) {
              return mappedRecs.slice(0, 8)
            }
          }
        } catch (err) {
          console.error('Error fetching Jikan live recommendations:', err)
        }
      }
    }

    // Fallback to static genre match for anime
    return getGenreRecommendations(CURATED_POOL_ANIME, watchlistItems, 'anime', isAlreadyWatched)
  }

  // 2. MOVIES & SERIES: Content-based genre overlap matching
  if (category === 'movies') {
    return getGenreRecommendations(CURATED_POOL_MOVIES, watchlistItems, 'movie', isAlreadyWatched)
  } else {
    return getGenreRecommendations(CURATED_POOL_SERIES, watchlistItems, 'series', isAlreadyWatched)
  }
}

function getGenreRecommendations(
  pool: CuratedItem[],
  watchlistItems: WatchlistItem[],
  type: 'movie' | 'series' | 'anime',
  isAlreadyWatched: (title: string, id: string) => boolean
): TMDBSearchResult[] {
  // Collect user's favorite genres for this category
  const categoryItems = watchlistItems.filter(
    item => {
      if (type === 'movie') return item.type === 'movie'
      if (type === 'series') return item.type === 'series' || item.type === 'mini_series'
      return item.type === 'anime'
    }
  )

  const highRatedItems = categoryItems.filter(item => item.myRating && item.myRating >= 4)
  const referenceItems = highRatedItems.length > 0 ? highRatedItems : categoryItems

  // Calculate genre weights
  const genreWeights: Record<string, number> = {}
  referenceItems.forEach(item => {
    const weight = item.myRating ? item.myRating : 3 // default weight 3 if not rated
    item.genres.forEach(g => {
      const cleanGenre = g.trim()
      genreWeights[cleanGenre] = (genreWeights[cleanGenre] || 0) + weight
    })
  })

  // Filter pool items
  const candidates = pool.filter(item => !isAlreadyWatched(item.title, item.tmdbId))

  // Score candidates
  const scored = candidates.map(item => {
    let score = 0
    item.genres.forEach(g => {
      if (genreWeights[g]) {
        score += genreWeights[g]
      }
    })
    
    // Add small rating multiplier to break ties
    if (item.rating) {
      score += item.rating * 0.1
    }

    return { item, score }
  })

  // Sort by score descending, then rating descending
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (b.item.rating || 0) - (a.item.rating || 0)
  })

  // Map back to TMDBSearchResult
  return scored.slice(0, 8).map(({ item }) => ({
    tmdbId: item.tmdbId,
    title: item.title,
    year: item.year,
    mediaType: item.mediaType === 'tv' ? 'tv' : item.mediaType,
    posterUrl: item.posterUrl,
    overview: item.overview,
    rating: item.rating
  }))
}

