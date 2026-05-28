'use client'

import { useUIStore, type SortOption } from '@/lib/store'
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
  const { statusFilter, sortBy, setSortBy } = useUIStore()
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

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-b border-white/5 bg-black/10">
        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">
          {items.length} title{items.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/30 font-medium">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-transparent text-[11px] font-semibold text-violet-400 outline-none cursor-pointer hover:text-violet-300 transition-colors border-none py-0.5 pr-1"
          >
            <option value="newest_added" className="bg-[#0f0f11] text-white">Recently Added</option>
            <option value="oldest_added" className="bg-[#0f0f11] text-white">Oldest Added</option>
            <option value="alphabetical_az" className="bg-[#0f0f11] text-white">Alphabetical (A-Z)</option>
            <option value="alphabetical_za" className="bg-[#0f0f11] text-white">Alphabetical (Z-A)</option>
            <option value="newest_release" className="bg-[#0f0f11] text-white">Release Year (Newest)</option>
            <option value="oldest_release" className="bg-[#0f0f11] text-white">Release Year (Oldest)</option>
          </select>
        </div>
      </div>

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
