'use client'

import { useState, useEffect, useRef } from 'react'
import type { Task, InventoryItem } from '@/lib/db'

const DEFAULT_DAYS = ['2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30']
const LOCAL_KEY = 'wedding_timeline_days'

const STATUS_DOT: Record<string, string> = {
  pending:     '#d4849a',
  in_progress: '#e6c84a',
  done:        '#7a9e7e',
  blocked:     '#c0607a',
  needed:      '#d4849a',
  partial:     '#e6c84a',
  acquired:    '#7a9e7e',
}

interface TimelineItem {
  id: number
  day_date: string
  time_slot: string
  title: string
  notes: string
  type: string
  task_id: number | null
  inventory_id: number | null
}

function fmt12(t: string) {
  if (!t) return 'All Day'
  const [h, m] = t.split(':').map(Number)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function fmtDay(ds: string) {
  const d = new Date(ds + 'T12:00:00')
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    short:   d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }
}

function loadDays(): string[] {
  if (typeof window === 'undefined') return DEFAULT_DAYS
  try { const s = localStorage.getItem(LOCAL_KEY); return s ? JSON.parse(s) : DEFAULT_DAYS }
  catch { return DEFAULT_DAYS }
}

export default function Timeline({ tasks }: { tasks: Task[] }) {
  const [items, setItems]   = useState<TimelineItem[]>([])
  const [inv, setInv]       = useState<InventoryItem[]>([])
  const [days, setDays]     = useState<string[]>(DEFAULT_DAYS)
  const [dayIdx, setDayIdx] = useState(0)
  const [loading, setLoading] = useState(true)

  // Add sheet
  const [showAdd, setShowAdd]       = useState(false)
  const [addTime, setAddTime]       = useState('')
  const [addAllDay, setAddAllDay]   = useState(false)
  const [addTitle, setAddTitle]     = useState('')
  const [addType, setAddType]       = useState<'note' | 'task' | 'inventory'>('note')
  const [addTaskId, setAddTaskId]   = useState<number | null>(null)
  const [addInvId, setAddInvId]     = useState<number | null>(null)
  const [addSearch, setAddSearch]   = useState('')
  const [saving, setSaving]         = useState(false)

  // Add day
  const [pickingDay, setPickingDay] = useState(false)
  const [newDayStr, setNewDayStr]   = useState('')

  // Swipe
  const swipeX = useRef<number | null>(null)

  useEffect(() => {
    setDays(loadDays())
    Promise.all([
      fetch('/api/timeline').then(r => r.ok ? r.json() : []),
      fetch('/api/inventory').then(r => r.ok ? r.json() : []),
    ]).then(([ti, ii]) => { setItems(ti); setInv(ii); setLoading(false) })
  }, [])

  function saveDays(next: string[]) {
    setDays(next)
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)) } catch {}
  }

  const currentDay = days[Math.min(dayIdx, days.length - 1)] ?? ''

  const dayItems = items
    .filter(i => i.day_date === currentDay)
    .sort((a, b) => (a.time_slot || '').localeCompare(b.time_slot || ''))

  // Group by time slot
  const groups: Record<string, TimelineItem[]> = {}
  for (const item of dayItems) {
    const key = item.time_slot || ''
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  const slots = Object.keys(groups).sort((a, b) => {
    if (!a) return -1
    if (!b) return 1
    return a.localeCompare(b)
  })

  function prevDay() { setDayIdx(i => Math.max(0, i - 1)) }
  function nextDay() { setDayIdx(i => Math.min(days.length - 1, i + 1)) }

  function onTouchStart(e: React.TouchEvent) { swipeX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (swipeX.current === null) return
    const dx = swipeX.current - e.changedTouches[0].clientX
    if (Math.abs(dx) > 55) dx > 0 ? nextDay() : prevDay()
    swipeX.current = null
  }

  function openAdd() {
    setShowAdd(true); setAddTime(''); setAddAllDay(false)
    setAddTitle(''); setAddType('note')
    setAddTaskId(null); setAddInvId(null); setAddSearch('')
  }

  async function saveItem() {
    if (saving) return
    let title = addTitle.trim()
    let taskId: number | null = null
    let invId: number | null = null

    if (addType === 'task' && addTaskId) {
      taskId = addTaskId
      if (!title) title = tasks.find(t => t.id === addTaskId)?.title ?? ''
    } else if (addType === 'inventory' && addInvId) {
      invId = addInvId
      if (!title) title = inv.find(i => i.id === addInvId)?.name ?? ''
    }
    if (!title) return

    setSaving(true)
    const res = await fetch('/api/timeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day_date: currentDay,
        time_slot: addAllDay ? '' : addTime,
        title,
        type: addType,
        task_id: taskId,
        inventory_id: invId,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const item = await res.json()
      setItems(prev => [...prev, item])
      setShowAdd(false)
    }
  }

  async function deleteItem(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/timeline/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function addDay() {
    if (!newDayStr) return
    const next = [...new Set([...days, newDayStr])].sort()
    saveDays(next)
    setDayIdx(next.indexOf(newDayStr))
    setNewDayStr(''); setPickingDay(false)
  }

  function removeCurrentDay() {
    const next = days.filter(d => d !== currentDay)
    if (!next.length) return
    saveDays(next)
    setDayIdx(i => Math.min(i, next.length - 1))
  }

  const searchLower = addSearch.toLowerCase()
  const filteredTasks = (searchLower ? tasks.filter(t => t.title.toLowerCase().includes(searchLower)) : tasks).slice(0, 40)
  const filteredInv   = (searchLower ? inv.filter(i => i.name.toLowerCase().includes(searchLower))   : inv  ).slice(0, 40)

  const canSave =
    addType === 'note'      ? !!addTitle.trim() :
    addType === 'task'      ? !!(addTaskId || addTitle.trim()) :
    /* inventory */           !!(addInvId  || addTitle.trim())

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: '#9db89f', fontSize: 14 }}>Loading timeline…</div>
  )

  const { weekday, short } = currentDay ? fmtDay(currentDay) : { weekday: '', short: '' }

  return (
    <div style={{ paddingBottom: 96 }}>

      {/* ── Day nav ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button
          onClick={prevDay}
          disabled={dayIdx === 0}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e8f0e8', color: dayIdx === 0 ? '#c8dcc8' : '#2d4a30', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >‹</button>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2d4a30' }}>{weekday}</div>
          <div style={{ fontSize: 13, color: '#7a9e7e' }}>{short}</div>
        </div>

        <button
          onClick={nextDay}
          disabled={dayIdx === days.length - 1}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e8f0e8', color: dayIdx === days.length - 1 ? '#c8dcc8' : '#2d4a30', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >›</button>
      </div>

      {/* Day dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
        {days.map((d, i) => (
          <button
            key={d}
            onClick={() => setDayIdx(i)}
            style={{
              width: i === dayIdx ? 20 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === dayIdx ? '#2d4a30' : '#c8dcc8',
              transition: 'all 0.2s',
            }}
          />
        ))}
        {/* Add day */}
        {pickingDay ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 4 }}>
            <input
              type="date"
              value={newDayStr}
              onChange={e => setNewDayStr(e.target.value)}
              style={{ fontSize: 12, borderRadius: 8, border: '1px solid #9db89f', padding: '2px 6px' }}
            />
            <button onClick={addDay} style={{ fontSize: 12, backgroundColor: '#7a9e7e', color: '#fff', borderRadius: 8, padding: '3px 8px' }}>Add</button>
            <button onClick={() => setPickingDay(false)} style={{ fontSize: 12, color: '#9db89f' }}>✕</button>
          </div>
        ) : (
          <button
            onClick={() => setPickingDay(true)}
            style={{ fontSize: 16, color: '#9db89f', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}
            title="Add day"
          >+</button>
        )}
      </div>

      {/* ── Day content (swipeable) ── */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ minHeight: 200 }}
      >
        {slots.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60, color: '#b0c8b0' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🗓</div>
            <p style={{ fontSize: 14 }}>Nothing scheduled yet</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Tap + to add items to this day</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {slots.map(slot => (
              <div key={slot} style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                {/* Time label */}
                <div style={{ width: 72, flexShrink: 0, paddingTop: 10, textAlign: 'right' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#7a9e7e', whiteSpace: 'nowrap' }}>
                    {fmt12(slot)}
                  </span>
                </div>

                {/* Divider line + items */}
                <div style={{ flex: 1, borderLeft: '2px solid #d8e8d8', paddingLeft: 14, paddingBottom: 16, paddingTop: 8 }}>
                  {groups[slot].map(item => {
                    const linkedTask = tasks.find(t => t.id === item.task_id)
                    const linkedInv  = inv.find(i => i.id === item.inventory_id)
                    const status     = linkedTask?.status ?? linkedInv?.status
                    const dot        = STATUS_DOT[status ?? ''] ?? '#b0c8b0'
                    const bg =
                      item.type === 'task'      ? '#e8f4e8' :
                      item.type === 'inventory' ? '#eef0f8' :
                      '#f0f4f0'
                    const textColor =
                      item.type === 'task'      ? '#2d6a30' :
                      item.type === 'inventory' ? '#2d3a6a' :
                      '#4a6a4a'

                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          backgroundColor: bg,
                          borderRadius: 10,
                          padding: '9px 12px',
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dot, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 500, color: textColor, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.title}
                          </p>
                          {item.type !== 'note' && (
                            <p style={{ fontSize: 11, color: '#9db89f', margin: '2px 0 0', textTransform: 'capitalize' }}>
                              {item.type}{status ? ` · ${status.replace('_', ' ')}` : ''}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={e => deleteItem(item.id, e)}
                          style={{ color: '#c0607a', fontSize: 18, lineHeight: 1, padding: 4, opacity: 0.6, flexShrink: 0 }}
                        >×</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Remove day (only if >1 day) */}
        {days.length > 1 && slots.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              onClick={removeCurrentDay}
              style={{ fontSize: 12, color: '#c0607a', opacity: 0.7 }}
            >Remove this day</button>
          </div>
        )}
      </div>

      {/* ── FAB — safe-area-aware, 56px touch target ── */}
      <button
        onClick={openAdd}
        className="fab-bottom"
        style={{
          position: 'fixed',
          right: 20,
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: '#d4849a',
          color: '#fff',
          fontSize: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
          zIndex: 15,
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
        }}
        aria-label="Add timeline item"
      >+</button>

      {/* ── Add item sheet ── */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)' }}
            onClick={() => setShowAdd(false)}
          />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: '#fff', borderRadius: '20px 20px 0 0',
            padding: '20px 16px 36px', maxHeight: '88vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#2d4a30' }}>{weekday}</p>
                <p style={{ fontSize: 12, color: '#9db89f', marginTop: 2 }}>{short}</p>
              </div>
              <button onClick={() => setShowAdd(false)} style={{ color: '#9db89f', fontSize: 24, padding: 4 }}>×</button>
            </div>

            {/* Time */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <input
                type="time"
                value={addTime}
                disabled={addAllDay}
                onChange={e => setAddTime(e.target.value)}
                style={{
                  flex: 1, borderRadius: 12, border: '1.5px solid #c8dcc8',
                  padding: '10px 12px', fontSize: 15, color: addAllDay ? '#b0c8b0' : '#2d4a30',
                  backgroundColor: '#f8fbf8', outline: 'none',
                }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#5a7d5e', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={addAllDay}
                  onChange={e => setAddAllDay(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#7a9e7e' }}
                />
                All day
              </label>
            </div>

            {/* Type */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['note', 'task', 'inventory'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => { setAddType(type); setAddTaskId(null); setAddInvId(null); setAddSearch('') }}
                  style={{
                    flex: 1, padding: '9px 4px', borderRadius: 12, fontSize: 13, fontWeight: 500,
                    backgroundColor: addType === type ? '#2d4a30' : '#e8f0e8',
                    color: addType === type ? '#fff' : '#5a7d5e',
                  }}
                >
                  {type === 'note' ? 'Note' : type === 'task' ? 'Task' : 'Inventory'}
                </button>
              ))}
            </div>

            {/* Title */}
            <input
              value={addTitle}
              onChange={e => setAddTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canSave && saveItem()}
              placeholder={
                addType === 'note'      ? 'What\'s happening?' :
                addType === 'task'      ? 'Label (optional — uses task name)' :
                                          'Label (optional — uses item name)'
              }
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box', borderRadius: 12,
                border: '1.5px solid #c8dcc8', padding: '11px 14px',
                fontSize: 14, color: '#2d4a30', backgroundColor: '#f8fbf8',
                marginBottom: 12, outline: 'none',
              }}
            />

            {/* Task / Inventory search */}
            {(addType === 'task' || addType === 'inventory') && (
              <div style={{ marginBottom: 12 }}>
                <input
                  value={addSearch}
                  onChange={e => setAddSearch(e.target.value)}
                  placeholder={addType === 'task' ? 'Search tasks…' : 'Search inventory…'}
                  style={{
                    width: '100%', boxSizing: 'border-box', borderRadius: 12,
                    border: '1.5px solid #c8dcc8', padding: '10px 14px',
                    fontSize: 13, color: '#2d4a30', backgroundColor: '#f8fbf8',
                    marginBottom: 8, outline: 'none',
                  }}
                />
                <div style={{ maxHeight: 200, overflowY: 'auto', borderRadius: 12, border: '1px solid #d8e8d8' }}>
                  {addType === 'task' ? (
                    filteredTasks.length === 0
                      ? <p style={{ padding: '12px 14px', fontSize: 13, color: '#9db89f' }}>No tasks found</p>
                      : filteredTasks.map(t => (
                        <div
                          key={t.id}
                          onClick={() => setAddTaskId(addTaskId === t.id ? null : t.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', borderBottom: '1px solid #f0f4f0',
                            cursor: 'pointer',
                            backgroundColor: addTaskId === t.id ? '#e8f4e8' : '#fff',
                          }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: STATUS_DOT[t.status] ?? '#9db89f', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: '#2d4a30', flex: 1 }}>{t.title}</span>
                          {t.category && <span style={{ fontSize: 10, color: '#9db89f' }}>{t.category}</span>}
                          {addTaskId === t.id && <span style={{ color: '#7a9e7e' }}>✓</span>}
                        </div>
                      ))
                  ) : (
                    filteredInv.length === 0
                      ? <p style={{ padding: '12px 14px', fontSize: 13, color: '#9db89f' }}>No inventory found</p>
                      : filteredInv.map(i => (
                        <div
                          key={i.id}
                          onClick={() => setAddInvId(addInvId === i.id ? null : i.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', borderBottom: '1px solid #f0f4f0',
                            cursor: 'pointer',
                            backgroundColor: addInvId === i.id ? '#e8f4e8' : '#fff',
                          }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: STATUS_DOT[i.status] ?? '#9db89f', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: '#2d4a30', flex: 1 }}>{i.name}</span>
                          {i.category && <span style={{ fontSize: 10, color: '#9db89f' }}>{i.category}</span>}
                          {addInvId === i.id && <span style={{ color: '#7a9e7e' }}>✓</span>}
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            <button
              onClick={saveItem}
              disabled={!canSave || saving}
              style={{
                width: '100%', padding: 14, borderRadius: 14,
                fontSize: 15, fontWeight: 600,
                backgroundColor: canSave && !saving ? '#2d4a30' : '#b8d0ba',
                color: '#fff', cursor: canSave && !saving ? 'pointer' : 'default',
              }}
            >
              {saving ? 'Adding…' : 'Add to timeline'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
