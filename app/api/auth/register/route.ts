import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/db'
import { generateSalt, hashPassword, nameToId } from '@/lib/memberAuth'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  if (!password || password.length < 4) return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 })

  const id = nameToId(name)

  const { data: existing } = await supabase
    .from('member_users')
    .select('id')
    .eq('id', id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Account already exists — use the sign in link instead' }, { status: 409 })
  }

  const salt = generateSalt()
  const hash = hashPassword(password, salt)

  const { error } = await supabase.from('member_users').insert({ id, name, salt, hash })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const session = await getSession()
  session.user = { id, name, role: 'member' }
  await session.save()

  return NextResponse.json({ user: { id, name, role: 'member' } })
}
