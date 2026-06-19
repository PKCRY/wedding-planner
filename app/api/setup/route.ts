import { NextResponse } from 'next/server'
import { getSession, isAdmin } from '@/lib/session'
import { supabase } from '@/lib/db'

// Verifies DB connectivity. Run the SQL in supabase/schema.sql in the Supabase SQL Editor first.
export async function POST() {
  const session = await getSession()
  if (!session.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase.from('tasks').select('id').limit(1)
  if (error) {
    return NextResponse.json(
      { error: `DB not ready: ${error.message}. Run supabase/schema.sql in your Supabase SQL Editor.` },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, message: 'DB connection verified' })
}
