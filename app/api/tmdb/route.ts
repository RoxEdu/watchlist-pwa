import { NextRequest, NextResponse } from 'next/server'

const TMDB_BASE = 'https://api.themoviedb.org/3'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  if (!path) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'TMDB API key not configured' }, { status: 500 })
  }

  const forwardParams = new URLSearchParams()
  forwardParams.set('api_key', apiKey)
  for (const [k, v] of searchParams.entries()) {
    if (k !== 'path') forwardParams.set(k, v)
  }

  const url = `${TMDB_BASE}${path}?${forwardParams.toString()}`
  const res = await fetch(url, { next: { revalidate: 300 } })

  if (!res.ok) {
    return NextResponse.json({ error: 'TMDB upstream error' }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
