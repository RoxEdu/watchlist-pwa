import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  if (!query) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 })
  }

  const cleanQuery = query.toLowerCase().trim()
  if (!cleanQuery) {
    return NextResponse.json([])
  }

  const char = cleanQuery[0]
  if (!/[a-z0-9]/.test(char)) {
    return NextResponse.json([])
  }

  try {
    const url = `https://v3.sg.media-imdb.com/suggests/${char}/${encodeURIComponent(cleanQuery)}.json`
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) {
      return NextResponse.json({ error: 'IMDb upstream error' }, { status: res.status })
    }
    const text = await res.text()
    
    // Parse JSONP callback wrapper: imdb$query(...)
    const start = text.indexOf('(')
    const end = text.lastIndexOf(')')
    if (start === -1 || end === -1) {
      return NextResponse.json([])
    }
    const jsonStr = text.substring(start + 1, end)
    const data = JSON.parse(jsonStr)
    return NextResponse.json(data.d ?? [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
