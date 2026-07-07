'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Plus, Check, Loader2 } from 'lucide-react'
import type { TMDBSearchResult } from '@/lib/tmdb'
import { addSearchResultToWatchlist } from '@/hooks/useWatchlist'

interface DiscoverCardProps {
  item: TMDBSearchResult
  alreadyAdded?: boolean
}

export default function DiscoverCard({ item, alreadyAdded = false }: DiscoverCardProps) {
  const [added, setAdded] = useState(alreadyAdded)
  const [loading, setLoading] = useState(false)
  const [imgBroken, setImgBroken] = useState(false)

  const typeLabel =
    item.mediaType === 'movie' ? 'Movie'
    : item.mediaType === 'anime' ? 'Anime'
    : 'Series'

  async function handleAdd() {
    if (added || loading) return
    setLoading(true)
    try {
      await addSearchResultToWatchlist(item)
      setAdded(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative bg-[#141414] rounded-xl overflow-hidden">
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#1a1a1a]">
        {item.posterUrl && !imgBroken ? (
          <Image
            src={item.posterUrl}
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 33vw"
            onError={() => setImgBroken(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/20 text-4xl">🎬</div>
        )}
        {item.rating != null && (
          <div className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-amber-400">
            ★ {item.rating}
          </div>
        )}
        <button
          onClick={handleAdd}
          disabled={added || loading}
          className={`absolute bottom-2 right-2 flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold shadow-lg transition-all ${
            added ? 'bg-emerald-600/80 text-white' : 'bg-violet-600 text-white hover:bg-violet-500'
          }`}
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : added ? <Check size={11} /> : <Plus size={11} />}
          {added ? 'Added' : loading ? '' : 'Add'}
        </button>
      </div>
      <div className="p-2.5">
        <p className="text-white text-xs font-semibold leading-tight truncate">{item.title}</p>
        <p className="text-white/40 text-[10px] mt-0.5">
          {typeLabel}{item.year ? ` · ${item.year}` : ''}
        </p>
      </div>
    </div>
  )
}
