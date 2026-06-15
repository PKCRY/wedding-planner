import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/db'

const TABLES = ['tasks', 'events', 'push_subscriptions', 'inventory'] as const

export async function GET() {
  const session = await getSession()
  if (!session.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, { exists: boolean; count?: number; error?: string }> = {}

  await Promise.all(
    TABLES.map(async (table) => {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (error) {
        results[table] = { exists: false, error: error.message }
      } else {
        results[table] = { exists: true, count: count ?? 0 }
      }
    })
  )

  const missing = TABLES.filter(t => !results[t].exists)
  return NextResponse.json({ ok: missing.length === 0, results, missing })
}
