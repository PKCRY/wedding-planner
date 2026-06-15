import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/db'
import { webpush } from '@/lib/push'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { to, title, body, url, badge_count } = await req.json()
  if (!to || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  let query = supabase.from('push_subscriptions').select('subscription')
  if (to !== 'all') query = query.eq('user_id', to)

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
