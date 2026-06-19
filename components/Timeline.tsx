'use client'

import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { Task, InventoryItem } from '@/lib/db'

const DEFAULT_DAYS = ['2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30']
const LOCAL_KEY = 'wedding_timeline_days'

// 30-min grid from 6 AM to 11 PM
const TIME_GRID: string[] = ['']
for (let h = 6; h <= 23; h++) {
  TIME_GRID.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 23) TIME_GRID.push(`${String(h).padStart(2, '0')}:30`)
}

const STATUS_DOT: Record<string, string> = {
  pending: '#d4849a', in_progress: '#e6c84a', done: '#7a9e7e', blocked: '#c0607a',
  needed: '#d4849a', partial: '#e6c84a', acquired: '#7a9e7e',
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
    short: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }
}

function loadDays(): string[] {
  if (typeof window === 'undefined') return DEFAULT_DAYS
  try { const s = localStorage.getItem(LOCAL_KEY); return s ? JSON.parse(s) : DEFAULT_DAYS }
  catch { return DEFAULT_DAYS }
}

// ── Draggable card ───────────────────────────────────────────────────────────

function DraggableTimeCard({
  item, tasks, inv, onEdit, onDelete,
}: {
  item: TimelineItem
  tasks: Task[]
  inv: InventoryItem[]
  onEdit: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id })
  const linkedTask = tasks.find(t => t.id === item.task_id)
  const linkedInv  = inv.find(i => i.id === item.inventory_id)
  const status     = linkedTask?.status ?? linkedInv?.status
  const dot        = STATUS_DOT[status ?? ''] ?? '#b0c8b0'
  const bg         = item.type === 'task' ? '#e8f4e8' : item.type === 'inventory' ? '#eef0f8' : '#f0f4f0'
  const textColor  = item.type === 'task' ? '#2d6a30' : item.type === 'inventory' ? '#2d3a6a' : '#4a6a4a'

  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.3 : 1, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
      {/* 6-dot drag handle */}
      <button
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        style={{ color: '#c8dcc8', cursor: 'grab', touchAction: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, minHeight: 36, flexShrink: 0, WebkitTapHighlightColor: 'transparent', userSelect: 'none', WebkitUserSelect: 'none' }}
        title="Drag to change time"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="4" cy="3" r="1.5" fill="currentColor"/>
          <circle cx="10" cy="3" r="1.5" fill="currentColor"/>
          <circle cx="4" cy="7" r="1.5" fill="currentColor"/>
          <circle cx="10" cy="7" r="1.5" fill="currentColor"/>
          <circle cx="4" cy="11" r="1.5" fill="currentColor"/>
          <circle cx="10" cy="11" r="1.5" fill="currentColor"/>
        </svg>
      </button>

      {/* card */}
      <div
        onClick={onEdit}
        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, backgroundColor: bg, borderRadius: 10, padding: '8px 10px', cursor: 'pointer' }}
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
        <button onClick={onDelete} style={{ color: '#c0607a', fontSize: 18, lineHeight: 1, padding: 4, opacity: 0.5, flexShrink: 0 }}>×</button>
      </div>
    </div>
  )
}

// ── Droppable slot row ───────────────────────────────────────────────────────

