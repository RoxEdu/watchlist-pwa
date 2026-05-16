'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { STATUS_META, STATUS_ORDER, type Status, type WatchlistItem } from '@/lib/types'
import { setStatus } from '@/hooks/useWatchlist'
import { useUIStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const STATUS_ICONS: Record<Status, string> = {
  want_to_watch: '🔖',
  watching: '▶️',
  up_to_date: '⏸️',
  finished: '✅',
  on_hold: '🗂️',
  dropped: '❌',
}

export default function StatusPicker() {
  const { statusPickerItem, setStatusPickerItem } = useUIStore()
  const open = !!statusPickerItem

  async function handleSelect(status: Status) {
    if (!statusPickerItem) return
    await setStatus(statusPickerItem.id, status)
    setStatusPickerItem(null)
  }

  return (
    <AnimatePresence>
      {open && statusPickerItem && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setStatusPickerItem(null)}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-[#1a1a1a] border-t border-white/10 pb-safe"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Update Status</p>
              <p className="text-white font-semibold truncate mb-4">{statusPickerItem.title}</p>
              <div className="grid grid-cols-2 gap-2 pb-4">
                {STATUS_ORDER.map((s) => {
                  const meta = STATUS_META[s]
                  const active = statusPickerItem.status === s
                  return (
                    <button
                      key={s}
                      onClick={() => handleSelect(s)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all',
                        active
                          ? `${meta.bg} border border-current/30`
                          : 'bg-white/5 hover:bg-white/10',
                      )}
                    >
                      <span className="text-lg">{STATUS_ICONS[s]}</span>
                      <span className={cn('text-sm font-medium', active ? meta.color : 'text-white/80')}>
                        {meta.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
