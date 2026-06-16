'use client'

import { useEffect, useState } from 'react'

interface Notif {
  id: number
  title: string
  body: string
  url: string
  read: boolean
  created_at: string
}

function relTime(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function syncBadge(count: number) {
  try {
    if (count > 0 && 'setAppBadge' in navigator) navigator.setAppBadge(count).catch(() => {})
    else if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {})
  } catch {}
}

export default function NotificationCenter() {
  const [items, setItems] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)

  async function load() {
    const res = await fetch('/api/notifications')
    if (res.ok) {
      const data: Notif[] = await res.json()
      setItems(data)
      syncBadge(data.filter(i => !i.read).length)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  function openPanel() {
    setOpen(true)
    if (items.some(i => !i.read)) {
      fetch('/api/notifications', { method: 'PATCH' }).catch(() => {})
      setItems(prev => prev.map(i => ({ ...i, read: true })))
      syncBadge(0)
    }
  }

  const unread = items.filter(i => !i.read).length

  return (
    <>
      <button
        onClick={openPanel}
        className="relative w-11 h-11 flex items-center justify-center rounded-full shrink-0"
        style={{ backgroundColor: '#f0f4f0', color: '#7a9e7e' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#d4849a' }} />
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[80vh] flex flex-col overflow-hidden modal-bottom">
            <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-9 h-1.5 rounded-full" style={{ backgroundColor: '#d8e8d8' }} />
            </div>

            <div className="flex items-center justify-between p-4 sm:p-5 shrink-0" style={{ borderBottom: '1px solid #d8e8d8' }}>
              <p className="font-semibold text-base" style={{ color: '#2d4a30' }}>Notifications</p>
              <button onClick={() => setOpen(false)}
                className="w-11 h-11 flex items-center justify-center rounded-full text-xl shrink-0"
                style={{ backgroundColor: '#f0f4f0', color: '#9db89f' }}>×</button>
            </div>

            <div className="overflow-y-auto overflow-x-hidden flex-1 p-4 sm:p-5 space-y-2">
              {items.length === 0 ? (
                <p className="text-sm text-center py-12" style={{ color: '#9db89f' }}>No notifications</p>
              ) : items.map(n => (
                <div key={n.id} className="rounded-xl p-3 min-w-0" style={{ backgroundColor: '#f0f4f0' }}>
                  <p className="text-sm font-semibold break-words" style={{ color: '#2d4a30' }}>{n.title}</p>
                  <p className="text-sm break-words mt-0.5" style={{ color: '#5a7d5e' }}>{n.body}</p>
                  <p className="text-xs mt-1" style={{ color: '#b8d0ba' }}>{relTime(n.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
