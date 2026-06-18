import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import type { TaskComment } from '@/lib/db'

type Context = { params: Promise<{ token: string }> }

export async function GET(_req: NextRequest, { params }: Context) {
  const { token } = await params

  const { data, error } = await supabase
    .from('tasks')
    .select('id,title,description,category,assigned_to,status,priority,due_date,responsible_party,important_contacts,task_comments,share_note')
    .eq('share_token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const { token } = await params

  const { data: task, error: findErr } = await supabase
    .from('tasks')
    .select('id,task_comments')
    .eq('share_token', token)
    .single()

  if (findErr || !task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { status, comment, responsible_party } = await req.json()
  const claimerName = responsible_party?.trim() || 'Collaborator'

  const patch: Record<string, unknown> = {}

  if (responsible_party?.trim()) {
    patch.responsible_party = responsible_party.trim()
  }

  if (status && ['pending', 'in_progress', 'done', 'blocked'].includes(status)) {
    patch.status = status
    patch.status_changed_at = new Date().toISOString()
    if (status === 'done') {
      patch.completed_date = new Date().toISOString().slice(0, 10)
      patch.completed_by = claimerName
    } else {
      patch.completed_date = null
      patch.completed_by = ''
    }
  }

  if (comment?.trim()) {
    const newComment: TaskComment = {
      user: 'external',
      name: claimerName,
      text: comment.trim(),
      at: new Date().toISOString(),
    }
    patch.task_comments = [...(task.task_comments ?? []), newComment]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tasks').update(patch).eq('id', task.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
