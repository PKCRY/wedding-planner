import { redirect } from 'next/navigation'
import { getSession, isAdmin } from '@/lib/session'
import { supabase } from '@/lib/db'
import type { Task, Event } from '@/lib/db'
import HerDashboardClient from './_components/HerDashboardClient'
import Heartbeat from '@/components/Heartbeat'

export default async function HerDashboardPage() {
  const session = await getSession()
  if (!session.user) redirect('/login')
  if (isAdmin(session.user)) redirect('/dashboard')

  const memberId = session.user.id
  const taskQuery = memberId === 'siobhan'
    ? supabase.from('tasks').select('*').or('assigned_to.ilike.%siobhan%,assigned_to.eq.both')
    : supabase.from('tasks').select('*').ilike('assigned_to', `%${memberId}%`)

  const [{ data: taskData }, { data: eventData }] = await Promise.all([
    taskQuery,
    supabase.from('events').select('*').order('date'),
  ])

  const allTasks = (taskData ?? []) as Task[]
  const events = (eventData ?? []) as Event[]

  const sorted = [...allTasks].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
  const top5 = sorted.filter(t => t.status === 'pending' || t.status === 'in_progress').slice(0, 5)
  const blocked = sorted.filter(t => t.status === 'blocked')

  return (<>
    <Heartbeat />
    <HerDashboardClient
      user={session.user}
      initialTop5={top5}
      initialBlocked={blocked}
      initialEvents={events}
    />
  </>)
}
