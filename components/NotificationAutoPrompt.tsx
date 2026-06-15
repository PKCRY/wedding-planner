'use client'

import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export default function NotificationAutoPrompt() {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    if (!isStandalone) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
    if (Notification.permission !== 'default') return
    if (localStorage.getItem('notif-prompt-dismissed')) return

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      if (!sub) setShow(true)
    })
  }, [])

  async function enable() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
    } catch {
      // user denied native dialog or unsupported
    }
    setShow(false)
    setLoading(false)
  }

  function later() {
    localStorage.setItem('notif-prompt-dismissed', '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 safe-bottom pointer-events-none">
      <div
        className="rounded-2xl p-4 shadow-lg pointer-events-auto"
        style={{ backgroundColor: '#fff', border: '1px solid #b8d0ba' }}
      >
        <div className="flex justify-between items-start mb-2">
          <p className="font-semibold text-sm" style={{ color: '#2d4a30' }}>
            Enable Notifications
          </p>
          <button onClick={later} className="text-gray-400 text-xl leading-none px-1">×</button>
        </div>
        <p className="text-xs leading-relaxed mb-3" style={{ color: '#7a9e7e' }}>
          Get reminders for upcoming tasks and wedding events.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={later}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ color: '#9db89f' }}
          >
            Later
          </button>
          <button
            onClick={enable}
            disabled={loading}
            className="text-xs px-4 py-1.5 rounded-lg text-white font-medium"
            style={{ backgroundColor: '#d4849a', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '...' : 'Enable'}
          </button>
        </div>
      </div>
    </div>
  )
}
