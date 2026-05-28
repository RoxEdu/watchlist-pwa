// No API key required — uses iTunes, TVMaze, and Jikan (MyAnimeList)

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
    const res = await fetch(`https://itunes.apple.com/search?${params}`)
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
}

async function tvMazeSearch(query: string, limit = 8): Promise<TMDBSearchResult[]> {
  try {
    const res = await fetch(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`,
    )
    if (!res.ok) return []
    const data: Array<{ show: TVMazeShow }> = await res.json()
    return data.slice(0, limit).map(({ show }) => ({
      tmdbId: show.externals?.imdb || `tvmaze-${show.id}`,
      title: show.name,
      year: yearFrom(show.premiered),
      mediaType: 'tv' as const,
      posterUrl: show.image?.medium ?? null,
      overview: show.summary?.replace(/<[^>]+>/g, '') ?? '',
      rating: show.rating?.average ?? null,
    }))
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

  // Deduplicate by ID and normalized title
  const seenIds = new Set<string>()
  const seenTitles = new Set<string>()
  const deduped: TMDBSearchResult[] = []

  for (const item of out) {
    if (item.tmdbId.startsWith('tt')) {
      if (seenIds.has(item.tmdbId)) continue
      seenIds.add(item.tmdbId)
    }
    const normTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, '')
    const titleKey = `${normTitle}-${item.mediaType}`
    if (seenTitles.has(titleKey)) {
      const existingIdx = deduped.findIndex(
        (d) =>
          d.title.toLowerCase().replace(/[^a-z0-9]/g, '') === normTitle &&
          d.mediaType === item.mediaType,
      )
      if (existingIdx !== -1) {
        const existing = deduped[existingIdx]
        if (item.tmdbId.startsWith('tt') && !existing.tmdbId.startsWith('tt')) {
          deduped[existingIdx] = item
        }
      }
      continue
    }
    seenTitles.add(titleKey)
    deduped.push(item)
  }

  return deduped
}

const CURATED_MOVIES = [
  'Dune Part Two 2024',
  'Dunkirk (2017)',
  'Barbie 2023',
  'The Dark Knight',
  'Interstellar',
  'Spider-Man: Across the Spider-Verse',
  'Knives Out',
  'Spider-Man: No Way Home',
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
    const res = await fetch('https://api.jikan.moe/v4/top/anime?type=tv&limit=12')
    if (!res.ok) return []
    const json: { data: JikanAnime[] } = await res.json()
    return (json.data ?? []).map(mapJikan)
  } catch {
    return []
  }
}
