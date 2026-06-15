import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/db'

// Stores last-seen timestamp in push_subscriptions.subscription JSONB.
// The web-push library only reads endpoint/keys — extra fields are ignored.
export async function POST() {
  const session = await getSession()
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', session.user.id)
    .single()

  if (!row) return NextResponse.json({ ok: true, skipped: 'no push subscription yet' })

  await supabase
    .from('push_subscriptions')
    .update({
      updated_at: new Date().toISOString(),
      subscription: { ...row.subscription, _last_seen: new Date().toISOString(), _inactivity_level: 0 },
    })
    .eq('user_id', session.user.id)

  return NextResponse.json({ ok: true })
}
