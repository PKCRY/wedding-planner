import { NextRequest, NextResponse } from 'next/server'
import { verifyShareToken } from '@/lib/share-token'
import { supabase } from '@/lib/db'
import type { TaskComment } from '@/lib/db'

type Context = { params: Promise<{ id: string; token: string }> }

export async function GET(_req: NextRequest, { params }: Context) {
  const { id, token } = await params
  const taskId = Number(id)

  if (Number.isNaN(taskId) || !verifyShareToken(taskId, token)) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('id,title,description,category,assigned_to,status,priority,due_date,responsible_party,important_contacts,task_comments')
    .eq('id', taskId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const { id, token } = await params
  const taskId = Number(id)

  if (Number.isNaN(taskId) || !verifyShareToken(taskId, token)) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 403 })
  }

  const { status, comment, commenter_name } = await req.json()

  const patch: Record<string, unknown> = {}

  if (status && ['pending', 'in_progress', 'done', 'blocked'].includes(status)) {
    patch.status = status
    patch.status_changed_at = new Date().toISOString()
    if (status === 'done') {
      patch.completed_date = new Date().toISOString().slice(0, 10)
      patch.completed_by = commenter_name || 'Collaborator'
    } else {
      patch.completed_date = null
      patch.completed_by = ''
    }
  }

  if (comment?.trim()) {
    const { data: current } = await supabase.from('tasks').select('task_comments').eq('id', taskId).single()
    const newComment: TaskComment = {
      user: 'external',
      name: commenter_name?.trim() || 'Collaborator',
      text: comment.trim(),
      at: new Date().toISOString(),
    }
    patch.task_comments = [...(current?.task_comments ?? []), newComment]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tasks').update(patch).eq('id', taskId).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
