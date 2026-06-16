import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { webpush } from '@/lib/push'
import type { Task } from '@/lib/db'

const STALE_HOURS = 24

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, assigned_to, status_changed_at')
    .eq('status', 'in_progress')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const cutoff = Date.now() - STALE_HOURS * 3_600_000
  const stale = ((tasks as Task[]) ?? []).filter(t => {
    const changedAt = t.status_changed_at ? new Date(t.status_changed_at).getTime() : 0
    return changedAt <= cutoff
  })

  if (!stale.length) return NextResponse.json({ ok: true, sent: 0, stale: 0 })

  const lines = stale.slice(0, 5).map(t => `• ${t.title} (${t.assigned_to})`)
  const body = `Still marked "in progress" — update the status if it's done or stuck:\n${lines.join('\n')}`

  const { data: subs } = await supabase.from('push_subscriptions').select('subscription')
  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0, stale: stale.length })

  const payload = JSON.stringify({
    title: '⏳ Board check-in',
    body,
    url: '/dashboard',
    badge_count: stale.length,
  })

  await Promise.allSettled(
    subs.map(({ subscription }) => webpush.sendNotification(subscription, payload))
  )

  return NextResponse.json({ ok: true, sent: subs.length, stale: stale.length })
}
