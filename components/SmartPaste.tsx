'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Sparkles, Check, ChevronDown, ListPlus, Trash2, Edit2, AlertCircle, Search } from 'lucide-react'
import { useUIStore } from '@/lib/store'
import { db, addItem, getItemByImdbId } from '@/lib/db'
import { pushItem } from '@/lib/sync'
import { useAuth } from '@/hooks/useAuth'
import type { MediaType, Status } from '@/lib/types'
import { STATUS_META, MEDIA_TYPE_LABELS } from '@/lib/types'
import Image from 'next/image'

interface Alternative {
  id: string
  title: string
  mediaType: MediaType
  airingStatus: 'finished' | 'continuing'
  posterUrl: string | null
  year: number | null
  genres: string[]
  overview: string
  rating: number | null
}

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
  isUnsure: boolean
  isEditing?: boolean
  editQuery?: string
  alternatives: Alternative[]
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

// Checkbox and note strip helper
function parseInputLine(line: string): { query: string; isCompleted: boolean } | null {
  let clean = line.trim()
  if (!clean) return null

  // Strip leading list bullet markers and spacing (e.g. "- ", "* ", "1. ", "2) ")
  clean = clean.replace(/^[\s\-\*\•\d+[\.\)]\s*/, '')

  let isCompleted = false
  // Detect checkboxes: [x], [X], [ ]
  const checkboxMatch = clean.match(/^\[([ xX])\]\s*(.*)$/)
  if (checkboxMatch) {
    isCompleted = checkboxMatch[1].toLowerCase() === 'x'
    clean = checkboxMatch[2].trim()
  }

  // Strip common trailing descriptors
  if (clean.toLowerCase().endsWith(' movie')) {
    clean = clean.substring(0, clean.length - 6).trim()
  }
  if (clean.toLowerCase().endsWith(' (series)')) {
    clean = clean.substring(0, clean.length - 9).trim()
  }

  if (!clean) return null
  return { query: clean, isCompleted }
}

