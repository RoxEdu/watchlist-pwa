'use client'

import { useState, useEffect } from 'react'
import { getOMDbDetail, CURATED_IDS } from '@/lib/omdb'
import { useWatchlist } from '@/hooks/useWatchlist'
import DiscoverCard from '@/components/DiscoverCard'
import type { OMDbDetail } from '@/lib/types'

type Category = 'movies' | 'series' | 'anime'

const CATEGORY_META: Record<Category, { label: string; emoji: string }> = {
  movies: { label: 'Movies',  emoji: '🎬' },
  series: { label: 'Series',  emoji: '📺' },
  anime:  { label: 'Anime',   emoji: '⭐' },
}

export default function DiscoverPage() {
  const [category, setCategory] = useState<Category>('movies')
  const [details, setDetails] = useState<Record<Category, OMDbDetail[]>>({
    movies: [], series: [], anime: [],
  })
  const [loading, setLoading] = useState<Record<Category, boolean>>({
    movies: false, series: false, anime: false,
  })
  const [loaded, setLoaded] = useState<Set<Category>>(new Set())
  const { items } = useWatchlist()
  const addedIds = new Set(items.map((i) => i.imdbId))

  useEffect(() => {
    if (loaded.has(category)) return
    setLoading((l) => ({ ...l, [category]: true }))

    const ids = CURATED_IDS[category]
    Promise.all(ids.map((id) => getOMDbDetail(id)))
      .then((results) => {
        const valid = results.filter((r): r is OMDbDetail => r !== null)
        setDetails((d) => ({ ...d, [category]: valid }))
        setLoaded((s) => new Set(s).add(category))
      })
      .catch(() => {})
      .finally(() => setLoading((l) => ({ ...l, [category]: false })))
  }, [category, loaded])

  const currentItems = details[category]
  const isLoading = loading[category]

  return (
    <div className="min-h-screen">
      <div className="px-4 pt-14 pb-4">
        <h1 className="text-white text-2xl font-bold">🧭 Discover</h1>
        <p className="text-white/30 text-sm mt-1">Popular picks · IMDb data</p>
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

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 px-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          {currentItems.map((detail) => (
            <DiscoverCard
              key={detail.imdbID}
              detail={detail}
              alreadyAdded={addedIds.has(detail.imdbID)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
