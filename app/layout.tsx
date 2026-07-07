import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import QuickAdd from '@/components/QuickAdd'
import DetailSheet from '@/components/DetailSheet'
import StatusPicker from '@/components/StatusPicker'
import ProfileSheet from '@/components/ProfileSheet'
import RatingPrompt from '@/components/RatingPrompt'

export const metadata: Metadata = {
  title: 'Watchlist',
  description: 'Your smart personal watchlist for movies, series, and anime',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Watchlist',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="h-full">
        <main className="pb-16">
          {children}
        </main>
        <BottomNav />
        <QuickAdd />
        <DetailSheet />
        <StatusPicker />
        <ProfileSheet />
        <RatingPrompt />
      </body>
    </html>
  )
}
