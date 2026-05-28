'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { X, Plus, Minus, Star, Trash2 } from 'lucide-react'
import { STATUS_META, STATUS_ORDER, MEDIA_TYPE_LABELS, type Status } from '@/lib/types'
import { useUIStore } from '@/lib/store'
import { setStatus, updateItem, removeFromWatchlist, incrementEpisode, getEpisodesInSeason } from '@/hooks/useWatchlist'
import { db } from '@/lib/db'
import { cn } from '@/lib/utils'

const STATUS_ICONS: Record<Status, string> = {
  want_to_watch: '🔖',
  watching:      '▶️',
  up_to_date:   '⏸️',
  finished:      '✅',
  on_hold:       '🗂️',
  dropped:       '❌',
}

export default function DetailSheet() {
  const { detailItem, setDetailItem } = useUIStore()
  const [showStatusPicker, setShowStatusPicker] = useState(false)

  function close() { setDetailItem(null); setShowStatusPicker(false) }

  if (!detailItem) return null
  const item = detailItem
  const meta = STATUS_META[item.status]
  const series = item.type === 'series' || item.type === 'anime' || item.type === 'mini_series'

  // Pre-fetch episodes metadata in background
  useEffect(() => {
    if (series && item.imdbId) {
      getEpisodesInSeason(item.imdbId, item.type, item.currentSeason).catch(() => {})
    }
  }, [item.imdbId, item.type, item.currentSeason, series])

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={close}
      />
      <motion.div
        key={item.id}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl bg-[#0f0f0f] border-t border-white/10"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="sticky top-0 z-10 bg-[#0f0f0f] pt-3 pb-2 px-4 flex items-center justify-between">
          <div className="mx-auto h-1 w-10 rounded-full bg-white/20 absolute left-1/2 -translate-x-1/2 top-3" />
          <div />
          <button onClick={close} className="ml-auto p-2 rounded-full bg-white/8 text-white/60 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Poster header — blurred bg + centered poster */}
        {item.posterUrl && (
          <div className="relative h-44 w-full overflow-hidden">
            <Image
              src={item.posterUrl}
              alt={item.title}
              fill
              className="object-cover scale-110"
              style={{ filter: 'blur(20px)', opacity: 0.4 }}
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] to-transparent" />
          </div>
        )}

        <div className="px-4 pb-10">
          <div className={`flex gap-4 ${item.posterUrl ? '-mt-20' : 'mt-2'} relative z-10`}>
            {item.posterUrl && (
              <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg shadow-xl border border-white/10">
                <Image src={item.posterUrl} alt={item.title} fill className="object-cover" sizes="80px" />
              </div>
            )}
            <div className={item.posterUrl ? 'flex-1 pt-14' : 'flex-1'}>
              <p className="text-white font-bold text-lg leading-tight">{item.title}</p>
              <p className="text-white/40 text-xs mt-1">
                {MEDIA_TYPE_LABELS[item.type]}
                {item.year ? ` · ${item.year}` : ''}
                {item.imdbRating ? ` · ★ ${item.imdbRating.toFixed(1)} IMDb` : ''}
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="mt-4">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Status</p>
            <button
              onClick={() => setShowStatusPicker((v) => !v)}
              className={cn('flex items-center gap-2 rounded-xl px-4 py-3 w-full text-left transition-all', meta.bg, 'border border-current/20')}
            >
              <span className="text-xl">{STATUS_ICONS[item.status]}</span>
              <span className={cn('font-semibold', meta.color)}>{meta.label}</span>
              <span className="ml-auto text-white/30 text-sm">tap to change</span>
            </button>

            <AnimatePresence>
              {showStatusPicker && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {STATUS_ORDER.filter((s) => s !== item.status).map((s) => {
                      const m = STATUS_META[s]
                      return (
                        <button
                          key={s}
                          onClick={async () => {
                            await setStatus(item.id, s)
                            setDetailItem({ ...item, status: s })
                            setShowStatusPicker(false)
                          }}
                          className={cn('flex items-center gap-2 rounded-xl px-3 py-2.5 text-left', m.bg, 'border border-current/10')}
                        >
                          <span>{STATUS_ICONS[s]}</span>
                          <span className={cn('text-xs font-medium', m.color)}>{m.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Episode progress */}
          {series && (
            <div className="mt-4">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Progress</p>
              <div className="flex items-center gap-4 bg-white/5 rounded-xl px-4 py-3">
                <div className="flex-1 flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-white/40 uppercase font-semibold block mb-0.5">Season</label>
                    <input
                      type="number"
                      value={item.currentSeason}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value, 10) || 1)
                        updateItem(item.id, { currentSeason: val })
                        setDetailItem({ ...item, currentSeason: val })
                      }}
                      className="w-full bg-transparent text-white font-semibold outline-none border-b border-white/10 focus:border-violet-500 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="h-8 w-[1px] bg-white/10 self-end" />
                  <div className="flex-1.5">
                    <label className="text-[10px] text-white/40 uppercase font-semibold block mb-0.5">Episode</label>
                    <input
                      type="number"
                      value={item.currentEpisode}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                        updateItem(item.id, { currentEpisode: val })
                        setDetailItem({ ...item, currentEpisode: val })
                      }}
                      className="w-full bg-transparent text-white font-semibold outline-none border-b border-white/10 focus:border-violet-500 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end">
                  <button
                    onClick={() => {
                      const prev = Math.max(0, item.currentEpisode - 1)
                      updateItem(item.id, { currentEpisode: prev })
                      setDetailItem({ ...item, currentEpisode: prev })
                    }}
                    className="p-2 rounded-full bg-white/8 text-white/60 hover:text-white"
                  >
                    <Minus size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      await incrementEpisode(item)
                      const updated = await db.items.get(item.id)
                      if (updated) setDetailItem(updated)
                    }}
                    className="p-2 rounded-full bg-emerald-600 text-white"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* My Rating */}
          <div className="mt-4">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-2">My Rating</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    const newRating = item.myRating === n ? null : n
                    updateItem(item.id, { myRating: newRating })
                    setDetailItem({ ...item, myRating: newRating })
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
                >
                  <Star
                    size={18}
                    className={item.myRating && item.myRating >= n ? 'text-amber-400 fill-amber-400' : 'text-white/20'}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Genres */}
          {item.genres.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Genre</p>
              <div className="flex flex-wrap gap-2">
                {item.genres.map((g) => (
                  <span key={g} className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/60">{g}</span>
                ))}
              </div>
            </div>
          )}

          {/* Overview */}
          {item.overview && (
            <div className="mt-4">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Overview</p>
              <p className="text-white/70 text-sm leading-relaxed">{item.overview}</p>
            </div>
          )}

          {/* Notes */}
          <div className="mt-4">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Notes</p>
            <textarea
              defaultValue={item.notes}
              onBlur={(e) => updateItem(item.id, { notes: e.target.value })}
              placeholder="Add a note..."
              rows={3}
              className="w-full bg-white/5 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/25 resize-none outline-none focus:ring-1 focus:ring-violet-500/50"
            />
          </div>

          {/* Delete */}
          <button
            onClick={async () => { await removeFromWatchlist(item); close() }}
            className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
          >
            <Trash2 size={15} /> Remove from Watchlist
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
