'use client'

import { useState, useEffect } from 'react'

const LOCAL_KEY = 'wedding_timeline_days'
const DEFAULT_DAYS = ['2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30']

function loadDays(): string[] {
  if (typeof window === 'undefined') return DEFAULT_DAYS
  try { const s = localStorage.getItem(LOCAL_KEY); return s ? JSON.parse(s) : DEFAULT_DAYS }
  catch { return DEFAULT_DAYS }
}

function fmtDayLabel(ds: string) {
  const d = new Date(ds + 'T12:00:00')
  return `${d.toLocaleDateString('en-US', { weekday: 'long' })} · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

export default function AddToTimelineSheet({
  title,
  taskId,
  inventoryId,
  type,
  onClose,
}: {
  title: string
  taskId?: number
  inventoryId?: number
  type: 'task' | 'inventory' | 'note'
  onClose: () => void
}) {
  const [days, setDays]           = useState<string[]>(DEFAULT_DAYS)
  const [selectedDay, setDay]     = useState('')
  const [time, setTime]           = useState('')
  const [allDay, setAllDay]       = useState(false)
  const [saving, setSaving]       = useState(false)
  const [done, setDone]           = useState(false)

  useEffect(() => {
    const d = loadDays()
    setDays(d)
    setDay(d[0] ?? '')
  }, [])

  async function save() {
    if (!selectedDay || saving) return
    setSaving(true)
    const res = await fetch('/api/timeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day_date: selectedDay,
        time_slot: allDay ? '' : (time || ''),
        title,
        type,
        task_id:      taskId      ?? null,
        inventory_id: inventoryId ?? null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setDone(true)
      setTimeout(onClose, 1200)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="modal-bottom"
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          backgroundColor: '#fff',
          borderRadius: '20px 20px 0 0',
          padding: '8px 16px 16px',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 12 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#d8e8d8' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#2d4a30' }}>Add to Timeline</p>
          <button
            onClick={onClose}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#f0f4f0', color: '#9db89f', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >×</button>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#7a9e7e', fontSize: 15, fontWeight: 600 }}>
            ✓ Added to timeline
          </div>
        ) : (
          <>
            {/* Item name preview */}
            <p style={{
              fontSize: 13, color: '#5a7d5e', fontWeight: 500,
              marginBottom: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              padding: '8px 12px', backgroundColor: '#f0f4f0', borderRadius: 10,
            }}>
              {title}
            </p>

            {/* Day */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <select
                value={selectedDay}
                onChange={e => setDay(e.target.value)}
                style={{
                  width: '100%', appearance: 'none', WebkitAppearance: 'none',
                  borderRadius: 14, border: '1.5px solid #c8dcc8',
                  padding: '14px 40px 14px 16px',
                  fontSize: 15, color: '#2d4a30', backgroundColor: '#f8fbf8',
                  outline: 'none', fontWeight: 500,
                }}
              >
                {days.map(d => <option key={d} value={d}>{fmtDayLabel(d)}</option>)}
              </select>
              <svg style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9db89f' }} width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* Time + All Day */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <input
                type="time"
                value={time}
                disabled={allDay}
                onChange={e => setTime(e.target.value)}
                style={{
                  flex: 1,
                  borderRadius: 14, border: '1.5px solid #c8dcc8',
                  padding: '14px 16px', fontSize: 15,
                  color: allDay ? '#c8dcc8' : '#2d4a30',
                  backgroundColor: '#f8fbf8', outline: 'none',
                }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#5a7d5e', cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 44, paddingRight: 4 }}>
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={e => setAllDay(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#7a9e7e' }}
                />
                All day
              </label>
            </div>

            <button
              onClick={save}
              disabled={saving || !selectedDay}
              style={{
                width: '100%', padding: '16px',
                borderRadius: 16, fontSize: 16, fontWeight: 700,
                backgroundColor: saving || !selectedDay ? '#b8d0ba' : '#2d4a30',
                color: '#fff',
                cursor: saving || !selectedDay ? 'default' : 'pointer',
                minHeight: 56,
              }}
            >
              {saving ? 'Adding…' : '+ Add to Timeline'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
