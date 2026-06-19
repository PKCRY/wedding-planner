import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('timeline_items')
    .select('*')
    .order('day_date', { ascending: true })
    .order('time_slot', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { day_date, time_slot, title, notes, type, task_id, inventory_id } = await req.json()
  if (!day_date || !title?.trim()) {
    return NextResponse.json({ error: 'day_date and title required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('timeline_items')
    .insert({
      day_date,
      time_slot: time_slot ?? '',
      title: title.trim(),
      notes: notes ?? '',
      type: type ?? 'note',
      task_id: task_id ?? null,
      inventory_id: inventory_id ?? null,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
