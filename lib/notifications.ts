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

const MOVED_TITLES = [
  '↩️ Back to the list',
  '📋 Moved',
  '🔄 Status update',
]

const MOVED_BODIES = (name: string, task: string, statusLabel: string) =>
  `${name} moved "${task}" to ${statusLabel}`

const COMMENT_TITLES = [
  '💬 New comment',
  '✏️ Note added',
]

const COMMENT_BODIES = (name: string, task: string, text: string) =>
  `${name} on "${task}": ${text}`

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const ALL_USERS = ['nick', 'siobhan']

export async function sendPushToAll(
  payload: { title: string; body: string; url?: string; badge_count?: number },
  excludeUserId?: string
) {
  try {
    let query = supabase.from('push_subscriptions').select('subscription, user_id')
    if (excludeUserId) query = query.neq('user_id', excludeUserId)
    const { data: subs } = await query
    if (!subs?.length) return
    const json = JSON.stringify({ url: '/', badge_count: 1, ...payload })
    await Promise.allSettled(
      subs.map(({ subscription }) => webpush.sendNotification(subscription, json))
    )
  } catch {
    // best-effort, never block the calling request
  }
}

// Sends a push notification AND saves it to the in-app notification center
// for every user except excludeUserId (the actor who triggered the event).
export async function notifyOthers(
  payload: { title: string; body: string; url?: string; badge_count?: number },
  excludeUserId?: string
) {
  sendPushToAll(payload, excludeUserId)
  try {
    const recipients = ALL_USERS.filter(u => u !== excludeUserId)
    if (!recipients.length) return
    await supabase.from('notifications').insert(
      recipients.map(user_id => ({
        user_id,
        title: payload.title,
        body: payload.body,
        url: payload.url ?? '/',
      }))
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

export function taskMovedPayload(name: string, task: string, statusLabel: string) {
  return {
    title: pick(MOVED_TITLES),
    body: MOVED_BODIES(name, task, statusLabel),
    url: '/',
  }
}

export function taskCommentPayload(name: string, task: string, text: string) {
  return {
    title: pick(COMMENT_TITLES),
    body: COMMENT_BODIES(name, task, text.length > 80 ? text.slice(0, 77) + '…' : text),
    url: '/',
  }
}
