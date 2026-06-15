'use client'

import { useEffect, useState } from 'react'

export default function PushManager() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setSupported(true)

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    })
  }, [])

  async function subscribe() {
    setLoading(true)
    setMsg('')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
      if (res.ok) {
        setSubscribed(true)
        setMsg('Notifications enabled!')
      }
    } catch {
      setMsg('Failed to enable notifications')
    }
    setLoading(false)
  }

  async function unsubscribe() {
    setLoading(true)
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()
    setSubscribed(false)
    setLoading(false)
  }

  if (!supported) return null

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between gap-3 shadow-sm">
      <div>
        <div className="text-xs font-medium text-gray-700">Push Notifications</div>
        {msg && <div className="text-xs text-gray-400 mt-0.5">{msg}</div>}
      </div>
      <button
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={loading}
        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
          subscribed
            ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            : 'bg-rose-500 text-white hover:bg-rose-600 disabled:bg-rose-300'
        }`}
      >
        {loading ? '...' : subscribed ? 'Disable' : 'Enable'}
      </button>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}
