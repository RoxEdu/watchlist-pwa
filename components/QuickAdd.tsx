'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { Search, X, Plus, Loader2 } from 'lucide-react'
import { useUIStore } from '@/lib/store'
import { searchOMDb } from '@/lib/omdb'
import { addToWatchlist } from '@/hooks/useWatchlist'
import { getItemByImdbId } from '@/lib/db'
import type { OMDbSearchResult } from '@/lib/types'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function QuickAdd() {
  const { quickAddOpen, setQuickAddOpen } = useUIStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OMDbSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useDebounce(query, 400)

  useEffect(() => {
    if (quickAddOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
      setQuery('')
      setResults([])
      setAdded(new Set())
    }
  }, [quickAddOpen])

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return }
    let cancelled = false
    setLoading(true)
    searchOMDb(debouncedQuery)
      .then((r) => { if (!cancelled) setResults(r) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [debouncedQuery])

  const handleAdd = useCallback(async (result: OMDbSearchResult) => {
    if (added.has(result.imdbID) || adding.has(result.imdbID)) return
    const existing = await getItemByImdbId(result.imdbID)
    if (existing) { setAdded((p) => new Set(p).add(result.imdbID)); return }

    setAdding((p) => new Set(p).add(result.imdbID))
    try {
      await addToWatchlist(result)
      setAdded((p) => new Set(p).add(result.imdbID))
    } finally {
      setAdding((p) => { const n = new Set(p); n.delete(result.imdbID); return n })
    }
  }, [added, adding])

  return (
    <>
      <motion.button
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 shadow-lg shadow-violet-600/40 text-white"
        onClick={() => setQuickAddOpen(true)}
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.05 }}
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
              className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-[#141414] border-t border-white/10 max-h-[85vh]"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/20" />

              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
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
                {!loading && query.trim() && results.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-white/30">
                    <p className="text-sm">No results for "{query}"</p>
                  </div>
                )}
                {!query.trim() && (
                  <div className="flex flex-col items-center justify-center py-16 text-white/20">
                    <Search size={32} className="mb-3" />
                    <p className="text-sm">Search to add to your watchlist</p>
                  </div>
                )}
                <div className="py-2">
                  {results.map((result) => {
                    const year = result.Year?.split('–')[0]
                    const isAdded = added.has(result.imdbID)
                    const isAdding = adding.has(result.imdbID)
                    const typeLabel = result.Type === 'movie' ? 'Movie' : 'Series'
                    const poster = result.Poster !== 'N/A' ? result.Poster : null

                    return (
                      <div key={result.imdbID} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5">
                        <div className="relative h-16 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-[#1a1a1a]">
                          {poster ? (
                            <Image src={poster} alt={result.Title} fill className="object-cover" sizes="44px" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-white/20 text-xl">🎬</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{result.Title}</p>
                          <p className="text-white/40 text-xs">
                            {typeLabel}{year ? ` · ${year}` : ''}
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
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
