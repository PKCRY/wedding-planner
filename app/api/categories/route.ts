import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const context = new URL(req.url).searchParams.get('context') ?? 'task'
  const { data, error } = await supabase
    .from('categories')
    .select('name')
    .eq('context', context)
    .order('sort_order')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((r: { name: string }) => r.name))
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, context = 'task' } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { error } = await supabase
    .from('categories')
    .upsert({ name: name.trim(), context }, { onConflict: 'name,context' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
