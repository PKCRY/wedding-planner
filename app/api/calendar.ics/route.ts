import { NextRequest } from 'next/server'
import { supabase } from '@/lib/db'
import type { Task, Event } from '@/lib/db'

const DOMAIN = 'nick-siobhan-wedding'

function fmtDate(dateStr: string): string {
  return dateStr.replace(/-/g, '')
}

function fmtTimestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function esc(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function taskToVEVENT(task: Task): string {
  const stamp = fmtTimestamp()
  const date = fmtDate(task.due_date!)
  const descParts: string[] = []
  if (task.description) descParts.push(task.description)
  if (task.category) descParts.push(`Category: ${task.category}`)
  descParts.push(`Priority: ${task.priority}`, `Assigned: ${task.assigned_to}`)

  const lines = [
    'BEGIN:VEVENT',
    `UID:task-${task.id}@${DOMAIN}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${date}`,
    `DTEND;VALUE=DATE:${date}`,
    `SUMMARY:📋 ${esc(task.title)}`,
    `DESCRIPTION:${esc(descParts.join('\n'))}`,
    'END:VEVENT',
  ]
  return lines.join('\r\n')
}

function eventToVEVENT(event: Event): string {
  const stamp = fmtTimestamp()
  const date = fmtDate(event.date)
  const lines = [
    'BEGIN:VEVENT',
    `UID:event-${event.id}@${DOMAIN}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${date}`,
    `DTEND;VALUE=DATE:${date}`,
    `SUMMARY:💍 ${esc(event.title)}`,
  ]
  if (event.description) lines.push(`DESCRIPTION:${esc(event.description)}`)
  lines.push('END:VEVENT')
  return lines.join('\r\n')
}

export async function GET(req: NextRequest) {
  const token = process.env.CALENDAR_TOKEN
  if (!token) return new Response('Calendar feed not configured', { status: 503 })

  const provided = new URL(req.url).searchParams.get('token')
  if (!provided || provided !== token) {
    return new Response('Unauthorized', { status: 401 })
  }

  const [tasksRes, eventsRes] = await Promise.all([
    supabase.from('tasks').select('*').not('due_date', 'is', null).neq('status', 'done'),
    supabase.from('events').select('*').order('date'),
  ])

  const tasks: Task[] = (tasksRes.data ?? []).filter(t => t.due_date)
  const events: Event[] = eventsRes.data ?? []

  const vevents = [
    ...tasks.map(taskToVEVENT),
    ...events.map(eventToVEVENT),
  ]

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nick & Siobhan Wedding//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Nick & Siobhan Wedding',
    'X-WR-TIMEZONE:Europe/London',
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n')

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="wedding.ics"',
      'Cache-Control': 'no-cache, no-store',
    },
  })
}
