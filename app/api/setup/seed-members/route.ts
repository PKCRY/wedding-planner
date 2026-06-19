import { NextRequest, NextResponse } from 'next/server'
import { getSession, isAdmin } from '@/lib/session'
import { supabase } from '@/lib/db'
import { generateSalt, hashPassword, nameToId } from '@/lib/memberAuth'

const PRESET_MEMBERS = [
  { name: 'Taylor', password: 'SecretCampCard2026' },
  { name: 'Patricia McShea', password: 'SecretCampCard2026' },
]

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  for (const member of PRESET_MEMBERS) {
    const id = nameToId(member.name)
    const salt = generateSalt()
    const hash = hashPassword(member.password, salt)

    const { error } = await supabase.from('member_users').upsert(
      { id, name: member.name, salt, hash },
      { onConflict: 'id' }
    )
    results.push({ name: member.name, status: error ? `error: ${error.message}` : 'created/updated' })
  }

  return NextResponse.json({ ok: true, results })
}
