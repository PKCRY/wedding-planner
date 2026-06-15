import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/db'
import type { Task, Event } from '@/lib/db'
import HerDashboardClient from './_components/HerDashboardClient'

export default async function HerDashboardPage() {
  const session = await getSession()
  if (!session.user) redirect('/login')
  if (session.user.role !== 'member') redirect('/dashboard')

  const [{ data: taskData }, { data: eventData }] = await Promise.all([
    supabase.from('tasks').select('*').in('assigned_to', ['siobhan', 'both']),
    supabase.from('events').select('*').order('date'),
  ])

  const allTasks = (taskData ?? []) as Task[]
  const events = (eventData ?? []) as Event[]

  // Top 5 non-done sorted by sort_order
  const sorted = [...allTasks].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
  const active = sorted.filter(t => t.status !== 'done')
  const top5 = active.slice(0, 5)
  const totalDone = allTasks.filter(t => t.status === 'done').length

  return (
    <HerDashboardClient
      user={session.user}
      initialTop5={top5}
      totalAssigned={allTasks.length}
      totalDone={totalDone}
      initialEvents={events}
    />
  )
}
