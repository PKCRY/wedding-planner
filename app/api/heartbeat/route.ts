import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/db'

export async function POST() {
  const session = await getSession()
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.from('user_last_seen').upsert(
    { user_id: session.user.id, last_seen: new Date().toISOString(), inactivity_level: 0 },
    { onConflict: 'user_id' }
  )

  return NextResponse.json({ ok: true })
}
