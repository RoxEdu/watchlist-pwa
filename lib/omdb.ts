import type { OMDbSearchResult, OMDbDetail, MediaType } from './types'

async function omdbFetch<T>(params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(params).toString()
  const res = await fetch(`/api/omdb?${query}`)
  if (!res.ok) throw new Error(`OMDb error: ${res.status}`)
  return res.json()
}

export async function searchOMDb(
  query: string,
  type?: 'movie' | 'series',
): Promise<OMDbSearchResult[]> {
  const params: Record<string, string> = { s: query }
  if (type) params.type = type
  const data = await omdbFetch<{ Search?: OMDbSearchResult[]; Response: string }>(params)
  if (data.Response !== 'True') return []
  // Filter out episodes
  return (data.Search ?? []).filter((r) => r.Type !== 'episode' && r.Type !== 'game')
}

export async function getOMDbDetail(imdbId: string): Promise<OMDbDetail | null> {
  const data = await omdbFetch<OMDbDetail>({ i: imdbId, plot: 'short' })
  if (data.Response !== 'True') return null
  return data
}

export function detectMediaType(result: OMDbSearchResult, genre = ''): MediaType {
  if (result.Type === 'movie') {
    // Anime movies: genre includes Animation (e.g. "Your Name", "Spirited Away")
    if (genre.toLowerCase().includes('animation')) return 'movie'
    return 'movie'
  }
  // Series — detect anime by Animation genre
  if (genre.toLowerCase().includes('animation')) return 'anime'
  return 'series'
}

export function parsePosterUrl(poster: string): string | null {
  return poster && poster !== 'N/A' ? poster : null
}

export function parseRating(rating: string): number | null {
  const n = parseFloat(rating)
  return isNaN(n) ? null : n
}

// Curated popular titles for Discover tab — grouped by category
export const CURATED_IDS = {
  movies: [
    'tt4154796', // Avengers: Endgame
    'tt1375666', // Inception
    'tt0468569', // The Dark Knight
    'tt0816692', // Interstellar
    'tt6751668', // Parasite
    'tt0111161', // The Shawshank Redemption
    'tt8579674', // 1917
    'tt1160419', // Dune
  ],
  series: [
    'tt0903747', // Breaking Bad
    'tt0944947', // Game of Thrones
    'tt4574334', // Stranger Things
    'tt7366338', // Chernobyl
    'tt5753856', // Dark
    'tt10919420',// Squid Game
    'tt2861424', // Rick and Morty
    'tt3581920', // The Last of Us
  ],
  anime: [
    'tt2560140', // Attack on Titan
    'tt0988824', // Death Note
    'tt1355642', // Fullmetal Alchemist: Brotherhood
    'tt9335498', // Demon Slayer
    'tt0409591', // Naruto
    'tt4508902', // One Punch Man
    'tt10271680',// Jujutsu Kaisen
    'tt2098220', // Sword Art Online
  ],
}
