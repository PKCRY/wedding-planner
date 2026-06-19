'use client'

import { useEffect, useState } from 'react'

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      className="relative inline-flex shrink-0 rounded-full transition-colors"
      style={{
        width: 48, height: 28,
        backgroundColor: on ? '#7a9e7e' : '#d8e8d8',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span
        className="inline-block rounded-full bg-white shadow transition-transform"
        style={{
          width: 22, height: 22,
          marginTop: 3,
          transform: on ? 'translateX(23px)' : 'translateX(3px)',
        }}
      />
    </button>
  )
}

export default function NotificationSettings() {
  const [activityEnabled, setActivityEnabled] = useState(true)
  const [activityLoading, setActivityLoading] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/notification-prefs')
      .then(r => r.json())
      .then(d => setActivityEnabled(d.enabled ?? true))
      .catch(() => {})

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setPushSupported(true)
    navigator.serviceWorker.ready.then(async reg => {
      const sub = await reg.pushManager.getSubscription()
      setPushSubscribed(!!sub)
    }).catch(() => {})
  }, [])

  async function toggleActivity(val: boolean) {
    setActivityLoading(true)
    setMsg('')
    try {
      await fetch('/api/notification-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: val }),
      })
      setActivityEnabled(val)
      setMsg(val ? 'Notifications on' : 'Notifications off')
    } catch {
      setMsg('Failed to save')
    }
    setActivityLoading(false)
  }

  async function subscribePush() {
    setPushLoading(true)
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
      if (res.ok) { setPushSubscribed(true); setMsg('Push enabled on this device') }
      else setMsg('Failed to enable push')
    } catch {
      setMsg('Push not supported on this device')
    }
    setPushLoading(false)
  }

  async function unsubscribePush() {
    setPushLoading(true)
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()
    await fetch('/api/push/subscribe', { method: 'DELETE' })
    setPushSubscribed(false)
    setMsg('Push disabled on this device')
    setPushLoading(false)
  }

  return (
    <div className="space-y-3">
      {/* Activity notifications toggle */}
      <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ backgroundColor: '#f0f4f0' }}>
        <div className="pr-3">
          <p className="text-sm font-medium" style={{ color: '#2d4a30' }}>Activity notifications</p>
          <p className="text-xs mt-0.5" style={{ color: '#9db89f' }}>
            {activityEnabled ? 'Get notified when tasks are updated' : 'You won\'t be notified of task updates'}
          </p>
        </div>
        <Toggle on={activityEnabled} onChange={toggleActivity} disabled={activityLoading} />
      </div>

      {/* Push on this device */}
      {pushSupported && (
        <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ backgroundColor: '#f0f4f0' }}>
          <div className="pr-3">
            <p className="text-sm font-medium" style={{ color: '#2d4a30' }}>Push on this device</p>
            <p className="text-xs mt-0.5" style={{ color: '#9db89f' }}>
              {pushSubscribed ? 'Receives push notifications' : 'No push on this device'}
            </p>
          </div>
          <button
            onClick={pushSubscribed ? unsubscribePush : subscribePush}
            disabled={pushLoading}
            className="text-xs font-semibold px-3 rounded-xl shrink-0"
            style={{
              backgroundColor: pushSubscribed ? '#d8e8d8' : '#7a9e7e',
              color: pushSubscribed ? '#5a7d5e' : '#fff',
              opacity: pushLoading ? 0.6 : 1,
              minHeight: 36,
            }}
          >
            {pushLoading ? '...' : pushSubscribed ? 'Remove' : 'Enable'}
          </button>
        </div>
      )}

      {msg && <p className="text-xs text-center" style={{ color: '#9db89f' }}>{msg}</p>}
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
