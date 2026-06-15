import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase, sortTasks } from '@/lib/db'

const MEMBER_VISIBLE = ['siobhan', 'both']
const TOP_N = 5

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role === 'admin') {
    const { searchParams } = new URL(req.url)
    const filter = searchParams.get('filter')

    let query = supabase.from('tasks').select('*')
    if (filter && filter !== 'all') query = query.eq('assigned_to', filter)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(sortTasks(data ?? []))
  }

  // Member (Siobhan): top N non-done tasks + count info
  const { data: all, error } = await supabase
    .from('tasks')
    .select('*')
    .in('assigned_to', MEMBER_VISIBLE)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sorted = sortTasks(all ?? [])
  const active = sorted.filter((t) => t.status !== 'done')
  const done = sorted.filter((t) => t.status === 'done')
  const top5 = active.slice(0, TOP_N)

  const res = NextResponse.json(top5)
  res.headers.set('x-total', String(sorted.length))
  res.headers.set('x-done', String(done.length))
  return res
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, assigned_to, priority, due_date, category,
          blocked_by, responsible_party, important_contacts, sort_order } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const insert: Record<string, unknown> = {
    title: title.trim(),
    description: description || '',
    category: category || '',
    assigned_to: session.user.role === 'admin' ? (assigned_to || 'both') : 'siobhan',
    priority: priority || 'medium',
    sort_order: session.user.role === 'admin' ? (sort_order ?? 999) : 9999,
    due_date: due_date || null,
    blocked_by: blocked_by || '',
    responsible_party: responsible_party || '',
    important_contacts: important_contacts || '',
    task_comments: [],
    created_by: session.user.id,
  }

  const { data, error } = await supabase.from('tasks').insert(insert).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
