import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { webpush } from '@/lib/push'

const MESSAGES = [
  'Take a look at your wedding tasks — a few things need your attention! 💍',
  'Wedding check-in time! See what\'s on your list today 🌸',
  'Hey Siobhan! Quick reminder to peek at your wedding tasks 💐',
  'Wedding planning update — check in when you get a chance! 🥂',
]

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, status, assigned_to')
    .in('status', ['pending', 'in_progress'])
    .in('assigned_to', ['siobhan', 'both'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const badge_count = tasks?.length ?? 0
  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
  const body = badge_count > 0
    ? `You have ${badge_count} active task${badge_count !== 1 ? 's' : ''}. ${msg}`
    : msg

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', 'siobhan')

  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 })

  const payload = JSON.stringify({
    title: 'Wedding Planner 💍',
    body,
    url: '/her-dashboard',
    badge_count,
  })

  await Promise.allSettled(
    subs.map(({ subscription }) => webpush.sendNotification(subscription, payload))
  )

  return NextResponse.json({ ok: true, sent: subs.length, badge: badge_count })
}
