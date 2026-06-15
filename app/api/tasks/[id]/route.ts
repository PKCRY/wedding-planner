import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/db'
import type { TaskComment } from '@/lib/db'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Context) {
  const session = await getSession()
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const updates = await req.json()

  if (session.user.role !== 'admin') {
    // Members can only update status, completed_date, and add comments
    const { status, add_comment } = updates
    const patch: Record<string, unknown> = {}

    if (status) {
      patch.status = status
      if (status === 'done') patch.completed_date = new Date().toISOString().slice(0, 10)
      else patch.completed_date = null
    }

    if (add_comment && typeof add_comment === 'string' && add_comment.trim()) {
      const { data: current } = await supabase
        .from('tasks')
        .select('task_comments')
        .eq('id', id)
        .in('assigned_to', ['siobhan', 'both'])
        .single()

      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const comment: TaskComment = {
        user: session.user.id,
        name: session.user.name,
        text: add_comment.trim(),
        at: new Date().toISOString(),
      }
      patch.task_comments = [...(current.task_comments ?? []), comment]
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('id', id)
      .in('assigned_to', ['siobhan', 'both'])
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Admin: full update
  const adminFields = ['title', 'description', 'category', 'assigned_to', 'priority',
    'sort_order', 'due_date', 'status', 'blocked_by', 'responsible_party',
    'important_contacts'] as const

  const patch: Record<string, unknown> = {}
  for (const f of adminFields) {
    if (updates[f] !== undefined) patch[f] = updates[f]
  }

  // Handle status → auto set/clear completed_date
  if (updates.status === 'done' && !patch.completed_date) {
    patch.completed_date = updates.completed_date ?? new Date().toISOString().slice(0, 10)
  } else if (updates.status && updates.status !== 'done') {
    patch.completed_date = null
  }
  if (updates.completed_date !== undefined) patch.completed_date = updates.completed_date || null

  // Handle adding a comment
  if (updates.add_comment && typeof updates.add_comment === 'string' && updates.add_comment.trim()) {
    const { data: current } = await supabase
      .from('tasks')
      .select('task_comments')
      .eq('id', id)
      .single()

    const comment: TaskComment = {
      user: session.user.id,
      name: session.user.name,
      text: updates.add_comment.trim(),
      at: new Date().toISOString(),
    }
    patch.task_comments = [...(current?.task_comments ?? []), comment]
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const session = await getSession()
  if (!session.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
