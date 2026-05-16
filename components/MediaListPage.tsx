'use client'

import { useUIStore } from '@/lib/store'
import { useFilteredWatchlist } from '@/hooks/useWatchlist'
import MediaCard from '@/components/MediaCard'
import FilterBar from '@/components/FilterBar'
import type { MediaType } from '@/lib/types'

interface MediaListPageProps {
  type: MediaType
  title: string
  emoji: string
}

export default function MediaListPage({ type, title, emoji }: MediaListPageProps) {
  const { statusFilter } = useUIStore()
  const items = useFilteredWatchlist(type, statusFilter)

  return (
    <div className="min-h-screen">
      <div className="px-4 pt-14 pb-4">
        <h1 className="text-white text-2xl font-bold">
          {emoji} {title}
        </h1>
        <p className="text-white/30 text-sm mt-1">{items.length} titles</p>
      </div>

      <FilterBar />

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="text-5xl mb-4">{emoji}</div>
          <p className="text-white/40 text-sm">Nothing here yet — tap + to add some {title.toLowerCase()}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 py-4">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
