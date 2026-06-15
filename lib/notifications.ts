import { supabase } from './db'
import { webpush } from './push'

const DONE_TITLES = [
  '✅ One down!',
  '🙌 Nice work!',
  '⚡ Done!',
  '🎊 Boom!',
  '✨ Nailed it!',
  '🔥 Crushed it!',
  '💪 Done and dusted!',
]

const DONE_BODIES = (name: string, task: string) => {
  const pool = [
    `${name} just knocked out "${task}"`,
    `${name} wrapped up "${task}" — one less thing to worry about`,
    `"${task}" is officially done, thanks to ${name}`,
    `${name} crossed off "${task}" — keep it going!`,
    `${name} finished "${task}" — wedding planning on track 💍`,
    `${task} ✓ — ${name} got it done`,
    `${name} just took care of "${task}"`,
  ]
  return pool[Math.floor(Math.random() * pool.length)]
}

const STARTED_TITLES = [
  '🔨 On it!',
  '🏃 In progress!',
  '👀 Working on it!',
  '⚙️ Starting up!',
]

const STARTED_BODIES = (name: string, task: string) => {
  const pool = [
    `${name} is working on "${task}"`,
    `${name} picked up "${task}"`,
    `${name} just started on "${task}"`,
    `"${task}" is in progress — ${name}'s on it`,
  ]
  return pool[Math.floor(Math.random() * pool.length)]
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

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

export function taskDonePayload(name: string, task: string) {
  return {
    title: pick(DONE_TITLES),
    body: DONE_BODIES(name, task),
    url: '/',
  }
}

export function taskStartedPayload(name: string, task: string) {
  return {
    title: pick(STARTED_TITLES),
    body: STARTED_BODIES(name, task),
    url: '/',
  }
}
