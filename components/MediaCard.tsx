'use client'

import { useRef } from 'react'
import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion'
import Image from 'next/image'
import { Plus, ChevronRight } from 'lucide-react'
import { STATUS_META, type WatchlistItem } from '@/lib/types'
import { useUIStore } from '@/lib/store'
import { cycleStatus, incrementEpisode } from '@/hooks/useWatchlist'
import { cn } from '@/lib/utils'

interface MediaCardProps {
  item: WatchlistItem
}

const isSeries = (item: WatchlistItem) =>
  item.type === 'series' || item.type === 'anime' || item.type === 'mini_series'

export default function MediaCard({ item }: MediaCardProps) {
  const { setDetailItem, setStatusPickerItem } = useUIStore()
  const controls = useAnimation()
  const x = useMotionValue(0)
  const dragHandled = useRef(false)

  const swipeBg = useTransform(x, [-100, 0, 100], ['#ef4444', 'transparent', '#10b981'])
  const swipeOpacity = useTransform(x, [-80, -20, 0, 20, 80], [1, 0, 0, 0, 1])
  const meta = STATUS_META[item.status]
  const series = isSeries(item)

  async function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (dragHandled.current) return
    if (info.offset.x > 80) {
      dragHandled.current = true
      await controls.start({ x: 120, opacity: 0, transition: { duration: 0.15 } })
      await cycleStatus(item, 1)
      await controls.start({ x: 0, opacity: 1, transition: { duration: 0 } })
      dragHandled.current = false
    } else if (info.offset.x < -80) {
      dragHandled.current = true
      await controls.start({ x: -120, opacity: 0, transition: { duration: 0.15 } })
      await cycleStatus(item, -1)
      await controls.start({ x: 0, opacity: 1, transition: { duration: 0 } })
      dragHandled.current = false
    } else {
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } })
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <motion.div
        className="absolute inset-0 rounded-xl flex items-center justify-between px-4 pointer-events-none"
        style={{ backgroundColor: swipeBg, opacity: swipeOpacity }}
      >
        <span className="text-white text-xs font-bold">◀ Back</span>
        <span className="text-white text-xs font-bold">Next ▶</span>
      </motion.div>

      <motion.div
        className="relative bg-[#141414] rounded-xl cursor-pointer select-none"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        style={{ x }}
        animate={controls}
        onDragEnd={handleDragEnd}
        onClick={() => setDetailItem(item)}
        whileTap={{ scale: 0.98 }}
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-t-xl bg-[#1a1a1a]">
          {item.posterUrl ? (
            <Image
              src={item.posterUrl}
              alt={item.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-white/20 text-4xl">🎬</div>
          )}
          {item.imdbRating && (
            <div className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-amber-400">
              ★ {item.imdbRating.toFixed(1)}
            </div>
          )}
          {series && item.status === 'watching' && (
            <button
              onClick={(e) => { e.stopPropagation(); incrementEpisode(item) }}
              className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white shadow-lg"
            >
              <Plus size={10} /> EP
            </button>
          )}
        </div>

        <div className="p-2.5">
          <p className="text-white text-xs font-semibold leading-tight truncate">{item.title}</p>
          <div className="flex items-center justify-between mt-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); setStatusPickerItem(item) }}
              className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium transition-all', meta.bg, meta.color)}
            >
              {meta.label}
            </button>
            {series && item.currentEpisode > 0 && (
              <span className="text-[10px] text-white/40">S{item.currentSeason}E{item.currentEpisode}</span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export function MediaListItem({ item }: MediaCardProps) {
  const { setDetailItem, setStatusPickerItem } = useUIStore()
  const meta = STATUS_META[item.status]
  const series = isSeries(item)

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 bg-[#141414] rounded-xl cursor-pointer active:bg-[#1e1e1e] transition-colors"
      onClick={() => setDetailItem(item)}
    >
      <div className="relative h-16 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-[#1a1a1a]">
        {item.posterUrl ? (
          <Image src={item.posterUrl} alt={item.title} fill className="object-cover" sizes="44px" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/20 text-xl">🎬</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{item.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={(e) => { e.stopPropagation(); setStatusPickerItem(item) }}
            className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', meta.bg, meta.color)}
          >
            {meta.label}
          </button>
          {series && item.currentEpisode > 0 && (
            <span className="text-[10px] text-white/40">S{item.currentSeason}E{item.currentEpisode}</span>
          )}
        </div>
      </div>
      {series && item.status === 'watching' && (
        <button
          onClick={(e) => { e.stopPropagation(); incrementEpisode(item) }}
          className="flex-shrink-0 flex items-center gap-0.5 rounded-full bg-emerald-600/20 border border-emerald-600/30 px-2.5 py-1 text-[11px] font-bold text-emerald-400"
        >
          <Plus size={11} /> EP
        </button>
      )}
      <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
    </div>
  )
}
