'use client'

import { useState, useEffect, useRef } from 'react'
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

  const [visibleCount, setVisibleCount] = useState(20)
  const triggerRef = useRef<HTMLDivElement>(null)

  // Reset pagination when filter, sort, or type changes
  useEffect(() => {
    setVisibleCount(20)
  }, [type, statusFilter, sortBy])

  // Infinite scroll observer
  useEffect(() => {
    if (!triggerRef.current || visibleCount >= items.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(items.length, prev + 20))
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(triggerRef.current)
    return () => observer.disconnect()
  }, [items.length, visibleCount])

  const visibleItems = items.slice(0, visibleCount)

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
        <>
          <div className="grid grid-cols-2 gap-3 px-4 py-4">
            {visibleItems.map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>

          {/* Infinite Scroll Trigger */}
          {visibleCount < items.length && (
            <div ref={triggerRef} className="w-full h-12 flex items-center justify-center py-4">
              <div className="h-5 w-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            </div>
          )}
        </>
      )}
    </div>
  )
}
