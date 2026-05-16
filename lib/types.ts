export type MediaType = 'movie' | 'series' | 'anime' | 'documentary' | 'mini_series'

export type Status =
  | 'want_to_watch'
  | 'watching'
  | 'up_to_date'
  | 'finished'
  | 'on_hold'
  | 'dropped'

export interface WatchlistItem {
  id: number
  imdbId: string            // e.g. "tt1234567"
  title: string
  type: MediaType
  status: Status
  posterUrl: string | null  // full URL from OMDb (or null if N/A)
  genres: string[]
  year: number | null
  imdbRating: number | null
  myRating: number | null
  currentSeason: number
  currentEpisode: number
  totalSeasons: number | null
  totalEpisodes: number | null
  addedAt: Date
  updatedAt: Date
  notes: string
  overview: string
}

// OMDb search result (from ?s= endpoint)
export interface OMDbSearchResult {
  Title: string
  Year: string
  imdbID: string
  Type: 'movie' | 'series' | 'episode' | 'game'
  Poster: string  // full URL or 'N/A'
}

// OMDb detail result (from ?i= endpoint)
export interface OMDbDetail extends OMDbSearchResult {
  Genre: string       // "Action, Adventure, Sci-Fi"
  Plot: string
  imdbRating: string  // "8.5" or "N/A"
  totalSeasons?: string
  Response: 'True' | 'False'
  Error?: string
}

export const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  want_to_watch: { label: 'Want to Watch', color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
  watching:      { label: 'Watching',       color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  up_to_date:   { label: 'Up to Date',     color: 'text-amber-400',   bg: 'bg-amber-500/20' },
  finished:      { label: 'Finished',       color: 'text-violet-400',  bg: 'bg-violet-500/20' },
  on_hold:       { label: 'On Hold',        color: 'text-slate-400',   bg: 'bg-slate-500/20' },
  dropped:       { label: 'Dropped',        color: 'text-red-400',     bg: 'bg-red-500/20' },
}

export const STATUS_ORDER: Status[] = [
  'want_to_watch', 'watching', 'up_to_date', 'finished', 'on_hold', 'dropped',
]

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  movie:       'Movie',
  series:      'Series',
  anime:       'Anime',
  documentary: 'Documentary',
  mini_series: 'Mini-Series',
}
