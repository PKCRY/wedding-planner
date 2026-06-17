import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase, sortTasks } from '@/lib/db'
import { webpush } from '@/lib/push'

const TOP_N = 5

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role === 'admin') {
    const { searchParams } = new URL(req.url)
    const filter = searchParams.get('filter')

    let query = supabase.from('tasks').select('*')
    if (filter && filter !== 'all') {
      // assigned_to may be a comma-separated multi-assignee list, or the legacy 'both' value
      query = filter === 'nick' || filter === 'siobhan'
        ? query.or(`assigned_to.ilike.%${filter}%,assigned_to.eq.both`)
        : query.ilike('assigned_to', `%${filter}%`)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(sortTasks(data ?? []))
  }

  // Member: Siobhan sees her tasks + 'both'; other helpers see only their assigned tasks
  const { searchParams } = new URL(req.url)
  const wantCompleted = searchParams.get('completed') === '1'
  const wantBlocked = searchParams.get('blocked') === '1'
  const memberId = session.user.id

  const query = supabase.from('tasks').select('*')
  const { data: all, error } = await (memberId === 'siobhan'
    ? query.or('assigned_to.ilike.%siobhan%,assigned_to.eq.both')
    : query.ilike('assigned_to', `%${memberId}%`)
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sorted = sortTasks(all ?? [])
  const done = sorted.filter((t) => t.status === 'done')
  const blocked = sorted.filter((t) => t.status === 'blocked')
  const workable = sorted.filter((t) => t.status === 'pending' || t.status === 'in_progress')

  if (wantCompleted) return NextResponse.json(done)
  if (wantBlocked) return NextResponse.json(blocked)

  const res = NextResponse.json(workable.slice(0, TOP_N))
  res.headers.set('x-total', String(sorted.length))
  res.headers.set('x-done', String(done.length))
  res.headers.set('x-blocked', String(blocked.length))
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

  // Notify Nick when Siobhan adds a task
  if (session.user.role !== 'admin') {
    try {
      const { data: nickSub } = await supabase
        .from('push_subscriptions').select('subscription').eq('user_id', 'nick').single()
      if (nickSub) {
        await webpush.sendNotification(nickSub.subscription, JSON.stringify({
          title: '📋 Siobhan added a task',
          body: `"${data.title}" is waiting for review`,
          url: '/dashboard',
          badge_count: 1,
        }))
      }
    } catch { /* best-effort */ }
  }

  return NextResponse.json(data, { status: 201 })
}
