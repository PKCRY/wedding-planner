import { NextRequest, NextResponse } from 'next/server'
import { getSession, isAdmin } from '@/lib/session'
import { supabase } from '@/lib/db'
import { webpush, BLOCKED_USER_IDS } from '@/lib/push'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { to, title, body, url, badge_count } = await req.json()
  if (!to || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  if (BLOCKED_USER_IDS.includes(to)) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  let query = supabase.from('push_subscriptions').select('subscription')
  if (to !== 'all') {
    query = query.eq('user_id', to)
  } else {
    for (const blocked of BLOCKED_USER_IDS) {
      query = query.neq('user_id', blocked)
    }
  }

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows?.length) return NextResponse.json({ error: 'No subscribers found' }, { status: 404 })

  const payload = JSON.stringify({
    title,
    body: body || '',
    url: url || '/',
    ...(badge_count !== undefined && { badge_count }),
  })

  await Promise.allSettled(
    rows.map(({ subscription }) =>
      webpush.sendNotification(subscription, payload)
    )
  )

  return NextResponse.json({ ok: true, sent: rows.length })
}
