'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Film, Tv, Star, Compass } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/movies', label: 'Movies', icon: Film },
  { href: '/series', label: 'Series', icon: Tv },
  { href: '/anime', label: 'Anime', icon: Star },
  { href: '/discover', label: 'Discover', icon: Compass },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-white/8 pb-safe">
      <div className="flex">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors',
                active ? 'text-violet-400' : 'text-white/35 hover:text-white/60',
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
