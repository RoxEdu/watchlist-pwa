'use client'

import { useMemo, useState } from 'react'
import { UserCircle, Cloud, CloudOff, RefreshCw, Sparkles, Shuffle } from 'lucide-react'
import { useWatchlist } from '@/hooks/useWatchlist'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/lib/store'
import MediaCard, { MediaListItem } from '@/components/MediaCard'
import { AppLogo } from '@/components/Logo'
import InstallButton from '@/components/InstallButton'
import { STATUS_META } from '@/lib/types'
import type { Status, WatchlistItem } from '@/lib/types'
import SmartPaste from '@/components/SmartPaste'

// Status chips shown at the top of Home, in display priority order.
const HOME_FILTER_STATUSES: Status[] = [
  'watching', 'want_to_watch', 'up_to_date', 'finished', 'on_hold', 'dropped',
]

function SectionRow({ title, items }: { title: string; items: WatchlistItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-white font-semibold text-base">{title}</h2>
        <span className="text-white/30 text-xs">{items.length}</span>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 scrollbar-none pb-1">
        {items.slice(0, 10).map((item) => (
          <div key={item.id} className="flex-shrink-0 w-[120px]">
            <MediaCard item={item} />
          </div>
        ))}
      </div>
    </div>
  )
}

function SyncIcon({ state }: { state: ReturnType<typeof useAuth>['syncState'] }) {
  if (state === 'syncing') return <RefreshCw size={15} className="text-amber-400 animate-spin" />
  if (state === 'done') return <Cloud size={15} className="text-emerald-400" />
  if (state === 'error') return <CloudOff size={15} className="text-red-400" />
  return null
}

export default function HomePage() {
  const { items, isLoading } = useWatchlist()
  const { user, syncState } = useAuth()
  const { setProfileSheetOpen, setSmartPasteOpen, setDetailItem } = useUIStore()

  // Active status filter for the Home view (null = overview with section rows)
  const [homeFilter, setHomeFilter] = useState<Status | null>(null)

  const { watching, upToDate, wantToWatch, recent } = useMemo(() => ({
    watching: items.filter((i) => i.status === 'watching'),
    upToDate: items.filter((i) => i.status === 'up_to_date'),
    wantToWatch: items.filter((i) => i.status === 'want_to_watch'),
    // Recency-true, independent of the app's default "smart" sort
    recent: [...items]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6),
  }), [items])

  const statCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const item of items) c[item.status] = (c[item.status] ?? 0) + 1
    return c
  }, [items])

  const filteredItems = useMemo(
    () => (homeFilter ? items.filter((i) => i.status === homeFilter) : []),
    [items, homeFilter],
  )

  function surpriseMe() {
    const pool = items.filter((i) => i.status === 'want_to_watch')
    const source = pool.length > 0 ? pool : items
    if (source.length === 0) return
    setDetailItem(source[Math.floor(Math.random() * source.length)])
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-12 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <AppLogo size={30} />
            <h1 className="text-white text-xl font-bold tracking-tight">Watchlist</h1>
          </div>
          <p className="text-white/30 text-sm mt-1.5 pl-0.5">{items.length} titles</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <InstallButton />
          {items.length > 0 && (
            <button
              onClick={surpriseMe}
              className="flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/12 hover:text-white transition-colors"
              title="Open a random title from your list"
            >
              <Shuffle size={14} /> <span className="hidden sm:inline">Surprise me</span>
            </button>
          )}
          <button
            onClick={() => setProfileSheetOpen(true)}
            className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-2 hover:bg-white/12 transition-colors"
          >
            <SyncIcon state={user ? syncState : 'idle'} />
            {!user && <CloudOff size={14} className="text-white/30" />}
            <UserCircle size={20} className={user ? 'text-violet-400' : 'text-white/40'} />
          </button>
        </div>
      </div>

      {/* Status filter chips (tap to filter the view) */}
      {items.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto px-4 mb-6 scrollbar-none">
          <button
            onClick={() => setHomeFilter(null)}
            className={`flex-shrink-0 rounded-xl px-4 py-3 transition-all ${
              homeFilter === null ? 'bg-violet-600' : 'bg-white/8 hover:bg-white/12'
            }`}
          >
            <p className={`text-xl font-bold ${homeFilter === null ? 'text-white' : 'text-white/80'}`}>{items.length}</p>
            <p className="text-white/50 text-[11px] mt-0.5">All</p>
          </button>
          {HOME_FILTER_STATUSES.map((s) => {
            const count = statCounts[s] ?? 0
            if (count === 0) return null
            const meta = STATUS_META[s]
            const active = homeFilter === s
            return (
              <button
                key={s}
                onClick={() => setHomeFilter(active ? null : s)}
                className={`flex-shrink-0 rounded-xl px-4 py-3 text-left transition-all ${meta.bg} ${
                  active ? 'ring-2 ring-current ' + meta.color : 'opacity-90 hover:opacity-100'
                }`}
              >
                <p className={`text-xl font-bold ${meta.color}`}>{count}</p>
                <p className="text-white/50 text-[11px] mt-0.5">{meta.label}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="text-6xl mb-4">🎬</div>
          <h2 className="text-white font-semibold text-lg mb-2">Nothing here yet</h2>
          <p className="text-white/40 text-sm leading-relaxed max-w-xs mb-6">
            Tap <span className="text-violet-400">+</span> to add titles, or import a list directly.
          </p>
          <div className="flex flex-col gap-2.5 w-full max-w-[200px] items-center">
            <button
              onClick={() => setSmartPasteOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition-colors shadow-lg shadow-violet-600/10 active:scale-[0.98]"
            >
              <Sparkles size={14} /> Smart Paste List
            </button>
            {!user && (
              <button
                className="text-white/40 text-xs hover:text-white/60 transition-colors py-1 underline"
                onClick={() => setProfileSheetOpen(true)}
              >
                Sign in to sync across devices
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filtered grid view */}
      {homeFilter ? (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-white font-semibold text-base">{STATUS_META[homeFilter].label}</h2>
            <span className="text-white/30 text-xs">{filteredItems.length}</span>
          </div>
          {filteredItems.length === 0 ? (
            <p className="text-white/40 text-sm py-10 text-center">Nothing in this list yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredItems.map((item) => (
                <MediaCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <SectionRow title="Continue Watching" items={watching} />
          <SectionRow title="Up to Date" items={upToDate} />
          <SectionRow title="Want to Watch" items={wantToWatch} />

          {recent.length > 0 && (
            <div className="mb-6 px-4">
              <h2 className="text-white font-semibold text-base mb-3">Recently Updated</h2>
              <div className="flex flex-col gap-2">
                {recent.map((item) => <MediaListItem key={item.id} item={item} />)}
              </div>
            </div>
          )}
        </>
      )}
      <SmartPaste />
    </div>
  )
}
