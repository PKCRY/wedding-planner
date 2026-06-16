'use client'

import { useEffect, useState } from 'react'

export default function PushManagerInline() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setSupported(true)
    navigator.serviceWorker.ready.then(async reg => {
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
      if (res.ok) { setSubscribed(true); setMsg('Enabled!') }
      else setMsg('Failed to enable')
    } catch {
      setMsg('Not supported on this device')
    }
    setLoading(false)
  }

  async function unsubscribe() {
    setLoading(true)
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()
    await fetch('/api/push/subscribe', { method: 'DELETE' })
    setSubscribed(false)
    setMsg('Disabled')
    setLoading(false)
  }

  if (!supported) return (
    <p className="text-sm" style={{ color: '#b8d0ba' }}>Not supported on this browser.</p>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl p-3" style={{ backgroundColor: '#f0f4f0' }}>
        <div>
          <p className="text-sm font-medium" style={{ color: '#2d4a30' }}>
            {subscribed ? 'Notifications on' : 'Notifications off'}
          </p>
          {msg && <p className="text-xs mt-0.5" style={{ color: '#9db89f' }}>{msg}</p>}
        </div>
        <button
          onClick={subscribed ? unsubscribe : subscribe}
          disabled={loading}
          className="text-sm font-medium px-4 rounded-xl text-white"
          style={{ backgroundColor: subscribed ? '#9db89f' : '#d4849a', opacity: loading ? 0.6 : 1, minHeight: 44 }}
        >
          {loading ? '...' : subscribed ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
