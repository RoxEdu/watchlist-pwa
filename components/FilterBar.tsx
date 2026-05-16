'use client'

import { STATUS_META, STATUS_ORDER, type Status } from '@/lib/types'
import { useUIStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const ALL_FILTERS: Array<{ id: Status | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  ...STATUS_ORDER.map((s) => ({ id: s, label: STATUS_META[s].label })),
]

export default function FilterBar() {
  const { statusFilter, setStatusFilter } = useUIStore()

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none">
      {ALL_FILTERS.map((f) => {
        const active = statusFilter === f.id
        const meta = f.id !== 'all' ? STATUS_META[f.id] : null
        return (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={cn(
              'flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
              active
                ? meta
                  ? `${meta.bg} ${meta.color} border border-current/20`
                  : 'bg-violet-600 text-white'
                : 'bg-white/8 text-white/50 hover:bg-white/12 hover:text-white/80',
            )}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
