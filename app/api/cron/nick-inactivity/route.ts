import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { webpush } from '@/lib/push'

const LEVELS: { minHours: number; message: string }[] = [
  {
    minHours: 8,
    message: "Hey, you haven't checked the wedding planner in a while 👀 A few tasks might need your attention!",
  },
  {
    minHours: 16,
    message: "You really should check in — Siobhan's counting on you to keep things moving! 😅",
  },
  {
    minHours: 24,
    message: "It's been over a day! Wedding tasks are piling up. Don't leave Siobhan hanging 🚨",
  },
  {
    minHours: 48,
    message: "NICK. You haven't opened the wedding planner in 2+ days. The wedding is coming!! Open it now! 🆘🆘",
  },
]

export async function run() {
  // last_seen and inactivity_level are stored in push_subscriptions.subscription JSONB
  // to avoid needing a separate user_last_seen table
  const { data: row } = await supabase
    .from('push_subscriptions')
    .select('subscription, updated_at')
    .eq('user_id', 'nick')
    .single()

  if (!row) {
    return { ok: true, reason: 'no push subscription for nick yet' }
  }

  const lastSeen: string = row.subscription._last_seen ?? row.updated_at
  const hoursSince = (Date.now() - new Date(lastSeen).getTime()) / 3_600_000
  const currentLevel: number = row.subscription._inactivity_level ?? 0

  let targetLevel = 0
  for (let i = 0; i < LEVELS.length; i++) {
    if (hoursSince >= LEVELS[i].minHours) targetLevel = i + 1
  }

  if (targetLevel <= currentLevel) {
    return { ok: true, reason: 'already notified at this level', level: currentLevel, hoursSince: Math.round(hoursSince) }
  }

  const level = LEVELS[targetLevel - 1]

  const payload = JSON.stringify({
    title: 'Wedding Planner — Hey Nick! 👋',
    body: level.message,
    url: '/dashboard',
    badge_count: 1,
  })

  await webpush.sendNotification(row.subscription, payload)

  // Update the inactivity level in-place within the subscription JSONB
  await supabase
    .from('push_subscriptions')
    .update({ subscription: { ...row.subscription, _inactivity_level: targetLevel } })
    .eq('user_id', 'nick')

  return { ok: true, sent: 1, level: targetLevel, hoursSince: Math.round(hoursSince) }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await run())
}
