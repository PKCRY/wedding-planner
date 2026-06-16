'use client'

import { useState } from 'react'
import type { Task, Event } from '@/lib/db'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

interface Props {
  tasks: Task[]
  events: Event[]
  onAddEvent: (date: string, title: string, description: string) => Promise<void>
  onDeleteEvent: (id: number) => Promise<void>
}

export default function Calendar({ tasks, events, onAddEvent, onDeleteEvent }: Props) {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState<string | null>(null)
  const [addTitle, setAddTitle] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [saving, setSaving] = useState(false)

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  function ds(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function itemsForDay(day: number) {
    const d = ds(day)
    return {
      due: tasks.filter(t => t.due_date?.slice(0, 10) === d),
      done: tasks.filter(t => t.completed_date?.slice(0, 10) === d),
      evts: events.filter(e => e.date === d),
    }
  }

  const sel = selected ? {
    due: tasks.filter(t => t.due_date?.slice(0, 10) === selected),
    done: tasks.filter(t => t.completed_date?.slice(0, 10) === selected),
    evts: events.filter(e => e.date === selected),
  } : null

  async function handleAdd() {
    if (!selected || !addTitle.trim()) return
    setSaving(true)
    await onAddEvent(selected, addTitle.trim(), addDesc.trim())
    setAddTitle('')
    setAddDesc('')
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: '1px solid #d8e8d8' }}>
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="w-11 h-11 flex items-center justify-center rounded-lg text-sm font-bold" style={{ color: '#7a9e7e', backgroundColor: '#f0f4f0' }}>
          ‹
        </button>
        <span className="font-semibold text-sm" style={{ color: '#2d4a30' }}>{MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="w-11 h-11 flex items-center justify-center rounded-lg text-sm font-bold" style={{ color: '#7a9e7e', backgroundColor: '#f0f4f0' }}>
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium py-1" style={{ color: '#9db89f' }}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const d = ds(day)
          const { due, done, evts } = itemsForDay(day)
          const isToday = d === todayStr
          const isSelected = d === selected

          return (
            <button
              key={i}
              onClick={() => setSelected(isSelected ? null : d)}
              className="flex flex-col items-center justify-center py-1 rounded-lg transition-colors"
              style={{ minHeight: 44, backgroundColor: isSelected ? '#d8e8d8' : isToday ? '#f0e8ec' : 'transparent' }}
            >
              <span className="text-xs w-6 h-6 flex items-center justify-center rounded-full" style={{ color: '#2d4a30', fontWeight: isToday ? 700 : 400 }}>
                {day}
              </span>
              <div className="flex gap-0.5 h-1.5">
                {due.length > 0 && <span className="w-1 h-1 rounded-full" style={{ backgroundColor: '#d4849a' }} />}
                {done.length > 0 && <span className="w-1 h-1 rounded-full" style={{ backgroundColor: '#7a9e7e' }} />}
                {evts.length > 0 && <span className="w-1 h-1 rounded-full" style={{ backgroundColor: '#b8a0c8' }} />}
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex gap-4 mt-3 text-xs" style={{ color: '#9db89f' }}>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#d4849a' }} /> Due
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#7a9e7e' }} /> Completed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#b8a0c8' }} /> Event
        </span>
      </div>

      {selected && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid #d8e8d8' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: '#2d4a30' }}>
            {new Date(selected + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>

          {sel?.evts.map(e => (
            <div key={e.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-2 mb-1" style={{ backgroundColor: '#f3f0f8' }}>
              <div className="min-w-0 break-words">
                <span className="font-medium" style={{ color: '#2d4a30' }}>{e.title}</span>
                {e.description && <span className="ml-1" style={{ color: '#9db89f' }}>{e.description}</span>}
              </div>
              <button onClick={() => onDeleteEvent(e.id)} className="ml-2 text-sm shrink-0" style={{ color: '#c0607a' }}>×</button>
            </div>
          ))}

          {sel?.due.map(t => (
            <div key={`d-${t.id}`} className="text-xs rounded-lg px-3 py-2 mb-1" style={{ backgroundColor: '#f0e8ec' }}>
              <span style={{ color: '#c0607a' }}>Due: </span>
              <span style={{ color: '#2d4a30' }}>{t.title}</span>
            </div>
          ))}

          {sel?.done.map(t => (
            <div key={`c-${t.id}`} className="text-xs rounded-lg px-3 py-2 mb-1" style={{ backgroundColor: '#e8f0e8' }}>
              <span style={{ color: '#7a9e7e' }}>Done: </span>
              <span style={{ color: '#2d4a30' }}>{t.title}</span>
            </div>
          ))}

          {sel?.evts.length === 0 && sel?.due.length === 0 && sel?.done.length === 0 && (
            <p className="text-xs mb-2" style={{ color: '#b8d0ba' }}>Nothing scheduled.</p>
          )}

          <div className="space-y-2 mt-2">
            <input
              value={addTitle}
              onChange={e => setAddTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Add event..."
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ border: '1px solid #b8d0ba', color: '#2d4a30' }}
            />
            <input
              value={addDesc}
              onChange={e => setAddDesc(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ border: '1px solid #b8d0ba', color: '#2d4a30' }}
            />
            <button
              onClick={handleAdd}
              disabled={!addTitle.trim() || saving}
              className="w-full rounded-lg py-2 text-sm text-white"
              style={{ backgroundColor: '#d4849a', opacity: !addTitle.trim() || saving ? 0.5 : 1 }}
            >
              {saving ? 'Adding...' : 'Add Event'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
