'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { X, LogIn, LogOut, Download, Upload, RefreshCw, Cloud, CloudOff, Sparkles } from 'lucide-react'
import { useUIStore } from '@/lib/store'
import { useAuth } from '@/hooks/useAuth'
import { getAllItems, importItems } from '@/lib/db'
import { syncFromCloud, pushItem } from '@/lib/sync'
import { cn } from '@/lib/utils'
import { useWatchlist, syncWatchlistMetadata } from '@/hooks/useWatchlist'

function SyncBadge({ state }: { state: ReturnType<typeof useAuth>['syncState'] }) {
  if (state === 'syncing') return (
    <span className="flex items-center gap-1 text-xs text-amber-400">
      <RefreshCw size={11} className="animate-spin" /> Syncing…
    </span>
  )
  if (state === 'done') return (
    <span className="flex items-center gap-1 text-xs text-emerald-400">
      <Cloud size={11} /> Synced
    </span>
  )
  if (state === 'error') return (
    <span className="flex items-center gap-1 text-xs text-red-400">
      <CloudOff size={11} /> Sync failed
    </span>
  )
  return null
}

export default function ProfileSheet() {
  const { profileSheetOpen, setProfileSheetOpen, setSmartPasteOpen } = useUIStore()
  const { user, syncState, signInWithGoogle, signOut } = useAuth()
  const { items } = useWatchlist()
  const fileRef = useRef<HTMLInputElement>(null)

  const [isSyncingMetadata, setIsSyncingMetadata] = useState(false)
  const [syncProgressMsg, setSyncProgressMsg] = useState('')
  const [syncResult, setSyncResult] = useState<{ updatedCount: number; newSeasons: string[] } | null>(null)

  function close() {
    if (isSyncingMetadata) return
    setProfileSheetOpen(false)
    setSyncResult(null)
  }

  async function handleCheckUpdates() {
    if (isSyncingMetadata) return
    setIsSyncingMetadata(true)
    setSyncResult(null)
    setSyncProgressMsg('Analyzing watchlist...')
    try {
      const result = await syncWatchlistMetadata((msg) => {
        setSyncProgressMsg(msg)
      })
      setSyncResult(result)
    } catch (err) {
      alert('Failed to check for updates.')
    } finally {
      setIsSyncingMetadata(false)
    }
  }

  async function handleExport() {
    const all = await getAllItems()
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `watchlist-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) throw new Error('Invalid format')
      const count = await importItems(parsed)
      // Push newly imported items to cloud if logged in
      if (user) {
        const all = await getAllItems()
        await Promise.all(all.map((i) => pushItem(i)))
      }
      alert(`Imported ${count} item${count !== 1 ? 's' : ''} successfully.`)
    } catch {
      alert('Could not read file. Make sure it is a valid Watchlist export.')
    }
    e.target.value = ''
  }

  async function handleManualSync() {
    await syncFromCloud()
  }

  const avatar = user?.user_metadata?.avatar_url as string | undefined
  const name = (user?.user_metadata?.full_name ?? user?.email ?? '') as string

  return (
    <AnimatePresence>
      {profileSheetOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-[#141414] border-t border-white/10 pb-safe overflow-hidden relative"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/20" />

            {/* Close */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <p className="text-white font-semibold text-base">Account & Data</p>
              <button onClick={close} className="p-2 rounded-full bg-white/8 text-white/60 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="px-4 pb-6 space-y-3 mt-2">
              {/* Auth section */}
              {user ? (
                <div className="bg-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    {avatar ? (
                      <Image src={avatar} alt={name} width={44} height={44} className="rounded-full" />
                    ) : (
                      <div className="h-11 w-11 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-lg">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{name}</p>
                      <p className="text-white/40 text-xs truncate">{user.email}</p>
                    </div>
                    <SyncBadge state={syncState} />
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleManualSync}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm text-white/70 bg-white/8 hover:bg-white/12 transition-colors"
                    >
                      <RefreshCw size={14} /> Sync now
                    </button>
                    <button
                      onClick={async () => { await signOut(); close() }}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                    >
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-11 w-11 rounded-full bg-white/10 flex items-center justify-center">
                      <CloudOff size={20} className="text-white/40" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">Not signed in</p>
                      <p className="text-white/40 text-xs">Data is saved locally only</p>
                    </div>
                  </div>
                  <button
                    onClick={signInWithGoogle}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-3 bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Sign in with Google
                  </button>
                </div>
              )}

              {/* Stats */}
              <div className="bg-white/5 rounded-2xl px-4 py-3 flex items-center justify-between">
                <p className="text-white/60 text-sm">Total titles</p>
                <p className="text-white font-bold">{items.length}</p>
              </div>

              {/* Smart Paste */}
              <button
                onClick={() => { setSmartPasteOpen(true); close() }}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-gradient-to-r from-violet-600/15 to-fuchsia-600/15 border border-violet-500/20 hover:from-violet-600/20 hover:to-fuchsia-600/20 transition-all text-left"
              >
                <div className="h-9 w-9 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Sparkles size={16} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold flex items-center gap-1.5">
                    Smart Paste List <span className="rounded bg-violet-600/30 text-violet-300 text-[9px] font-bold px-1 py-0.5 uppercase tracking-wider">New</span>
                  </p>
                  <p className="text-white/40 text-xs">Paste titles & auto-sort into watchlist</p>
                </div>
              </button>

              {/* Check for Updates */}
              <button
                onClick={handleCheckUpdates}
                disabled={isSyncingMetadata}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-white/5 hover:bg-white/8 transition-colors text-left disabled:opacity-50 cursor-pointer"
              >
                <div className="h-9 w-9 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <RefreshCw size={16} className={cn("text-violet-400", isSyncingMetadata && "animate-spin")} />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Check for Updates</p>
                  <p className="text-white/40 text-xs">Scan watchlist for new seasons/episodes</p>
                </div>
              </button>

              {/* Export */}
              <button
                onClick={handleExport}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-white/5 hover:bg-white/8 transition-colors text-left cursor-pointer"
              >
                <div className="h-9 w-9 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Download size={16} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Export as JSON</p>
                  <p className="text-white/40 text-xs">Download all your watchlist data</p>
                </div>
              </button>

              {/* Import */}
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-white/5 hover:bg-white/8 transition-colors text-left cursor-pointer"
              >
                <div className="h-9 w-9 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Upload size={16} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Import from JSON</p>
                  <p className="text-white/40 text-xs">Merge from a previous export</p>
                </div>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImport}
              />
            </div>

            {/* Progress overlay */}
            <AnimatePresence>
              {isSyncingMetadata && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 px-6 text-center rounded-t-2xl"
                >
                  <RefreshCw size={36} className="text-violet-400 animate-spin mb-4" />
                  <h3 className="text-white font-semibold text-base mb-1.5">Checking for Updates...</h3>
                  <p className="text-violet-300/80 text-xs font-mono max-w-xs truncate px-4">
                    {syncProgressMsg}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Results overlay */}
            <AnimatePresence>
              {syncResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 z-50 flex flex-col bg-[#141414] p-4 rounded-t-2xl"
                >
                  <div className="flex items-center justify-between border-b border-white/8 pb-3 mb-4 flex-shrink-0">
                    <h3 className="text-white font-semibold text-base">Update Check Complete</h3>
                    <button
                      onClick={() => setSyncResult(null)}
                      className="p-1 rounded-full bg-white/8 text-white/60 hover:text-white cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-white/60 text-xs uppercase tracking-wider font-semibold">Updates Summary</p>
                      <p className="text-white text-sm mt-1">
                        Updated season/episode counts for <span className="text-violet-400 font-bold">{syncResult.updatedCount}</span> titles.
                      </p>
                    </div>

                    {syncResult.newSeasons.length > 0 ? (
                      <div>
                        <p className="text-white/40 text-xs uppercase tracking-wider font-semibold px-1 mb-2">New Seasons Detected</p>
                        <div className="space-y-2">
                          {syncResult.newSeasons.map((item, idx) => (
                            <div key={idx} className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3 flex items-start gap-2">
                              <span className="text-emerald-400 text-sm">🎉</span>
                              <p className="text-emerald-300 text-xs font-medium leading-relaxed">{item}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/5 rounded-xl p-4 text-center py-6 text-white/40 text-xs">
                        No new seasons or sequels detected this time. All shows are up to date!
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setSyncResult(null)}
                    className="w-full mt-4 bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-xl transition-all active:scale-[0.98] cursor-pointer flex-shrink-0"
                  >
                    Done
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
