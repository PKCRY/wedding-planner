import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('tasks').select('assigned_to')

  const names = new Set<string>(['nick', 'siobhan'])
  for (const row of data ?? []) {
    if (!row.assigned_to) continue
    for (const name of row.assigned_to.split(',').map((s: string) => s.trim().toLowerCase())) {
      if (name && name !== 'both') names.add(name)
    }
  }

  return NextResponse.json(Array.from(names).sort())
}
