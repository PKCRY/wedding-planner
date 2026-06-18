import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/db'
import { verifyPassword } from '@/lib/memberAuth'

const HARDCODED_USERS = {
  nick: {
    id: 'nick',
    name: 'Nick',
    role: 'admin' as const,
    password: process.env.NICK_PASSWORD,
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
  if (!username || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
  }

  const normalized = (username as string).trim().toLowerCase()

  // Check hardcoded admin/Siobhan first
  const hardcoded = HARDCODED_USERS[normalized as keyof typeof HARDCODED_USERS]
  if (hardcoded) {
    if (!hardcoded.password || password !== hardcoded.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    const session = await getSession()
    session.user = { id: hardcoded.id, name: hardcoded.name, role: hardcoded.role }
    await session.save()
    return NextResponse.json({ user: { id: hardcoded.id, name: hardcoded.name, role: hardcoded.role } })
  }

  // Look up member by name (case-insensitive)
  const { data: member } = await supabase
    .from('member_users')
    .select('id, name, salt, hash')
    .ilike('name', username.trim())
    .single()

  if (!member || !verifyPassword(password, member.salt, member.hash)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const session = await getSession()
  session.user = { id: member.id, name: member.name, role: 'member' }
  await session.save()
  return NextResponse.json({ user: { id: member.id, name: member.name, role: 'member' } })
}
