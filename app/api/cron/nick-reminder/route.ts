import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { webpush } from '@/lib/push'
import type { Task } from '@/lib/db'

export async function run() {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, priority, status, sort_order, assigned_to')
    .in('status', ['pending', 'in_progress'])
    .in('assigned_to', ['nick', 'both'])
    .order('sort_order', { ascending: true })

  if (error) return { error: error.message }

  const activeTasks = (tasks as Task[]) ?? []

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const sorted = [...activeTasks].sort(
    (a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
  )

  const top = sorted.slice(0, 5)
  const taskLines = top.map(t => {
    const label = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢'
    return `${label} ${t.title}`
  })

  const body = taskLines.length
    ? taskLines.join('\n')
    : 'No active tasks right now — you\'re all clear!'

  const badge_count = activeTasks.length

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', 'nick')

  if (!subs?.length) return { ok: true, sent: 0 }

  const payload = JSON.stringify({
    title: 'Wedding Planner · Nick',
    body,
    url: '/dashboard',
    badge_count,
  })

  await Promise.allSettled(
    subs.map(({ subscription }) => webpush.sendNotification(subscription, payload))
  )

  return { ok: true, sent: subs.length, tasks: top.length, badge: badge_count }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await run())
}
