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

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: row } = await supabase
    .from('user_last_seen')
    .select('last_seen, inactivity_level')
    .eq('user_id', 'nick')
    .single()

  if (!row) {
    return NextResponse.json({ ok: true, reason: 'no last_seen record — Nick has never opened the app' })
  }

  const hoursSince = (Date.now() - new Date(row.last_seen).getTime()) / 3_600_000
  const currentLevel: number = row.inactivity_level ?? 0

  let targetLevel = 0
  for (let i = 0; i < LEVELS.length; i++) {
    if (hoursSince >= LEVELS[i].minHours) targetLevel = i + 1
  }

  if (targetLevel <= currentLevel) {
    return NextResponse.json({ ok: true, reason: 'already notified at this level', level: currentLevel, hoursSince: Math.round(hoursSince) })
  }

  const level = LEVELS[targetLevel - 1]

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', 'nick')

  if (subs?.length) {
    const payload = JSON.stringify({
      title: 'Wedding Planner — Hey Nick! 👋',
      body: level.message,
      url: '/dashboard',
    })
    await Promise.allSettled(
      subs.map(({ subscription }) => webpush.sendNotification(subscription, payload))
    )
  }

  await supabase
    .from('user_last_seen')
    .update({ inactivity_level: targetLevel })
    .eq('user_id', 'nick')

  return NextResponse.json({ ok: true, sent: subs?.length ?? 0, level: targetLevel, hoursSince: Math.round(hoursSince) })
}
