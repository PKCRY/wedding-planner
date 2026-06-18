import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const trimmed = typeof body.name === 'string' ? body.name.trim() : ''
  if (!trimmed) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const id = trimmed.toLowerCase().replace(/\s+/g, '-')
  const session = await getSession()
  session.user = { id, name: trimmed, role: 'member' }
  await session.save()

  return NextResponse.json({ user: { id, name: trimmed, role: 'member' } })
}
