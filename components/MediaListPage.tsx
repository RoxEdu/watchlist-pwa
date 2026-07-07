'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X } from 'lucide-react'
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

  const [searchQuery, setSearchQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(20)
  const triggerRef = useRef<HTMLDivElement>(null)

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase().trim()
    return items.filter((item) => item.title.toLowerCase().includes(q))
  }, [items, searchQuery])

  // Reset pagination when filter, sort, type, or search changes
  useEffect(() => {
    setVisibleCount(20)
  }, [type, statusFilter, sortBy, searchQuery])

  // Infinite scroll observer
  useEffect(() => {
    if (!triggerRef.current || visibleCount >= filteredItems.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(filteredItems.length, prev + 20))
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(triggerRef.current)
    return () => observer.disconnect()
  }, [filteredItems.length, visibleCount])

  const visibleItems = filteredItems.slice(0, visibleCount)

  return (
    <div className="min-h-screen">
      <div className="px-4 pt-14 pb-4">
        <h1 className="text-white text-2xl font-bold">
          {emoji} {title}
        </h1>
        <p className="text-white/30 text-sm mt-1">{items.length} titles</p>
      </div>

      {/* Watchlist search bar */}
      <div className="px-4 mb-4">
        <div className="relative flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-violet-500/60 focus-within:bg-white/8 transition-all">
          <Search size={16} className="text-white/30 flex-shrink-0 mr-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            className="bg-transparent text-sm text-white placeholder:text-white/30 outline-none w-full"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-white/40 hover:text-white ml-2 flex-shrink-0"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <FilterBar />

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-b border-white/5 bg-black/10">
        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">
          {filteredItems.length} title{filteredItems.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/30 font-medium">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-transparent text-[11px] font-semibold text-violet-400 outline-none cursor-pointer hover:text-violet-300 transition-colors border-none py-0.5 pr-1"
          >
            <option value="status_priority" className="bg-[#0f0f11] text-white">Smart (by Status)</option>
            <option value="newest_added" className="bg-[#0f0f11] text-white">Recently Added</option>
            <option value="oldest_added" className="bg-[#0f0f11] text-white">Oldest Added</option>
            <option value="my_rating_desc" className="bg-[#0f0f11] text-white">My Rating (High-Low)</option>
            <option value="imdb_rating_desc" className="bg-[#0f0f11] text-white">IMDb Rating (High-Low)</option>
            <option value="alphabetical_az" className="bg-[#0f0f11] text-white">Alphabetical (A-Z)</option>
            <option value="alphabetical_za" className="bg-[#0f0f11] text-white">Alphabetical (Z-A)</option>
            <option value="newest_release" className="bg-[#0f0f11] text-white">Release Year (Newest)</option>
            <option value="oldest_release" className="bg-[#0f0f11] text-white">Release Year (Oldest)</option>
          </select>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="text-5xl mb-4">{searchQuery ? '🔍' : emoji}</div>
          <p className="text-white/40 text-sm">
            {searchQuery
              ? `No matches found for "${searchQuery}"`
              : `Nothing here yet — tap + to add some ${title.toLowerCase()}.`}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 px-4 py-4">
            {visibleItems.map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>

          {/* Infinite Scroll Trigger */}
          {visibleCount < filteredItems.length && (
            <div ref={triggerRef} className="w-full h-12 flex items-center justify-center py-4">
              <div className="h-5 w-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            </div>
          )}
        </>
      )}
    </div>
  )
}

