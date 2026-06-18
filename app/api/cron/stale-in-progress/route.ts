import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { webpush, BLOCKED_USER_IDS } from '@/lib/push'
import type { Task } from '@/lib/db'

const STALE_HOURS = 24

export async function run() {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, assigned_to, status_changed_at')
    .eq('status', 'in_progress')

  if (error) return { error: error.message }

  const cutoff = Date.now() - STALE_HOURS * 3_600_000
  const stale = ((tasks as Task[]) ?? []).filter(t => {
    const changedAt = t.status_changed_at ? new Date(t.status_changed_at).getTime() : 0
    return changedAt <= cutoff
  })

  if (!stale.length) return { ok: true, sent: 0, stale: 0 }

  const lines = stale.slice(0, 5).map(t => `• ${t.title} (${t.assigned_to})`)
  const body = `Still marked "in progress" — update the status if it's done or stuck:\n${lines.join('\n')}`

  let subsQuery = supabase.from('push_subscriptions').select('subscription')
  for (const blocked of BLOCKED_USER_IDS) {
    subsQuery = subsQuery.neq('user_id', blocked)
  }
  const { data: subs } = await subsQuery
  if (!subs?.length) return { ok: true, sent: 0, stale: stale.length }

  const payload = JSON.stringify({
    title: '⏳ Board check-in',
    body,
    url: '/dashboard',
    badge_count: stale.length,
  })

  await Promise.allSettled(
    subs.map(({ subscription }) => webpush.sendNotification(subscription, payload))
  )

  return { ok: true, sent: subs.length, stale: stale.length }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await run())
}
