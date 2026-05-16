import { NextRequest, NextResponse } from 'next/server'

const OMDB_BASE = 'https://www.omdbapi.com'

export async function GET(req: NextRequest) {
  const apiKey = process.env.OMDB_API_KEY
  if (!apiKey) {
    return NextResponse.json({ Response: 'False', Error: 'API key not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const forwardParams = new URLSearchParams()
  forwardParams.set('apikey', apiKey)

  for (const [k, v] of searchParams.entries()) {
    forwardParams.set(k, v)
  }

  const url = `${OMDB_BASE}/?${forwardParams.toString()}`
  const res = await fetch(url, { next: { revalidate: 3600 } })

  if (!res.ok) {
    return NextResponse.json({ Response: 'False', Error: 'Upstream error' }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
