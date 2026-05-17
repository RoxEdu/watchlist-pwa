import type { NextConfig } from 'next'
import withPWA from '@ducanh2912/next-pwa'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // iTunes / Apple artwork
      { protocol: 'https', hostname: '**.mzstatic.com' },
      // TVMaze posters
      { protocol: 'https', hostname: 'static.tvmaze.com' },
      // MyAnimeList / Jikan posters
      { protocol: 'https', hostname: 'cdn.myanimelist.net' },
      // TMDB (kept for any legacy items)
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'ia.media-imdb.com' },
    ],
  },
}

export default withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
  },
})(nextConfig)