// Queries endpoints and formats standard matches and alternatives
async function scanSingleTitle(query: string, isCompleted: boolean, currentIndex: number): Promise<ParsedItem> {
  const [tvmazeRes, itunesRes] = await Promise.all([
    fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`).then((r) =>
      r.ok ? r.json() : [],
    ).catch(() => []),
    fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=5&country=us`).then((r) =>
      r.ok ? r.json() : { results: [] },
    ).catch(() => ({ results: [] })),
  ])

  // Parse TVMaze results
  const tvShows = (tvmazeRes ?? []).slice(0, 3).map((item: any) => {
    const show = item.show
    const similarity = Math.max(
      getSimilarity(query, show.name),
      show.english_name ? getSimilarity(query, show.english_name) : 0,
    )
    const isAnime =
      show.language === 'Japanese' ||
      show.genres?.includes('Anime') ||
      show.type === 'Animation'

    return {
      id: show.externals?.imdb || `tvmaze-${show.id}`,
      title: show.name,
      mediaType: (isAnime ? 'anime' : 'series') as MediaType,
      airingStatus: (show.status === 'Ended' ? 'finished' : 'continuing') as 'finished' | 'continuing',
      posterUrl: show.image?.medium ?? null,
      year: show.premiered ? parseInt(show.premiered.split('-')[0]) : null,
      genres: show.genres ?? [],
      overview: show.summary?.replace(/<[^>]+>/g, '') ?? '',
      rating: show.rating?.average ?? null,
      similarity
    }
  })

  // Parse iTunes results (movies only)
  const itunesMovies = (itunesRes?.results ?? [])
    .filter((r: any) => r.kind === 'feature-movie')
    .slice(0, 3)
    .map((movie: any) => {
      const similarity = getSimilarity(query, movie.trackName)
      return {
        id: movie.trackId ? `itunes-movie-${movie.trackId}` : `movie-custom-${Date.now()}-${currentIndex}-${Math.random()}`,
        title: movie.trackName,
        mediaType: 'movie' as MediaType,
        airingStatus: 'finished' as const,
        posterUrl: movie.artworkUrl100 ? movie.artworkUrl100.replace(/\d+x\d+bb/, '300x450bb') : null,
        year: movie.releaseDate ? parseInt(movie.releaseDate.split('-')[0]) : null,
        genres: [] as string[],
        overview: movie.longDescription ?? movie.shortDescription ?? '',
        rating: null,
        similarity
      }
    })

  // Sort candidates by string similarity
  const allCandidates = [...tvShows, ...itunesMovies].sort((a, b) => b.similarity - a.similarity)

  // Custom manual fallbacks
  const customMovie = {
    id: `custom-movie-${Date.now()}-${currentIndex}`,
    title: query,
    mediaType: 'movie' as MediaType,
    airingStatus: 'finished' as const,
    posterUrl: null,
    year: null,
    genres: [],
    overview: 'Custom Movie entry created via Smart Paste.',
    rating: null,
    similarity: 0.1
  }

  const customSeries = {
    id: `custom-series-${Date.now()}-${currentIndex}`,
    title: query,
    mediaType: 'series' as MediaType,
    airingStatus: 'continuing' as const,
    posterUrl: null,
    year: null,
    genres: [],
    overview: 'Custom TV Series entry created via Smart Paste.',
    rating: null,
    similarity: 0.1
  }

  const bestCandidate = allCandidates[0]
  const bestSimilarity = bestCandidate ? bestCandidate.similarity : 0
  const isUnsure = bestSimilarity < 0.75

  // De-duplicate alternatives
  const uniqueAltsMap = new Map<string, Alternative>()
  allCandidates.forEach((c) => {
    uniqueAltsMap.set(c.id, {
      id: c.id,
      title: c.title,
      mediaType: c.mediaType,
      airingStatus: c.airingStatus,
      posterUrl: c.posterUrl,
      year: c.year,
      genres: c.genres,
      overview: c.overview,
      rating: c.rating
    })
  })

  // Append manual fallbacks to the list of alternatives
  uniqueAltsMap.set(customMovie.id, {
    id: customMovie.id,
    title: customMovie.title,
    mediaType: customMovie.mediaType,
    airingStatus: customMovie.airingStatus,
    posterUrl: customMovie.posterUrl,
    year: customMovie.year,
    genres: customMovie.genres,
    overview: customMovie.overview,
    rating: customMovie.rating
  })
  uniqueAltsMap.set(customSeries.id, {
    id: customSeries.id,
    title: customSeries.title,
    mediaType: customSeries.mediaType,
    airingStatus: customSeries.airingStatus,
    posterUrl: customSeries.posterUrl,
    year: customSeries.year,
    genres: customSeries.genres,
    overview: customSeries.overview,
    rating: customSeries.rating
  })

  const finalAlternatives = Array.from(uniqueAltsMap.values())
  const selectedMatch = bestCandidate || customMovie

  // Status mapping logic
  let defaultStatus: Status = 'want_to_watch'
  if (isCompleted) {
    defaultStatus = 'finished'
  } else {
    if (selectedMatch.mediaType === 'movie') {
      defaultStatus = 'want_to_watch'
    } else {
      defaultStatus = selectedMatch.airingStatus === 'finished' ? 'finished' : 'watching'
    }
  }

  return {
    id: selectedMatch.id,
    originalQuery: query,
    title: selectedMatch.title,
    mediaType: selectedMatch.mediaType,
    status: defaultStatus,
    airingStatus: selectedMatch.airingStatus,
    posterUrl: selectedMatch.posterUrl,
    year: selectedMatch.year,
    genres: selectedMatch.genres,
    overview: selectedMatch.overview,
    rating: selectedMatch.rating,
    selected: true,
    isUnsure,
    alternatives: finalAlternatives
  }
}

