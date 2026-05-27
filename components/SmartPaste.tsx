'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Sparkles, Check, ChevronDown, ListPlus, Trash2 } from 'lucide-react'
import { useUIStore } from '@/lib/store'
import { db, addItem, getItemByImdbId } from '@/lib/db'
import { pushItem } from '@/lib/sync'
import { useAuth } from '@/hooks/useAuth'
import type { MediaType, Status, WatchlistItem } from '@/lib/types'
import { STATUS_META, MEDIA_TYPE_LABELS } from '@/lib/types'
import Image from 'next/image'

interface ParsedItem {
  id: string
  originalQuery: string
  title: string
  mediaType: MediaType
  status: Status
  airingStatus: 'finished' | 'continuing'
  posterUrl: string | null
  year: number | null
  genres: string[]
  overview: string
  rating: number | null
  selected: boolean
}

// Simple Levenshtein distance string similarity helper
function cleanString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getSimilarity(str1: string, str2: string): number {
  const s1 = cleanString(str1)
  const s2 = cleanString(str2)
  if (!s1 || !s2) return 0
  if (s1 === s2) return 1.0
  if (s1.includes(s2) || s2.includes(s1)) {
    return Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length)
  }

  // Basic Levenshtein distance
  const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null))
  for (let i = 0; i <= s1.length; i += 1) track[0][i] = i
  for (let j = 0; j <= s2.length; j += 1) track[j][0] = j
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      )
    }
  }
  const distance = track[s2.length][s1.length]
  const maxLength = Math.max(s1.length, s2.length)
  return maxLength === 0 ? 1.0 : 1.0 - distance / maxLength
}

