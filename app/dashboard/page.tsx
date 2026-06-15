import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabase, sortTasks } from '@/lib/db'
import type { Task, Event } from '@/lib/db'
import DashboardClient from './_components/DashboardClient'
import Heartbeat from '@/components/Heartbeat'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session.user) redirect('/login')
  if (session.user.role !== 'admin') redirect('/her-dashboard')

  const [{ data: taskData }, { data: eventData }] = await Promise.all([
    supabase.from('tasks').select('*'),
    supabase.from('events').select('*').order('date'),
  ])

  const tasks = sortTasks((taskData ?? []) as Task[])
  const events = (eventData ?? []) as Event[]

  return <>
    <Heartbeat />
    <DashboardClient user={session.user} initialTasks={tasks} initialEvents={events} />
  </>
}