export default function SmartPaste() {
  const { smartPasteOpen, setSmartPasteOpen } = useUIStore()
  const { user } = useAuth()

  const [text, setText] = useState('')
  const [step, setStep] = useState<'input' | 'scanning' | 'preview'>('input')
  const [progress, setProgress] = useState({ current: 0, total: 0, currentTitle: '' })
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([])
  const [importing, setImporting] = useState(false)
  const [reScanningId, setReScanningId] = useState<string | null>(null)

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
    let rawItems: Array<{ query: string; isCompleted: boolean }> = []

    // 1. Flexible Delimiter Parsing
    if (text.includes('\n')) {
      rawItems = text
        .split('\n')
        .map(parseInputLine)
        .filter((x): x is { query: string; isCompleted: boolean } => x !== null)
    } else if (text.includes(',')) {
      rawItems = text
        .split(',')
        .map(parseInputLine)
        .filter((x): x is { query: string; isCompleted: boolean } => x !== null)
    } else {
      // Check if space separated
      const trimmed = text.trim()
      if (trimmed) {
        const parsed = parseInputLine(trimmed)
        if (parsed) {
          // Pre-verify entire string
          setStep('scanning')
          setProgress({ current: 0, total: 1, currentTitle: parsed.query })
          try {
            const scanResult = await scanSingleTitle(parsed.query, parsed.isCompleted, 0)
            if (!scanResult.isUnsure) {
              setParsedItems([scanResult])
              setProgress({ current: 1, total: 1, currentTitle: 'Complete!' })
              setStep('preview')
              return
            }
          } catch {
            // ignore
          }

          // Split by spaces if low-confidence or failed
          const words = trimmed
            .split(/\s+/)
            .map(parseInputLine)
            .filter((x): x is { query: string; isCompleted: boolean } => x !== null)

          if (words.length > 1) {
            rawItems = words
          } else {
            rawItems = [parsed]
          }
        }
      }
    }

    if (rawItems.length === 0) return

    setStep('scanning')
    setProgress({ current: 0, total: rawItems.length, currentTitle: '' })

    const results: ParsedItem[] = []
    const batchSize = 2
    for (let i = 0; i < rawItems.length; i += batchSize) {
      const batch = rawItems.slice(i, i + batchSize)
      await Promise.all(
        batch.map(async (item, idx) => {
          const currentIndex = i + idx
          setProgress((p) => ({ ...p, current: currentIndex, currentTitle: item.query }))
          try {
            const scanResult = await scanSingleTitle(item.query, item.isCompleted, currentIndex)
            results.push(scanResult)
          } catch {
            results.push({
              id: `err-${Date.now()}-${currentIndex}`,
              originalQuery: item.query,
              title: item.query,
              mediaType: 'movie',
              status: item.isCompleted ? 'finished' : 'want_to_watch',
              airingStatus: 'finished',
              posterUrl: null,
              year: null,
              genres: [],
              overview: 'Search failed.',
              rating: null,
              selected: true,
              isUnsure: true,
              alternatives: [
                {
                  id: `err-movie-${Date.now()}-${currentIndex}`,
                  title: item.query,
                  mediaType: 'movie',
                  airingStatus: 'finished',
                  posterUrl: null,
                  year: null,
                  genres: [],
                  overview: 'Custom Movie entry.',
                  rating: null
                },
                {
                  id: `err-series-${Date.now()}-${currentIndex}`,
                  title: item.query,
                  mediaType: 'series',
                  airingStatus: 'continuing',
                  posterUrl: null,
                  year: null,
                  genres: [],
                  overview: 'Custom TV Series entry.',
                  rating: null
                }
              ]
            })
          }
        })
      )
    }

    setProgress((p) => ({ ...p, current: rawItems.length, currentTitle: 'Complete!' }))
    setParsedItems(results)
    setStep('preview')
  }

  // Handle final bulk database insertion
  async function handleImport() {
    const toImport = parsedItems.filter((item) => item.selected)
    if (toImport.length === 0) return

    setImporting(true)
    try {
      let importedCount = 0
      for (const item of toImport) {
        const existing = await getItemByImdbId(item.id)
        if (existing) continue

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

  // Inline correction / editing functions
  function handleStartEditing(index: number) {
    setParsedItems((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, isEditing: true, editQuery: item.title } : item,
      )
    )
  }

  function handleCancelEditing(index: number) {
    setParsedItems((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, isEditing: false, editQuery: undefined } : item,
      )
    )
  }

  function handleEditQueryChange(index: number, val: string) {
    setParsedItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, editQuery: val } : item)),
    )
  }

  async function handleRescan(index: number, newQuery: string) {
    if (!newQuery.trim()) return
    const item = parsedItems[index]
    setReScanningId(item.id)
    try {
      const updated = await scanSingleTitle(newQuery, item.status === 'finished', index)
      setParsedItems((prev) =>
        prev.map((p, idx) =>
          idx === index ? { ...updated, isEditing: false, editQuery: undefined } : p,
        )
      )
    } catch {
      alert('Rescan failed.')
    } finally {
      setReScanningId(null)
    }
  }

  function handleSelectAlternative(index: number, alt: Alternative) {
    setParsedItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item

        let defaultStatus = item.status
        if (item.status !== 'finished') {
          if (alt.mediaType === 'movie') {
            defaultStatus = 'want_to_watch'
          } else {
            defaultStatus = alt.airingStatus === 'finished' ? 'finished' : 'watching'
          }
        }

        return {
          ...item,
          id: alt.id,
          title: alt.title,
          mediaType: alt.mediaType,
          airingStatus: alt.airingStatus,
          posterUrl: alt.posterUrl,
          year: alt.year,
          genres: alt.genres,
          overview: alt.overview,
          rating: alt.rating,
          status: defaultStatus,
          isUnsure: false, // user resolved the match manually
        }
      })
    )
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
                  Paste your list of movies, shows, or anime. Supports checkboxes (`- [x] Finished`), newlines, commas, or spaces. We will automatically classify their type, airing status, and sort them.
                </p>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g.&#13;- [x] Cyberpunk Edgerunners&#13;- [ ] Jujutsu Kaisen&#13;Inception, Interstellar, Frieren"
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
                          className={`flex flex-col p-3 rounded-xl border transition-all ${
                            item.selected
                              ? 'bg-white/5 border-white/10'
                              : 'bg-black/10 border-white/5 opacity-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 w-full">
                            {/* Checkbox */}
                            <button
                              onClick={() => handleToggleSelect(idx)}
                              className={`h-5 w-5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                                item.selected
                                  ? 'bg-violet-600 border-violet-500 text-white'
                                  : 'border-white/20 text-transparent hover:border-white/40'
                              }`}
                            >
                              <Check size={12} strokeWidth={3} />
                            </button>

                            {/* Main Body */}
                            {item.isEditing ? (
                              <div className="flex-1 flex gap-2 items-center min-w-0">
                                <input
                                  type="text"
                                  value={item.editQuery || ''}
                                  onChange={(e) => handleEditQueryChange(idx, e.target.value)}
                                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-violet-500 min-w-0 font-mono"
                                  placeholder="Fix title and rescan..."
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRescan(idx, item.editQuery || '')
                                  }}
                                />
                                <button
                                  disabled={reScanningId === item.id}
                                  onClick={() => handleRescan(idx, item.editQuery || '')}
                                  className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors flex-shrink-0"
                                >
                                  {reScanningId === item.id ? (
                                    <Loader2 size={10} className="animate-spin" />
                                  ) : (
                                    <Search size={10} />
                                  )}
                                  Scan
                                </button>
                                <button
                                  onClick={() => handleCancelEditing(idx)}
                                  className="px-2 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg text-[10px] transition-colors flex-shrink-0"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
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
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <h4 className="text-white text-xs font-semibold truncate leading-tight">
                                      {item.title}
                                    </h4>
                                    {item.isUnsure && (
                                      <span className="flex-shrink-0 rounded bg-amber-500/10 text-amber-500 text-[8px] font-bold px-1 py-0.5 border border-amber-500/20 uppercase tracking-wider">
                                        Unsure
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-white/40 mt-0.5 truncate flex items-center gap-1">
                                    <span>{typeLabel}</span>
                                    {item.year ? <span>· {item.year}</span> : null}
                                    {item.mediaType !== 'movie' ? <span>({airLabel})</span> : null}
                                    <button
                                      onClick={() => handleStartEditing(idx)}
                                      className="inline-flex items-center text-violet-400 hover:text-violet-300 ml-1.5 text-[9px] hover:underline cursor-pointer"
                                    >
                                      <Edit2 size={8} className="mr-0.5" /> Edit
                                    </button>
                                  </p>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-2 flex-shrink-0">
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

                                  <button
                                    onClick={() => handleRemoveItem(idx)}
                                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Alternatives UI (If Unsure) */}
                          {!item.isEditing && item.isUnsure && item.alternatives && item.alternatives.length > 0 && (
                            <div className="mt-2.5 ml-8 p-3 bg-white/5 border border-white/8 rounded-xl space-y-2">
                              <span className="text-[9px] text-white/50 font-bold tracking-wide uppercase flex items-center gap-1">
                                <AlertCircle size={10} className="text-amber-500" /> Did you mean?
                              </span>
                              <div className="flex flex-col gap-1.5">
                                {item.alternatives.map((alt) => (
                                  <button
                                    key={alt.id}
                                    onClick={() => handleSelectAlternative(idx, alt)}
                                    className="w-full text-left text-xs px-3 py-2 rounded-lg bg-black/30 hover:bg-black/50 border border-white/5 hover:border-violet-500/30 transition-all flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <span className="text-white font-medium block truncate text-[11px]">{alt.title}</span>
                                      <span className="text-[9px] text-white/40 block">
                                        {alt.mediaType.toUpperCase()} {alt.year ? `· ${alt.year}` : ''} {alt.mediaType !== 'movie' ? `(${alt.airingStatus === 'finished' ? 'Ended' : 'Running'})` : ''}
                                      </span>
                                    </div>
                                    <div className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold text-violet-400 border border-violet-500/10 flex-shrink-0">
                                      Select
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
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
