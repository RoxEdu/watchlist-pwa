import { NextRequest, NextResponse } from 'next/server'
import { getPopularMovies, getPopularSeries, getPopularAnime } from '@/lib/tmdb'

// Runs the "popular picks" fetches server-side. This avoids browser CORS issues
// (notably iTunes, which sends no CORS headers) and lets us cache the results.
export async function GET(req: NextRequest) {
  const category = new URL(req.url).searchParams.get('category')

  try {
    let results
    if (category === 'movies') results = await getPopularMovies()
    else if (category === 'series') results = await getPopularSeries()
    else if (category === 'anime') results = await getPopularAnime()
    else return NextResponse.json({ error: 'Unknown category' }, { status: 400 })

    return NextResponse.json(results, {
      headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load' }, { status: 502 })
  }
}
