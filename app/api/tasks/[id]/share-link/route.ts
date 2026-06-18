import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/db'

type Context = { params: Promise<{ id: string }> }

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nick-and-siobhan-wedding.vercel.app'

export async function GET(_req: NextRequest, { params }: Context) {
  const session = await getSession()
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('tasks')
    .select('share_token')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ url: `${BASE_URL}/task/${data.share_token}` })
}
