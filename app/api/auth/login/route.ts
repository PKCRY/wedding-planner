import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

const USERS = {
  nick: {
    id: 'nick',
    name: 'Nick',
    role: 'admin' as const,
    password: process.env.NICK_PASSWORD,
  },
  planning: {
    id: 'planning',
    name: 'Planning',
    role: 'admin' as const,
    password: 'CampCard2026',
  },
  mom: {
    id: 'mom',
    name: 'Mom',
    role: 'admin' as const,
    password: 'SecretCampCard2026',
  },
  motherofthebride: {
    id: 'motherofthebride',
    name: 'Mom',
    role: 'admin' as const,
    password: 'CampCard2026',
  },
  siobhan: {
    id: 'siobhan',
    name: 'Siobhan',
    role: 'member' as const,
    password: process.env.FIANCE_PASSWORD,
  },
}

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  const user = USERS[username as keyof typeof USERS]
  if (!user || !user.password || password !== user.password) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const session = await getSession()
  session.user = { id: user.id, name: user.name, role: user.role }
  await session.save()

  return NextResponse.json({ user: { id: user.id, name: user.name, role: user.role } })
}
