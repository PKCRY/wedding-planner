import { NextRequest, NextResponse } from 'next/server'
import { run as runNickReminder } from '../nick-reminder/route'
import { run as runNickInactivity } from '../nick-inactivity/route'
import { run as runStaleInProgress } from '../stale-in-progress/route'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [reminder, inactivity, stale] = await Promise.all([
    runNickReminder(),
    runNickInactivity(),
    runStaleInProgress(),
  ])

  return NextResponse.json({ ok: true, reminder, inactivity, stale })
}
