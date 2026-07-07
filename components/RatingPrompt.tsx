'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star } from 'lucide-react'
import { useUIStore } from '@/lib/store'
import { updateItem } from '@/lib/db'
import { pushItem } from '@/lib/sync'
import { db } from '@/lib/db'

export default function RatingPrompt() {
  const { ratingPromptItem, setRatingPromptItem } = useUIStore()
  const [hover, setHover] = useState(0)
  const open = !!ratingPromptItem

  // Reset the hover preview whenever a new item is prompted
  useEffect(() => {
    setHover(0)
  }, [ratingPromptItem?.id])

  async function save(rating: number) {
    if (!ratingPromptItem) return
    const id = ratingPromptItem.id
    setRatingPromptItem(null)
    await updateItem(id, { myRating: rating })
    const updated = await db.items.get(id)
    if (updated) {
      pushItem(updated).catch(() => {})
      // Keep an open detail sheet in sync if it's the same item
      const detail = useUIStore.getState().detailItem
      if (detail && detail.id === id) useUIStore.getState().setDetailItem(updated)
    }
  }

  return (
    <AnimatePresence>
      {open && ratingPromptItem && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setRatingPromptItem(null)}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl bg-[#1a1a1a] border-t border-white/10 pb-safe"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="px-6 pt-5 pb-8 text-center">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-white font-semibold text-lg leading-tight">Finished!</p>
              <p className="text-white/50 text-sm mt-1 truncate">
                How would you rate <span className="text-white/80">{ratingPromptItem.title}</span>?
              </p>

              <div className="flex justify-center gap-2 mt-6">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => save(n)}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    className="p-1.5 transition-transform active:scale-90 hover:scale-110"
                    aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                  >
                    <Star
                      size={34}
                      className={
                        (hover || 0) >= n
                          ? 'text-amber-400 fill-amber-400 transition-colors'
                          : 'text-white/20 transition-colors'
                      }
                    />
                  </button>
                ))}
              </div>

              <button
                onClick={() => setRatingPromptItem(null)}
                className="mt-6 text-white/40 text-sm hover:text-white/70 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
