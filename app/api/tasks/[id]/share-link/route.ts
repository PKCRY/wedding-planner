import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { makeShareToken } from '@/lib/share-token'

type Context = { params: Promise<{ id: string }> }

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wedding-planner-one-sage.vercel.app'

export async function GET(_req: NextRequest, { params }: Context) {
  const session = await getSession()
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const taskId = Number(id)
  if (Number.isNaN(taskId)) return NextResponse.json({ error: 'Bad id' }, { status: 400 })

  const token = makeShareToken(taskId)
  const url = `${BASE_URL}/task/${taskId}/${token}`

  return NextResponse.json({ url })
}
