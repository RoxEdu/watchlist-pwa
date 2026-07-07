import { NextRequest, NextResponse } from 'next/server'

// iTunes Search API does not send CORS headers, so browser fetches are blocked.
// This route proxies the request server-side so the client can use it reliably.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const term = searchParams.get('term')
  if (!term) {
    return NextResponse.json({ results: [] })
  }

  const forward = new URLSearchParams()
  forward.set('term', term)
  forward.set('limit', searchParams.get('limit') ?? '30')
  forward.set('country', searchParams.get('country') ?? 'us')

  try {
    const res = await fetch(`https://itunes.apple.com/search?${forward.toString()}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) {
      return NextResponse.json({ results: [] }, { status: 200 })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ results: [] }, { status: 200 })
  }
}
