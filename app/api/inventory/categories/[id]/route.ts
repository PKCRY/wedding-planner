import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, updateItems } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data: existing, error: fetchErr } = await supabase
    .from('inventory_categories')
    .select('name')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('inventory_categories')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (updateItems && existing.name !== name.trim()) {
    const { data: affected } = await supabase
      .from('inventory')
      .select('id, categories')
      .contains('categories', [existing.name])
    if (affected && affected.length > 0) {
      await Promise.all(
        (affected as { id: number; categories: string[] }[]).map(item =>
          supabase.from('inventory').update({
            categories: item.categories.map(c => c === existing.name ? name.trim() : c),
          }).eq('id', item.id)
        )
      )
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('inventory_categories')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
