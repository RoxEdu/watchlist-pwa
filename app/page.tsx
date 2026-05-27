'use client'

import { useMemo } from 'react'
import { UserCircle, Cloud, CloudOff, RefreshCw, Sparkles } from 'lucide-react'
import { useWatchlist } from '@/hooks/useWatchlist'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/lib/store'
import MediaCard, { MediaListItem } from '@/components/MediaCard'
import { AppLogo } from '@/components/Logo'
import { STATUS_META } from '@/lib/types'
import type { WatchlistItem } from '@/lib/types'
import SmartPaste from '@/components/SmartPaste'

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
  const { setProfileSheetOpen, setSmartPasteOpen } = useUIStore()

  const { watching, upToDate, wantToWatch, recent } = useMemo(() => ({
    watching: items.filter((i) => i.status === 'watching'),
    upToDate: items.filter((i) => i.status === 'up_to_date'),
    wantToWatch: items.filter((i) => i.status === 'want_to_watch'),
    recent: items.slice(0, 6),
  }), [items])

  const statCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const item of items) c[item.status] = (c[item.status] ?? 0) + 1
    return c
  }, [items])

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
        <button
          onClick={() => setProfileSheetOpen(true)}
          className="mt-1 flex items-center gap-2 rounded-full bg-white/8 px-3 py-2 hover:bg-white/12 transition-colors"
        >
          <SyncIcon state={user ? syncState : 'idle'} />
          {!user && <CloudOff size={14} className="text-white/30" />}
          <UserCircle size={20} className={user ? 'text-violet-400' : 'text-white/40'} />
        </button>
      </div>

      {/* Stat chips */}
      {items.length > 0 && (
        <div className="flex gap-3 overflow-x-auto px-4 mb-6 scrollbar-none">
          {(['watching', 'want_to_watch', 'finished', 'on_hold'] as const).map((s) => {
            const count = statCounts[s] ?? 0
            if (count === 0) return null
            const meta = STATUS_META[s]
            return (
              <div key={s} className={`flex-shrink-0 rounded-xl px-4 py-3 ${meta.bg}`}>
                <p className={`text-xl font-bold ${meta.color}`}>{count}</p>
                <p className="text-white/50 text-[11px] mt-0.5">{meta.label}</p>
              </div>
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
      <SmartPaste />
    </div>
  )
}