function DroppableSlot({ slot, children, showEmpty }: { slot: string; children: React.ReactNode; showEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'slot-' + slot })
  const hasChildren = !!children

  return (
    <div
      ref={setNodeRef}
      style={{
        display: 'flex', gap: 12, marginBottom: hasChildren ? 4 : 2,
        backgroundColor: isOver ? 'rgba(122,158,126,0.1)' : 'transparent',
        borderRadius: 10, transition: 'background-color 0.1s',
        minHeight: showEmpty && !hasChildren ? 40 : undefined,
      }}
    >
      {/* time label */}
      <div style={{ width: 72, flexShrink: 0, paddingTop: hasChildren ? 10 : 11, textAlign: 'right' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: isOver ? '#7a9e7e' : '#7a9e7e', whiteSpace: 'nowrap' }}>
          {fmt12(slot)}
        </span>
      </div>
      {/* content */}
      <div style={{ flex: 1, borderLeft: `2px solid ${isOver ? '#7a9e7e' : hasChildren ? '#d8e8d8' : '#ecf4ec'}`, paddingLeft: 14, paddingBottom: hasChildren ? 14 : 4, paddingTop: 8 }}>
        {hasChildren ? children : showEmpty ? (
          <div style={{ height: 24, borderRadius: 8, border: '1.5px dashed #d8e8d8', display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
            <span style={{ fontSize: 11, color: '#c8dcc8' }}>drop here</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Drag overlay (floating card) ─────────────────────────────────────────────

function CardOverlay({ item }: { item: TimelineItem }) {
  const bg = item.type === 'task' ? '#e8f4e8' : item.type === 'inventory' ? '#eef0f8' : '#f0f4f0'
  const textColor = item.type === 'task' ? '#2d6a30' : item.type === 'inventory' ? '#2d3a6a' : '#4a6a4a'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: bg, borderRadius: 10, padding: '9px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.20)', opacity: 0.96, cursor: 'grabbing', marginLeft: 28, maxWidth: 280 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#9db89f', flexShrink: 0 }} />
      <p style={{ fontSize: 14, fontWeight: 500, color: textColor, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
    </div>
  )
}

// ── Edit modal (day + time + title) ─────────────────────────────────────────

function EditItemModal({ item, days, onClose, onSave, onDelete }: {
  item: TimelineItem
  days: string[]
  onClose: () => void
  onSave: (u: { title: string; day_date: string; time_slot: string }) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [title,   setTitle]   = useState(item.title)
  const [day,     setDay]     = useState(item.day_date)
  const [time,    setTime]    = useState(item.time_slot)
  const [allDay,  setAllDay]  = useState(!item.time_slot)
  const [saving,  setSaving]  = useState(false)
  const [confirm, setConfirm] = useState(false)

  async function submit() {
    setSaving(true)
    await onSave({ title: title.trim() || item.title, day_date: day, time_slot: allDay ? '' : time })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 55 }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 16px 36px', maxHeight: '82vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#2d4a30' }}>Edit item</p>
          <button onClick={onClose} style={{ color: '#9db89f', fontSize: 24, padding: 4 }}>×</button>
        </div>

        {/* Title */}
        <input value={title} onChange={e => setTitle(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1.5px solid #c8dcc8', padding: '11px 14px', fontSize: 14, color: '#2d4a30', backgroundColor: '#f8fbf8', outline: 'none', marginBottom: 16 }} />

        {/* Day */}
        <p style={{ fontSize: 11, color: '#b8d0ba', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Day</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {days.map(d => {
            const { weekday, short } = fmtDay(d)
            return (
              <button key={d} onClick={() => setDay(d)}
                style={{ padding: '8px 14px', borderRadius: 12, fontSize: 13, fontWeight: 500, backgroundColor: day === d ? '#2d4a30' : '#e8f0e8', color: day === d ? '#fff' : '#5a7d5e' }}>
                {weekday.slice(0, 3)} · {short}
              </button>
            )
          })}
        </div>

        {/* Time */}
        <p style={{ fontSize: 11, color: '#b8d0ba', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Time</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <input type="time" value={time} disabled={allDay} onChange={e => setTime(e.target.value)}
            style={{ flex: 1, borderRadius: 12, border: '1.5px solid #c8dcc8', padding: '10px 12px', fontSize: 15, color: allDay ? '#b0c8b0' : '#2d4a30', backgroundColor: '#f8fbf8', outline: 'none' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#5a7d5e', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#7a9e7e' }} />
            All day
          </label>
        </div>

        <button onClick={submit} disabled={saving}
          style={{ width: '100%', padding: 14, borderRadius: 14, fontSize: 15, fontWeight: 600, backgroundColor: saving ? '#b8d0ba' : '#2d4a30', color: '#fff', marginBottom: 10 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>

        {confirm ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConfirm(false)} style={{ flex: 1, padding: 12, borderRadius: 12, fontSize: 14, backgroundColor: '#f0f4f0', color: '#9db89f' }}>Cancel</button>
            <button onClick={onDelete} style={{ flex: 1, padding: 12, borderRadius: 12, fontSize: 14, backgroundColor: '#c0607a', color: '#fff', fontWeight: 600 }}>Remove</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} style={{ width: '100%', padding: 12, borderRadius: 12, fontSize: 14, color: '#c0607a', backgroundColor: '#fce8ef' }}>
            Remove from timeline
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Timeline({ tasks }: { tasks: Task[] }) {
  const [items,        setItems]        = useState<TimelineItem[]>([])
  const [inv,          setInv]          = useState<InventoryItem[]>([])
  const [days,         setDays]         = useState<string[]>(DEFAULT_DAYS)
  const [dayIdx,       setDayIdx]       = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [draggingItem, setDraggingItem] = useState<TimelineItem | null>(null)
  const [editItem,     setEditItem]     = useState<TimelineItem | null>(null)

  // Add sheet
  const [showAdd,   setShowAdd]   = useState(false)
  const [addTime,   setAddTime]   = useState('')
  const [addAllDay, setAddAllDay] = useState(false)
  const [addTitle,  setAddTitle]  = useState('')
  const [addType,   setAddType]   = useState<'note' | 'task' | 'inventory'>('note')
  const [addTaskId, setAddTaskId] = useState<number | null>(null)
  const [addInvId,  setAddInvId]  = useState<number | null>(null)
  const [addSearch, setAddSearch] = useState('')
  const [saving,    setSaving]    = useState(false)

  // Add day
  const [pickingDay, setPickingDay] = useState(false)
  const [newDayStr,  setNewDayStr]  = useState('')

  const swipeX = useRef<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

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

  const currentDay  = days[Math.min(dayIdx, days.length - 1)] ?? ''
  const { weekday, short } = currentDay ? fmtDay(currentDay) : { weekday: '', short: '' }

  const dayItems = items.filter(i => i.day_date === currentDay).sort((a, b) => (a.time_slot || '').localeCompare(b.time_slot || ''))

  const groups: Record<string, TimelineItem[]> = {}
  for (const item of dayItems) {
    const key = item.time_slot || ''
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  const occupiedSlots = Object.keys(groups).sort((a, b) => { if (!a) return -1; if (!b) return 1; return a.localeCompare(b) })

  function prevDay() { setDayIdx(i => Math.max(0, i - 1)) }
  function nextDay() { setDayIdx(i => Math.min(days.length - 1, i + 1)) }

  function onTouchStart(e: React.TouchEvent) {
    if (draggingItem) return
    swipeX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (draggingItem || swipeX.current === null) return
    const dx = swipeX.current - e.changedTouches[0].clientX
    if (Math.abs(dx) > 55) dx > 0 ? nextDay() : prevDay()
    swipeX.current = null
  }

  function onDragStart(event: DragStartEvent) {
    const item = items.find(i => i.id === event.active.id)
    if (item) setDraggingItem(item)
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingItem(null)
    const { active, over } = event
    if (!over) return
    const overId = String(over.id)
    if (!overId.startsWith('slot-')) return
    const newSlot = overId.slice(5)
    const item = items.find(i => i.id === active.id)
    if (!item || item.time_slot === newSlot) return
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, time_slot: newSlot } : i))
    fetch(`/api/timeline/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_slot: newSlot }),
    }).catch(() => {})
  }

  function openAdd() {
    setShowAdd(true); setAddTime(''); setAddAllDay(false)
    setAddTitle(''); setAddType('note'); setAddTaskId(null); setAddInvId(null); setAddSearch('')
  }

  async function saveItem() {
    if (saving) return
    let title = addTitle.trim()
    let taskId: number | null = null
    let invId: number | null = null
    if (addType === 'task' && addTaskId)      { taskId = addTaskId; if (!title) title = tasks.find(t => t.id === addTaskId)?.title ?? '' }
    else if (addType === 'inventory' && addInvId) { invId  = addInvId;  if (!title) title = inv.find(i => i.id === addInvId)?.name ?? ''   }
    if (!title) return
    setSaving(true)
    const res = await fetch('/api/timeline', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day_date: currentDay, time_slot: addAllDay ? '' : addTime, title, type: addType, task_id: taskId, inventory_id: invId }),
    })
    setSaving(false)
    if (res.ok) { const item = await res.json(); setItems(prev => [...prev, item]); setShowAdd(false) }
  }

  async function deleteItem(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/timeline/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function saveEdit(updates: { title: string; day_date: string; time_slot: string }) {
    if (!editItem) return
    const res = await fetch(`/api/timeline/${editItem.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
    })
    if (res.ok) { const u = await res.json(); setItems(prev => prev.map(i => i.id === editItem.id ? u : i)) }
    setEditItem(null)
  }

  async function deleteEdit() {
    if (!editItem) return
    await fetch(`/api/timeline/${editItem.id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== editItem.id))
    setEditItem(null)
  }

  function addDay() {
    if (!newDayStr) return
    const next = [...new Set([...days, newDayStr])].sort()
    saveDays(next); setDayIdx(next.indexOf(newDayStr)); setNewDayStr(''); setPickingDay(false)
  }

  function removeCurrentDay() {
    const next = days.filter(d => d !== currentDay)
    if (!next.length) return
    saveDays(next); setDayIdx(i => Math.min(i, next.length - 1))
  }

  const searchLower   = addSearch.toLowerCase()
  const filteredTasks = (searchLower ? tasks.filter(t => t.title.toLowerCase().includes(searchLower)) : tasks).slice(0, 40)
  const filteredInv   = (searchLower ? inv.filter(i => i.name.toLowerCase().includes(searchLower))   : inv  ).slice(0, 40)
  const canSave = addType === 'note' ? !!addTitle.trim() : addType === 'task' ? !!(addTaskId || addTitle.trim()) : !!(addInvId || addTitle.trim())

  // When dragging: show full time grid; when not: only occupied slots
  const visibleSlots = draggingItem ? TIME_GRID : occupiedSlots

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', color: '#9db89f', fontSize: 14 }}>Loading timeline…</div>

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div style={{ paddingBottom: 96 }}>

        {/* Day nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button onClick={prevDay} disabled={dayIdx === 0}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e8f0e8', color: dayIdx === 0 ? '#c8dcc8' : '#2d4a30', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2d4a30' }}>{weekday}</div>
            <div style={{ fontSize: 13, color: '#7a9e7e' }}>{short}</div>
          </div>
          <button onClick={nextDay} disabled={dayIdx === days.length - 1}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e8f0e8', color: dayIdx === days.length - 1 ? '#c8dcc8' : '#2d4a30', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>›</button>
        </div>

        {/* Day dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {days.map((d, i) => (
            <button key={d} onClick={() => setDayIdx(i)}
              style={{ width: i === dayIdx ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === dayIdx ? '#2d4a30' : '#c8dcc8', transition: 'all 0.2s' }} />
          ))}
          {pickingDay ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 4 }}>
              <input type="date" value={newDayStr} onChange={e => setNewDayStr(e.target.value)}
                style={{ fontSize: 12, borderRadius: 8, border: '1px solid #9db89f', padding: '2px 6px' }} />
              <button onClick={addDay} style={{ fontSize: 12, backgroundColor: '#7a9e7e', color: '#fff', borderRadius: 8, padding: '3px 8px' }}>Add</button>
              <button onClick={() => setPickingDay(false)} style={{ fontSize: 12, color: '#9db89f' }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setPickingDay(true)}
              style={{ fontSize: 16, color: '#9db89f', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>+</button>
          )}
        </div>

        {/* Timeline */}
        {draggingItem && (
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#7a9e7e', backgroundColor: '#e8f4e8', borderRadius: 20, padding: '4px 12px' }}>
              Drop on a time slot to reschedule
            </span>
          </div>
        )}

        <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ minHeight: 200 }}>
          {visibleSlots.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 60, color: '#b0c8b0' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🗓</div>
              <p style={{ fontSize: 14 }}>Nothing scheduled yet</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Tap + to add items to this day</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {visibleSlots.map(slot => {
                const slotItems = groups[slot] ?? []
                return (
                  <DroppableSlot key={slot} slot={slot} showEmpty={!!draggingItem}>
                    {slotItems.length > 0 ? (
                      <div>
                        {slotItems.map(item => (
                          <DraggableTimeCard
                            key={item.id}
                            item={item}
                            tasks={tasks}
                            inv={inv}
                            onEdit={() => setEditItem(item)}
                            onDelete={e => deleteItem(item.id, e)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </DroppableSlot>
                )
              })}
            </div>
          )}

          {days.length > 1 && occupiedSlots.length === 0 && !draggingItem && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={removeCurrentDay} style={{ fontSize: 12, color: '#c0607a', opacity: 0.7 }}>Remove this day</button>
            </div>
          )}
        </div>

        {/* FAB */}
        <button onClick={openAdd} className="fab-above-nav" aria-label="Add timeline item"
          style={{ position: 'fixed', right: 20, width: 56, height: 56, borderRadius: '50%', backgroundColor: '#d4849a', color: '#fff', fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.22)', zIndex: 15, WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>
          +
        </button>

        {/* Add sheet */}
        {showAdd && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={() => setShowAdd(false)} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 16px 36px', maxHeight: '88vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#2d4a30' }}>{weekday}</p>
                  <p style={{ fontSize: 12, color: '#9db89f', marginTop: 2 }}>{short}</p>
                </div>
                <button onClick={() => setShowAdd(false)} style={{ color: '#9db89f', fontSize: 24, padding: 4 }}>×</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <input type="time" value={addTime} disabled={addAllDay} onChange={e => setAddTime(e.target.value)}
                  style={{ flex: 1, borderRadius: 12, border: '1.5px solid #c8dcc8', padding: '10px 12px', fontSize: 15, color: addAllDay ? '#b0c8b0' : '#2d4a30', backgroundColor: '#f8fbf8', outline: 'none' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#5a7d5e', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  <input type="checkbox" checked={addAllDay} onChange={e => setAddAllDay(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#7a9e7e' }} />
                  All day
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {(['note', 'task', 'inventory'] as const).map(type => (
                  <button key={type} onClick={() => { setAddType(type); setAddTaskId(null); setAddInvId(null); setAddSearch('') }}
                    style={{ flex: 1, padding: '9px 4px', borderRadius: 12, fontSize: 13, fontWeight: 500, backgroundColor: addType === type ? '#2d4a30' : '#e8f0e8', color: addType === type ? '#fff' : '#5a7d5e' }}>
                    {type === 'note' ? 'Note' : type === 'task' ? 'Task' : 'Inventory'}
                  </button>
                ))}
              </div>

              <input value={addTitle} onChange={e => setAddTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && canSave && saveItem()} autoFocus
                placeholder={addType === 'note' ? "What's happening?" : addType === 'task' ? 'Label (optional — uses task name)' : 'Label (optional — uses item name)'}
                style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1.5px solid #c8dcc8', padding: '11px 14px', fontSize: 14, color: '#2d4a30', backgroundColor: '#f8fbf8', marginBottom: 12, outline: 'none' }} />

              {(addType === 'task' || addType === 'inventory') && (
                <div style={{ marginBottom: 12 }}>
                  <input value={addSearch} onChange={e => setAddSearch(e.target.value)}
                    placeholder={addType === 'task' ? 'Search tasks…' : 'Search inventory…'}
                    style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1.5px solid #c8dcc8', padding: '10px 14px', fontSize: 13, color: '#2d4a30', backgroundColor: '#f8fbf8', marginBottom: 8, outline: 'none' }} />
                  <div style={{ maxHeight: 200, overflowY: 'auto', borderRadius: 12, border: '1px solid #d8e8d8' }}>
                    {addType === 'task' ? (
                      filteredTasks.length === 0
                        ? <p style={{ padding: '12px 14px', fontSize: 13, color: '#9db89f' }}>No tasks found</p>
                        : filteredTasks.map(t => (
                          <div key={t.id} onClick={() => setAddTaskId(addTaskId === t.id ? null : t.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f0f4f0', cursor: 'pointer', backgroundColor: addTaskId === t.id ? '#e8f4e8' : '#fff' }}>
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
                          <div key={i.id} onClick={() => setAddInvId(addInvId === i.id ? null : i.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f0f4f0', cursor: 'pointer', backgroundColor: addInvId === i.id ? '#e8f4e8' : '#fff' }}>
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

              <button onClick={saveItem} disabled={!canSave || saving}
                style={{ width: '100%', padding: 14, borderRadius: 14, fontSize: 15, fontWeight: 600, backgroundColor: canSave && !saving ? '#2d4a30' : '#b8d0ba', color: '#fff', cursor: canSave && !saving ? 'pointer' : 'default' }}>
                {saving ? 'Adding…' : 'Add to timeline'}
              </button>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editItem && (
          <EditItemModal item={editItem} days={days} onClose={() => setEditItem(null)} onSave={saveEdit} onDelete={deleteEdit} />
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingItem && <CardOverlay item={draggingItem} />}
      </DragOverlay>
    </DndContext>
  )
}
