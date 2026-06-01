'use client'

import { useState, useEffect } from 'react'
import { getPopularMovies, getPopularSeries, getPopularAnime, getRecommendations } from '@/lib/tmdb'
import { useWatchlist } from '@/hooks/useWatchlist'
import DiscoverCard from '@/components/DiscoverCard'
import type { TMDBSearchResult } from '@/lib/tmdb'

type Category = 'movies' | 'series' | 'anime'

const CATEGORY_META: Record<Category, { label: string; emoji: string }> = {
  movies: { label: 'Movies', emoji: '🎬' },
  series: { label: 'Series', emoji: '📺' },
  anime:  { label: 'Anime',  emoji: '⭐' },
}

const FETCHERS: Record<Category, () => Promise<TMDBSearchResult[]>> = {
  movies: getPopularMovies,
  series: getPopularSeries,
  anime:  getPopularAnime,
}

export default function DiscoverPage() {
  const [category, setCategory] = useState<Category>('movies')
  const [details, setDetails] = useState<Record<Category, TMDBSearchResult[]>>({
    movies: [], series: [], anime: [],
  })
  const [loading, setLoading] = useState<Record<Category, boolean>>({
    movies: false, series: false, anime: false,
  })
  const [error, setError] = useState<Record<Category, string | null>>({
    movies: null, series: null, anime: null,
  })
  const [loaded, setLoaded] = useState<Set<Category>>(new Set())
  const { items } = useWatchlist()
  const addedIds = new Set(items.map((i) => i.imdbId))

  const [recs, setRecs] = useState<TMDBSearchResult[]>([])
  const [recsLoading, setRecsLoading] = useState(false)

  const itemsHash = items.map((i) => `${i.imdbId}-${i.myRating}`).join('|')

  useEffect(() => {
    setRecsLoading(true)
    getRecommendations(category, items)
      .then((results) => {
        setRecs(results)
      })
      .catch((err) => {
        console.error('Error fetching recommendations:', err)
        setRecs([])
      })
      .finally(() => {
        setRecsLoading(false)
      })
  }, [category, itemsHash])

  useEffect(() => {
    if (loaded.has(category)) return
    setLoading((l) => ({ ...l, [category]: true }))
    setError((e) => ({ ...e, [category]: null }))

    FETCHERS[category]()
      .then((results) => {
        setDetails((d) => ({ ...d, [category]: results }))
        setLoaded((s) => new Set(s).add(category))
      })
      .catch(() => {
        setError((e) => ({ ...e, [category]: "Couldn't load titles. Check your connection or try again." }))
      })
      .finally(() => setLoading((l) => ({ ...l, [category]: false })))
  }, [category, loaded])

  const currentItems = details[category]
  const isLoading = loading[category]
  const currentError = error[category]

  return (
    <div className="min-h-screen">
      <div className="px-4 pt-14 pb-4">
        <h1 className="text-white text-2xl font-bold">🧭 Discover</h1>
        <p className="text-white/30 text-sm mt-1">Popular picks · No API key needed</p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 px-4 mb-4">
        {(Object.keys(CATEGORY_META) as Category[]).map((cat) => {
          const m = CATEGORY_META[cat]
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                category === cat
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/8 text-white/50 hover:bg-white/12 hover:text-white'
              }`}
            >
              {m.emoji} {m.label}
            </button>
          )
        })}
      </div>

      {/* Recommendations Row */}
      {recsLoading ? (
        <div className="mb-6 px-4">
          <h2 className="text-white text-[15px] font-bold flex items-center gap-1.5 mb-3">
            ✨ Recommended for You
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-[130px] aspect-[2/3] rounded-xl bg-white/5 animate-pulse flex-shrink-0" />
            ))}
          </div>
        </div>
      ) : recs.length > 0 ? (
        <div className="mb-6 px-4">
          <h2 className="text-white text-[15px] font-bold flex items-center gap-1.5 mb-3">
            ✨ Recommended for You
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {recs.map((item) => (
              <div key={item.tmdbId} className="w-[130px] flex-shrink-0">
                <DiscoverCard
                  item={item}
                  alreadyAdded={addedIds.has(item.tmdbId)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Popular Picks Section */}
      <div className="px-4 mb-3">
        <h2 className="text-white text-[15px] font-bold">🔥 Popular Picks</h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 px-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : currentError ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-white/50 text-sm">{currentError}</p>
          <button
            onClick={() => setLoaded((s) => { const n = new Set(s); n.delete(category); return n })}
            className="mt-4 rounded-full bg-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/15"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          {currentItems.map((item) => (
            <DiscoverCard
              key={item.tmdbId}
              item={item}
              alreadyAdded={addedIds.has(item.tmdbId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