export default function SmartPaste() {
  const { smartPasteOpen, setSmartPasteOpen } = useUIStore()
  const { user } = useAuth()

  const [text, setText] = useState('')
  const [step, setStep] = useState<'input' | 'scanning' | 'preview'>('input')
  const [progress, setProgress] = useState({ current: 0, total: 0, currentTitle: '' })
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([])
  const [importing, setImporting] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (smartPasteOpen) {
      setText('')
      setStep('input')
      setParsedItems([])
      setImporting(false)
      setProgress({ current: 0, total: 0, currentTitle: '' })
      setTimeout(() => textareaRef.current?.focus(), 150)
    }
  }, [smartPasteOpen])

  // Process pasted list
  async function handleScan() {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length === 0) return

    setStep('scanning')
    setProgress({ current: 0, total: lines.length, currentTitle: '' })

    const results: ParsedItem[] = []

    // Concurrency limit helper to run scans in batches of 2
    const batchSize = 2
    for (let i = 0; i < lines.length; i += batchSize) {
      const batch = lines.slice(i, i + batchSize)
      await Promise.all(
        batch.map(async (query, idx) => {
          const currentIndex = i + idx
          setProgress((p) => ({ ...p, current: currentIndex, currentTitle: query }))

          try {
            // 1. Search TVMaze and iTunes in parallel
            const [tvmazeRes, itunesRes] = await Promise.all([
              fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`).then((r) =>
                r.ok ? r.json() : [],
              ).catch(() => []),
              fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=8&country=us`).then((r) =>
                r.ok ? r.json() : { results: [] },
              ).catch(() => ({ results: [] })),
            ])

            // Determine best match from TVMaze
            const tvShow = tvmazeRes?.[0]?.show
            let tvSimilarity = 0
            if (tvShow) {
              tvSimilarity = Math.max(
                getSimilarity(query, tvShow.name),
                tvShow.english_name ? getSimilarity(query, tvShow.english_name) : 0,
              )
            }

            // Determine best match from iTunes (movies only)
            const itunesMovies = (itunesRes?.results ?? []).filter((r: any) => r.kind === 'feature-movie')
            const movie = itunesMovies?.[0]
            let movieSimilarity = 0
            if (movie) {
              movieSimilarity = getSimilarity(query, movie.trackName)
            }

            // Decide category based on similarity and default fallback
            if (tvShow && tvSimilarity >= movieSimilarity && tvSimilarity > 0.35) {
              const isAnime =
                tvShow.language === 'Japanese' ||
                tvShow.genres?.includes('Anime') ||
                tvShow.type === 'Animation'

              const airingStatus = tvShow.status === 'Ended' ? 'finished' : 'continuing'
              const defaultStatus: Status = isAnime
                ? (airingStatus === 'finished' ? 'finished' : 'watching')
                : (airingStatus === 'finished' ? 'finished' : 'watching')

              results.push({
                id: tvShow.externals?.imdb || `tvmaze-${tvShow.id}`,
                originalQuery: query,
                title: tvShow.name,
                mediaType: isAnime ? 'anime' : 'series',
                status: defaultStatus,
                airingStatus,
                posterUrl: tvShow.image?.medium ?? null,
                year: tvShow.premiered ? parseInt(tvShow.premiered.split('-')[0]) : null,
                genres: tvShow.genres ?? [],
                overview: tvShow.summary?.replace(/<[^>]+>/g, '') ?? '',
                rating: tvShow.rating?.average ?? null,
                selected: true,
              })
            } else if (movie && movieSimilarity > 0.35) {
              results.push({
                id: movie.trackId ? `itunes-movie-${movie.trackId}` : `movie-custom-${Date.now()}-${currentIndex}`,
                originalQuery: query,
                title: movie.trackName,
                mediaType: 'movie',
                status: 'want_to_watch',
                airingStatus: 'finished',
                posterUrl: movie.artworkUrl100 ? movie.artworkUrl100.replace(/\d+x\d+bb/, '300x450bb') : null,
                year: movie.releaseDate ? parseInt(movie.releaseDate.split('-')[0]) : null,
                genres: [],
                overview: movie.longDescription ?? movie.shortDescription ?? '',
                rating: null,
                selected: true,
              })
            } else {
              // Fallback to manual-like item if no good match
              results.push({
                id: `fallback-${Date.now()}-${currentIndex}`,
                originalQuery: query,
                title: query,
                mediaType: 'movie',
                status: 'want_to_watch',
                airingStatus: 'finished',
                posterUrl: null,
                year: null,
                genres: [],
                overview: 'No matching online details found.',
                rating: null,
                selected: true,
              })
            }
          } catch {
            // Fallback on request errors
            results.push({
              id: `fallback-err-${Date.now()}-${currentIndex}`,
              originalQuery: query,
              title: query,
              mediaType: 'movie',
              status: 'want_to_watch',
              airingStatus: 'finished',
              posterUrl: null,
              year: null,
              genres: [],
              overview: 'Search failed.',
              rating: null,
              selected: true,
            })
          }
        }),
      )
    }

    setProgress((p) => ({ ...p, current: lines.length, currentTitle: 'Complete!' }))
    setParsedItems(results)
    setStep('preview')
  }

  // Handle final import to database
  async function handleImport() {
    const toImport = parsedItems.filter((item) => item.selected)
    if (toImport.length === 0) return

    setImporting(true)
    try {
      let importedCount = 0
      for (const item of toImport) {
        const existing = await getItemByImdbId(item.id)
        if (existing) continue

        const now = new Date()
        const newId = await addItem({
          imdbId: item.id,
          title: item.title,
          type: item.mediaType,
          status: item.status,
          posterUrl: item.posterUrl,
          genres: item.genres,
          year: item.year,
          imdbRating: item.rating,
          myRating: null,
          currentSeason: 1,
          currentEpisode: 0,
          totalSeasons: null,
          totalEpisodes: null,
          notes: `Imported via Smart Paste. Original query: "${item.originalQuery}"`,
          overview: item.overview,
        })

        // Cloud sync if logged in
        if (user) {
          const saved = await db.items.get(newId)
          if (saved) await pushItem(saved).catch(() => {})
        }
        importedCount++
      }

      alert(`Imported ${importedCount} item${importedCount !== 1 ? 's' : ''} to your watchlist!`)
      setSmartPasteOpen(false)
    } catch {
      alert('An error occurred during import.')
    } finally {
      setImporting(false)
    }
  }

  function handleToggleSelect(index: number) {
    setParsedItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, selected: !item.selected } : item)),
    )
  }

  function handleChangeStatus(index: number, status: Status) {
    setParsedItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, status } : item)),
    )
  }

  function handleRemoveItem(index: number) {
    setParsedItems((prev) => prev.filter((_, idx) => idx !== index))
  }

  const selectedCount = parsedItems.filter((i) => i.selected).length

  return (
    <AnimatePresence>
      {smartPasteOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !importing && setSmartPasteOpen(false)}
          />

          {/* Drawer container */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-[#0f0f11] border-t border-white/10 max-h-[92vh] overflow-hidden shadow-2xl pb-safe"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle */}
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-white/15 flex-shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-white/8 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-violet-400" />
                <span className="text-white font-bold text-base">Smart Paste & Sort</span>
              </div>
              <button
                disabled={importing}
                onClick={() => setSmartPasteOpen(false)}
                className="p-1.5 rounded-full bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Step 1: Input text */}
            {step === 'input' && (
              <div className="flex flex-col flex-1 overflow-hidden p-4">
                <p className="text-white/40 text-xs leading-relaxed mb-3">
                  Paste your list of movies, shows, or anime below (one title per line). We will automatically match their details, classify their type, detect if they are finished or continuing, and sort them.
                </p>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g.&#13;Attack on Titan&#13;Breaking Bad&#13;Interstellar&#13;Frieren"
                  className="flex-1 min-h-[160px] bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white placeholder:text-white/20 outline-none focus:border-violet-500/60 text-sm transition-colors resize-none font-mono"
                />
                <button
                  onClick={handleScan}
                  disabled={!text.trim()}
                  className={`mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-sm transition-all ${
                    text.trim()
                      ? 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-600/20 active:scale-[0.98]'
                      : 'bg-white/8 text-white/30 cursor-not-allowed'
                  }`}
                >
                  <Sparkles size={14} />
                  Scan & Sort List
                </button>
              </div>
            )}

            {/* Step 2: Scanning screen */}
            {step === 'scanning' && (
              <div className="flex flex-col items-center justify-center py-20 px-6 flex-1 text-center">
                <Loader2 size={36} className="text-violet-400 animate-spin mb-4" />
                <h3 className="text-white font-semibold text-base mb-1.5">Scanning Titles...</h3>
                <p className="text-violet-300/80 text-xs font-mono max-w-xs truncate mb-4">
                  {progress.currentTitle || 'Preparing query...'}
                </p>

                {/* Progress bar */}
                <div className="w-full max-w-[240px] h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
                    style={{
                      width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-white/30 text-xs mt-2">
                  {progress.current} of {progress.total}
                </span>
              </div>
            )}

            {/* Step 3: Preview results */}
            {step === 'preview' && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-2 space-y-3">
                  <p className="text-white/40 text-xs mt-1 mb-2">
                    Review and customize status assignments before importing:
                  </p>

                  {parsedItems.length === 0 ? (
                    <div className="text-center py-12 text-white/20 text-sm">
                      No titles could be parsed. Try pasting again.
                    </div>
                  ) : (
                    parsedItems.map((item, idx) => {
                      const typeLabel = MEDIA_TYPE_LABELS[item.mediaType]
                      const meta = STATUS_META[item.status]
                      const airLabel = item.airingStatus === 'finished' ? 'Ended' : 'Running'

                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            item.selected
                              ? 'bg-white/5 border-white/10'
                              : 'bg-black/10 border-white/5 opacity-50'
                          }`}
                        >
                          {/* Checkbox */}
                          <button
                            onClick={() => handleToggleSelect(idx)}
                            className={`h-5 w-5 rounded flex items-center justify-center border transition-all ${
                              item.selected
                                ? 'bg-violet-600 border-violet-500 text-white'
                                : 'border-white/20 text-transparent hover:border-white/40'
                            }`}
                          >
                            <Check size={12} strokeWidth={3} />
                          </button>

                          {/* Image */}
                          <div className="relative h-12 w-8 bg-white/5 rounded overflow-hidden flex-shrink-0">
                            {item.posterUrl ? (
                              <Image
                                src={item.posterUrl}
                                alt={item.title}
                                fill
                                className="object-cover"
                                sizes="32px"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-white/20 text-xs">🎬</div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white text-xs font-semibold truncate leading-tight">
                              {item.title}
                            </h4>
                            <p className="text-[10px] text-white/40 mt-0.5 truncate">
                              {typeLabel}
                              {item.year ? ` · ${item.year}` : ''}
                              {item.mediaType !== 'movie' ? ` (${airLabel})` : ''}
                            </p>
                          </div>

                          {/* Controls */}
                          <div className="flex items-center gap-2">
                            {/* Dropdown status picker */}
                            <div className="relative">
                              <select
                                value={item.status}
                                onChange={(e) => handleChangeStatus(idx, e.target.value as Status)}
                                className={`appearance-none bg-white/5 text-[11px] font-semibold ${meta.color} rounded-lg pl-2.5 pr-6 py-1.5 border border-white/10 outline-none focus:border-violet-500/50`}
                              >
                                {Object.keys(STATUS_META).map((statusKey) => (
                                  <option key={statusKey} value={statusKey} className="bg-[#0f0f11] text-white">
                                    {STATUS_META[statusKey as Status].label}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown
                                size={10}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
                              />
                            </div>

                            {/* Trash button to exclude */}
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Footer buttons */}
                <div className="p-4 border-t border-white/8 bg-[#0f0f11] flex gap-3 flex-shrink-0">
                  <button
                    onClick={() => setStep('input')}
                    disabled={importing}
                    className="flex-1 py-3 text-sm font-semibold rounded-xl text-white/70 bg-white/5 hover:bg-white/10 transition-all border border-white/5"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={selectedCount === 0 || importing}
                    className="flex-[2] flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl text-white bg-violet-600 hover:bg-violet-500 transition-all disabled:opacity-40 disabled:pointer-events-none shadow-lg shadow-violet-600/25"
                  >
                    {importing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ListPlus size={14} />
                    )}
                    Import {selectedCount} Title{selectedCount !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
