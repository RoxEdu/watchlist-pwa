'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { Search, X, Plus, Loader2, PenLine, ChevronLeft } from 'lucide-react'
import { useUIStore } from '@/lib/store'
import { searchTMDB } from '@/lib/tmdb'
import { addSearchResultToWatchlist, addManualEntry } from '@/hooks/useWatchlist'
import { getItemByImdbId } from '@/lib/db'
import type { TMDBSearchResult } from '@/lib/tmdb'
import type { MediaType } from '@/lib/types'
import { MEDIA_TYPE_LABELS } from '@/lib/types'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

const MANUAL_TYPES: MediaType[] = ['movie', 'series', 'anime', 'documentary', 'mini_series']

export default function QuickAdd() {
  const { quickAddOpen, setQuickAddOpen } = useUIStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TMDBSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<Set<string>>(new Set())
  const [showManual, setShowManual] = useState(false)

  // Manual add form state
  const [manualTitle, setManualTitle] = useState('')
  const [manualYear, setManualYear] = useState('')
  const [manualType, setManualType] = useState<MediaType>('movie')
  const [manualAdding, setManualAdding] = useState(false)
  const [manualDone, setManualDone] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const manualInputRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useDebounce(query, 400)

  useEffect(() => {
    if (quickAddOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
      setQuery('')
      setResults([])
      setAdded(new Set())
      setSearchError(null)
      setShowManual(false)
      resetManualForm()
    }
  }, [quickAddOpen])

  useEffect(() => {
    if (showManual) {
      setTimeout(() => manualInputRef.current?.focus(), 50)
    }
  }, [showManual])

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      setSearchError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setSearchError(null)
    searchTMDB(debouncedQuery)
      .then((r) => { if (!cancelled) setResults(r) })
      .catch((err: Error) => {
        if (!cancelled) {
          setResults([])
          setSearchError(
            err.message.includes('not configured')
              ? 'TMDB API key not set — add TMDB_API_KEY to .env.local'
              : 'Search unavailable',
          )
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [debouncedQuery])

  const handleAdd = useCallback(async (result: TMDBSearchResult) => {
    if (added.has(result.tmdbId) || adding.has(result.tmdbId)) return
    const existing = await getItemByImdbId(result.tmdbId)
    if (existing) { setAdded((p) => new Set(p).add(result.tmdbId)); return }

    setAdding((p) => new Set(p).add(result.tmdbId))
    try {
      await addSearchResultToWatchlist(result)
      setAdded((p) => new Set(p).add(result.tmdbId))
    } finally {
      setAdding((p) => { const n = new Set(p); n.delete(result.tmdbId); return n })
    }
  }, [added, adding])

  function resetManualForm() {
    setManualTitle('')
    setManualYear('')
    setManualType('movie')
    setManualAdding(false)
    setManualDone(false)
  }

  async function handleManualAdd() {
    if (!manualTitle.trim() || manualAdding || manualDone) return
    setManualAdding(true)
    try {
      await addManualEntry({ title: manualTitle, year: manualYear, type: manualType })
      setManualDone(true)
      setTimeout(() => {
        setQuickAddOpen(false)
      }, 800)
    } finally {
      setManualAdding(false)
    }
  }

  const noResults = !loading && query.trim() && results.length === 0 && !searchError

  return (
    <>
      <motion.button
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 shadow-lg shadow-violet-600/40 text-white"
        onClick={() => setQuickAddOpen(true)}
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.05 }}
        aria-label="Add to watchlist"
      >
        <Plus size={24} />
      </motion.button>

      <AnimatePresence>
        {quickAddOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setQuickAddOpen(false)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-[#141414] border-t border-white/10 max-h-[88vh]"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/20 flex-shrink-0" />

              {showManual ? (
                /* ── Manual add form ── */
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 flex-shrink-0">
                    <button
                      onClick={() => setShowManual(false)}
                      className="text-white/40 hover:text-white -ml-1 p-1"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-white font-semibold text-sm flex-1">Add manually</span>
                    <button onClick={() => setQuickAddOpen(false)} className="text-white/40 hover:text-white text-sm">
                      Cancel
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 flex flex-col gap-4">
                    {/* Title */}
                    <div>
                      <label className="text-white/40 text-xs font-medium uppercase tracking-wider block mb-1.5">Title</label>
                      <input
                        ref={manualInputRef}
                        value={manualTitle}
                        onChange={(e) => setManualTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
                        placeholder="e.g. The Batman"
                        className="w-full bg-white/6 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/25 outline-none focus:border-violet-500/60 text-base transition-colors"
                      />
                    </div>

                    {/* Year */}
                    <div>
                      <label className="text-white/40 text-xs font-medium uppercase tracking-wider block mb-1.5">Year <span className="normal-case text-white/20">(optional)</span></label>
                      <input
                        value={manualYear}
                        onChange={(e) => setManualYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
                        placeholder="e.g. 2022"
                        inputMode="numeric"
                        className="w-full bg-white/6 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/25 outline-none focus:border-violet-500/60 text-base transition-colors"
                      />
                    </div>

                    {/* Type */}
                    <div>
                      <label className="text-white/40 text-xs font-medium uppercase tracking-wider block mb-2">Type</label>
                      <div className="flex flex-wrap gap-2">
                        {MANUAL_TYPES.map((t) => (
                          <button
                            key={t}
                            onClick={() => setManualType(t)}
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                              manualType === t
                                ? 'bg-violet-600 text-white'
                                : 'bg-white/8 text-white/50 hover:bg-white/12 hover:text-white'
                            }`}
                          >
                            {MEDIA_TYPE_LABELS[t]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleManualAdd}
                      disabled={!manualTitle.trim() || manualAdding || manualDone}
                      className={`mt-2 w-full rounded-2xl py-4 font-semibold text-base transition-all ${
                        manualDone
                          ? 'bg-emerald-600 text-white'
                          : !manualTitle.trim()
                          ? 'bg-white/8 text-white/30'
                          : 'bg-violet-600 text-white hover:bg-violet-500 active:scale-[0.98]'
                      }`}
                    >
                      {manualDone ? '✓ Added to watchlist' : manualAdding ? '…' : 'Add to Watchlist'}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Search view ── */
                <>
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 flex-shrink-0">
                    {loading
                      ? <Loader2 size={18} className="text-white/40 animate-spin flex-shrink-0" />
                      : <Search size={18} className="text-white/40 flex-shrink-0" />
                    }
                    <input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search movies, series, anime..."
                      className="flex-1 bg-transparent text-white placeholder:text-white/30 outline-none text-base"
                    />
                    {query && (
                      <button onClick={() => setQuery('')} className="text-white/40 hover:text-white">
                        <X size={16} />
                      </button>
                    )}
                    <button onClick={() => setQuickAddOpen(false)} className="text-white/40 hover:text-white text-sm ml-2">
                      Cancel
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto overscroll-contain">
                    {/* Empty / idle state */}
                    {!query.trim() && (
                      <div className="flex flex-col items-center justify-center py-14 text-white/20">
                        <Search size={32} className="mb-3" />
                        <p className="text-sm">Search to add to your watchlist</p>
                      </div>
                    )}

                    {/* Search error */}
                    {searchError && (
                      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                        <p className="text-white/40 text-sm">{searchError}</p>
                        <button
                          onClick={() => setShowManual(true)}
                          className="mt-4 flex items-center gap-1.5 rounded-full bg-white/8 px-4 py-2 text-sm text-white/50 hover:bg-white/12 hover:text-white transition-colors"
                        >
                          <PenLine size={14} />
                          Add manually
                        </button>
                      </div>
                    )}

                    {/* No results */}
                    {noResults && (
                      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                        <p className="text-white/40 text-sm mb-1">No results for &ldquo;{query}&rdquo;</p>
                        <p className="text-white/20 text-xs mb-5">Can&apos;t find it? Add it yourself.</p>
                        <button
                          onClick={() => { setManualTitle(query); setShowManual(true) }}
                          className="flex items-center gap-2 rounded-full bg-violet-600/20 border border-violet-500/30 px-5 py-2.5 text-sm text-violet-300 font-medium hover:bg-violet-600/30 transition-colors"
                        >
                          <PenLine size={14} />
                          Add &ldquo;{query}&rdquo; manually
                        </button>
                      </div>
                    )}

                    {/* Results list */}
                    <div className="py-2">
                      {results.map((result) => {
                        const typeLabel = result.mediaType === 'movie' ? 'Movie' : 'Series'
                        const isAdded = added.has(result.tmdbId)
                        const isAdding = adding.has(result.tmdbId)

                        return (
                          <div key={result.tmdbId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5">
                            <div className="relative h-16 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-[#1a1a1a]">
                              {result.posterUrl ? (
                                <Image
                                  src={result.posterUrl}
                                  alt={result.title}
                                  fill
                                  className="object-cover"
                                  sizes="44px"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-white/20 text-xl">🎬</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{result.title}</p>
                              <p className="text-white/40 text-xs">
                                {typeLabel}{result.year ? ` · ${result.year}` : ''}{result.rating ? ` · ★ ${result.rating}` : ''}
                              </p>
                            </div>
                            <button
                              onClick={() => handleAdd(result)}
                              disabled={isAdded || isAdding}
                              className={`flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                                isAdded
                                  ? 'bg-white/10 text-white/40'
                                  : isAdding
                                  ? 'bg-violet-600/50 text-white/70'
                                  : 'bg-violet-600 text-white hover:bg-violet-500'
                              }`}
                            >
                              {isAdded ? '✓ Added' : isAdding ? '…' : <><Plus size={12} /> Add</>}
                            </button>
                          </div>
                        )
                      })}
                    </div>

                    {/* Manual add option hidden here, only shows on empty or failed search */}
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
