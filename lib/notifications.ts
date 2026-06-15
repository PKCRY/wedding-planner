import { supabase } from './db'
import { webpush } from './push'

export async function sendPushToAll(payload: { title: string; body: string; url?: string }) {
  try {
    const { data: subs } = await supabase.from('push_subscriptions').select('subscription')
    if (!subs?.length) return
    const json = JSON.stringify({ url: '/', ...payload })
    await Promise.allSettled(
      subs.map(({ subscription }) => webpush.sendNotification(subscription, json))
    )
  } catch {
    // best-effort, never block the calling request
  }
}
