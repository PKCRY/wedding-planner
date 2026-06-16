'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, Event, TaskComment } from '@/lib/db'
import type { SessionUser } from '@/lib/session'
import Calendar from '@/components/Calendar'
import PushManagerInline from '@/components/PushManagerInline'
import InventoryList from '@/components/InventoryList'

const STATUS_BAR: Record<string, string> = {
  done:        '#7a9e7e',  // green
  in_progress: '#e6c84a',  // yellow
  pending:     '#d4849a',  // red-pink
  blocked:     '#c0607a',  // dark red
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:     { bg: '#f0f4f0', color: '#7a9e7e' },
  in_progress: { bg: '#e8f0e8', color: '#5a7d5e' },
  done:        { bg: '#e8f4e8', color: '#2d6a30' },
  blocked:     { bg: '#f0e8ec', color: '#c0607a' },
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', in_progress: 'In Progress', done: 'Done', blocked: 'Blocked',
}

const ASSIGN_LABEL: Record<string, string> = {
  nick: 'Nick', siobhan: 'Siobhan', both: 'Both',
  taylor: 'Taylor', dad: 'Dad', mom: 'Mom',
}

const PRIORITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  high:   { bg: '#fce8ef', color: '#c0607a', label: 'High' },
  medium: { bg: '#fef9e7', color: '#a07800', label: 'Medium' },
  low:    { bg: '#e8f4e8', color: '#2d6a30', label: 'Low' },
}
const PRIORITY_NEXT: Record<string, string> = { low: 'medium', medium: 'high', high: 'low' }

type Filter = 'all' | 'nick' | 'siobhan' | 'both' | 'taylor' | 'dad'
type Tab = 'tasks' | 'completed' | 'review' | 'calendar' | 'inventory' | 'notify'

export default function DashboardClient({
  user,
  initialTasks,
  initialEvents,
}: {
  user: SessionUser
  initialTasks: Task[]
  initialEvents: Event[]
}) {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [events, setEvents] = useState<Event[]>(initialEvents)
  const [filter, setFilter] = useState<Filter>('all')
  const [tab, setTab] = useState<Tab>('tasks')
  const [showCreate, setShowCreate] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [showNotify, setShowNotify] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [, startTransition] = useTransition()


  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  async function refreshTasks(f: Filter) {
    const res = await fetch(`/api/tasks?filter=${f}`)
    if (res.ok) setTasks(await res.json())
  }

  function changeFilter(f: Filter) {
    setFilter(f)
    startTransition(() => refreshTasks(f))
  }

  async function deleteTask(id: number) {
    if (!confirm('Delete this task?')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  async function patchTask(id: number, updates: Record<string, unknown>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks(prev => prev.map(t => t.id === id ? updated : t))
      return updated
    }
  }

  async function addEvent(date: string, title: string, description: string) {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, title, description }),
    })
    if (res.ok) {
      const ev = await res.json()
      setEvents(prev => [...prev, ev].sort((a, b) => a.date.localeCompare(b.date)))
    }
  }

  async function deleteEvent(id: number) {
    await fetch(`/api/events/${id}`, { method: 'DELETE' })
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.assigned_to === filter)
  const reviewTasks = tasks.filter(t => t.created_by === 'siobhan' && t.status !== 'done')
  const displayed = [...filtered]
    .filter(t => tab === 'completed' ? t.status === 'done' : t.status !== 'done')
    .sort((a, b) => a.sort_order - b.sort_order)

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
  }

  const sortedAll = [...tasks].sort((a, b) => a.sort_order - b.sort_order)

  const canDragReorder = tab === 'tasks' && filter === 'all'
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 0, tolerance: 8 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = displayed.findIndex(t => t.id === active.id)
    const newIndex = displayed.findIndex(t => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(displayed, oldIndex, newIndex)
    const updated = reordered.map((t, idx) => ({ ...t, sort_order: idx + 1 }))
    const updatedById = new Map(updated.map(t => [t.id, t.sort_order]))
    setTasks(prev => prev.map(t => updatedById.has(t.id) ? { ...t, sort_order: updatedById.get(t.id)! } : t))

    fetch('/api/tasks/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated.map(t => ({ id: t.id, sort_order: t.sort_order }))),
    }).catch(() => {})
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f0' }}>
      {/* Header */}
      <header className="bg-white sticky top-0 z-10" style={{ borderBottom: '1px solid #b8d0ba' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div>
            <div className="font-semibold leading-tight" style={{ color: '#2d4a30' }}>Wedding Planner</div>
            <div className="text-xs sm:text-sm" style={{ color: '#9db89f' }}>Hey {user.name}!</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotify(true)}
              className="text-sm px-4 rounded-xl font-medium hidden sm:block"
              style={{ backgroundColor: '#e8f0e8', color: '#5a7d5e', minHeight: 44 }}
            >
              Notify
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="text-sm px-4 rounded-xl font-medium hidden sm:block"
              style={{ backgroundColor: '#d4849a', color: '#fff', minHeight: 44 }}
            >
              + Add Task
            </button>
            <button
              onClick={logout}
              className="text-sm px-4 rounded-xl font-medium hidden sm:block"
              style={{ backgroundColor: '#f0e8ec', color: '#c0607a', minHeight: 44 }}
            >
              Logout
            </button>
            {/* Avatar — opens settings */}
            <button
              onClick={() => setShowSettings(true)}
              className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-base shrink-0 shadow-sm"
              style={{ backgroundColor: '#7a9e7e' }}
              title="Account settings"
            >
              {user.name.charAt(0).toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">

        {/* Two-column layout on lg+ */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">

          {/* Left: tasks (full width on mobile, 2/3 on lg) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Tabs — scrollable so all tabs are always reachable on small screens */}
            <div className="flex gap-1 rounded-xl p-1 overflow-x-auto no-scrollbar" style={{ backgroundColor: '#d8e8d8', WebkitOverflowScrolling: 'touch' }}>
              {([
                { key: 'tasks',     label: 'Active' },
                { key: 'completed', label: 'Done' },
                { key: 'review',    label: `Review${reviewTasks.length ? ` (${reviewTasks.length})` : ''}` },
                { key: 'inventory', label: 'Items' },
                ...(user.id === 'nick' ? [{ key: 'notify', label: 'Notify' }] : []),
                { key: 'calendar',  label: 'Calendar', lgHide: true },
              ] as { key: Tab; label: string; lgHide?: boolean }[]).map(({ key, label, lgHide }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`shrink-0 text-sm font-medium rounded-lg transition-colors ${lgHide ? 'lg:hidden' : ''}`}
                  style={{ backgroundColor: tab === key ? '#fff' : 'transparent', color: tab === key ? '#2d4a30' : '#7a9e7e', minHeight: 44, minWidth: 72, padding: '0 12px' }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Task list */}
            {(tab === 'tasks' || tab === 'completed') && (
              <div>
                {/* Filter */}
                <div className="flex gap-1 rounded-xl p-1 mb-4 overflow-x-auto no-scrollbar" style={{ backgroundColor: '#e8f0e8' }}>
                  {(['all', 'nick', 'siobhan', 'taylor', 'dad', 'both'] as Filter[]).map(f => (
                    <button
                      key={f}
                      onClick={() => changeFilter(f)}
                      className="shrink-0 text-sm font-medium rounded-lg transition-colors"
                      style={{ backgroundColor: filter === f ? '#fff' : 'transparent', color: filter === f ? '#2d4a30' : '#7a9e7e', minHeight: 44, minWidth: 60, padding: '0 10px' }}
                    >
                      {f === 'all' ? 'All' : f === user.id ? 'Mine' : ASSIGN_LABEL[f] ?? f}
                    </button>
                  ))}
                </div>

                {displayed.length === 0 ? (
                  <div className="text-center py-16 text-sm" style={{ color: '#9db89f' }}>No tasks here yet</div>
                ) : canDragReorder ? (
                  <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={displayed.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2 pb-24 lg:pb-8">
                        {displayed.map((task, i) => (
                          <SortableTaskCard
                            key={task.id}
                            task={task}
                            pos={i + 1}
                            onDetail={() => setDetailTask(task)}
                            onEdit={() => setEditTask(task)}
                            onDelete={() => deleteTask(task.id)}
                            onPatch={u => patchTask(task.id, u)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className="space-y-2 pb-24 lg:pb-8">
                    {displayed.map((task, i) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        pos={i + 1}
                        onDetail={() => setDetailTask(task)}
                        onEdit={() => setEditTask(task)}
                        onDelete={() => deleteTask(task.id)}
                        onPatch={u => patchTask(task.id, u)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* In Review — tasks Siobhan submitted */}
            {tab === 'review' && (
              <div className="space-y-2 pb-24 lg:pb-8">
                {reviewTasks.length === 0 ? (
                  <div className="text-center py-16 text-sm" style={{ color: '#9db89f' }}>No tasks pending review</div>
                ) : reviewTasks.sort((a, b) => a.sort_order - b.sort_order).map((task, i) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    pos={i + 1}
                    onDetail={() => setDetailTask(task)}
                    onEdit={() => setEditTask(task)}
                    onDelete={() => deleteTask(task.id)}
                    onPatch={(u) => patchTask(task.id, u)}
                  />
                ))}
              </div>
            )}

            {/* Inventory */}
            {tab === 'inventory' && <InventoryList isAdmin={true} />}

            {/* Notify Siobhan */}
            {tab === 'notify' && <NotifyTab />}

            {/* Calendar — mobile only when tab=calendar; always in right sidebar on lg */}
            {tab === 'calendar' && (
              <div className="lg:hidden">
                <Calendar tasks={tasks} events={events} onAddEvent={addEvent} onDeleteEvent={deleteEvent} />
              </div>
            )}
          </div>

          {/* Right sidebar: calendar (lg only) */}
          <div className="hidden lg:block lg:col-span-1 space-y-4">
            <Calendar tasks={tasks} events={events} onAddEvent={addEvent} onDeleteEvent={deleteEvent} />
          </div>
        </div>
      </div>

      {/* FAB — mobile only (desktop has header button), hidden on inventory/notify tabs */}
      {tab !== 'inventory' && tab !== 'notify' && <button
        onClick={() => setShowCreate(true)}
        className="fixed right-5 w-14 h-14 text-white rounded-full shadow-lg text-2xl flex items-center justify-center z-10 fab-bottom sm:hidden"
        style={{ backgroundColor: '#d4849a' }}
      >
        +
      </button>}

      {showCreate && (
        <TaskModal
          onClose={() => setShowCreate(false)}
          onSave={async data => {
            const res = await fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            })
            if (res.ok) {
              const task = await res.json()
              setTasks(prev => [task, ...prev])
              setShowCreate(false)
            }
          }}
        />
      )}

      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onEdit={() => { setEditTask(detailTask); setDetailTask(null) }}
          onDelete={() => { deleteTask(detailTask.id); setDetailTask(null) }}
          onPatch={async u => {
            const updated = await patchTask(detailTask.id, u)
            if (updated) setDetailTask(updated)
          }}
          onAddComment={async text => {
            await patchTask(detailTask.id, { add_comment: text })
            const res = await fetch(`/api/tasks?filter=${filter}`)
            if (res.ok) {
              const all = await res.json() as Task[]
              const fresh = all.find(t => t.id === detailTask.id)
              if (fresh) setDetailTask(fresh)
              setTasks(all)
            }
          }}
        />
      )}

      {editTask && (
        <TaskModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onSave={async data => {
            const updated = await patchTask(editTask.id, data)
            if (updated) setEditTask(null)
          }}
          onAddComment={async text => {
            await patchTask(editTask.id, { add_comment: text })
            const res = await fetch(`/api/tasks?filter=${filter}`)
            if (res.ok) {
              const all = await res.json() as Task[]
              setEditTask(all.find(t => t.id === editTask.id) ?? null)
              setTasks(all)
            }
          }}
        />
      )}

      {showNotify && <NotifyModal onClose={() => setShowNotify(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onLogout={logout} />}
    </div>
  )
}

function SortableTaskCard(props: {
  task: Task; pos: number
  onDetail: () => void; onEdit: () => void
  onDelete: () => void; onPatch: (u: Record<string, unknown>) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <TaskCard {...props} dragHandle={{ ...attributes, ...listeners }} />
    </div>
  )
}

function TaskCard({ task, pos, onDetail, onEdit, onDelete, onPatch, dragHandle }: {
  task: Task; pos: number
  onDetail: () => void; onEdit: () => void
  onDelete: () => void; onPatch: (u: Record<string, unknown>) => void
  dragHandle?: Record<string, unknown>
}) {
  const st = STATUS_STYLE[task.status] ?? STATUS_STYLE.pending
  const isDone = task.status === 'done'

  function cycleStatus() {
    const next: Record<string, string> = { pending: 'in_progress', in_progress: 'done', done: 'pending', blocked: 'pending' }
    onPatch({ status: next[task.status] })
  }

  return (
    <div className="relative bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid #d8e8d8' }}>
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: STATUS_BAR[task.status] ?? '#d8e8d8' }} />
      <button type="button" onClick={onDetail} className="absolute inset-0 w-full h-full rounded-xl z-0" />

      <div className="relative flex items-center gap-2 pl-3 pr-3 py-3 pointer-events-none">

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            {dragHandle && (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#f0f4f0', color: '#9db89f' }}>
                #{pos}
              </span>
            )}
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: st.bg, color: st.color }}>
              {STATUS_LABEL[task.status]}
            </span>
          </div>
          <p className="font-medium text-sm leading-snug" style={{ color: '#2d4a30' }}>{task.title}</p>
          {task.due_date && (
            <p className="text-xs mt-0.5" style={{ color: '#b8d0ba' }}>
              Due {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="pointer-events-auto flex items-center gap-1 shrink-0">
          <button onClick={e => { e.stopPropagation(); cycleStatus() }}
            className="text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: '#f0f4f0', color: '#7a9e7e' }}>↻</button>
          <button onClick={e => { e.stopPropagation(); onEdit() }}
            className="text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: '#f0f4f0', color: '#7a9e7e' }}>Edit</button>
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: '#fdecea', color: '#c0607a' }}>Del</button>
          {dragHandle && (
            <button
              {...dragHandle}
              onClick={e => e.stopPropagation()}
              onContextMenu={e => e.preventDefault()}
              onTouchStart={e => e.preventDefault()}
              className="touch-none rounded cursor-grab active:cursor-grabbing flex items-center justify-center"
              style={{
                color: '#b8d0ba',
                WebkitTouchCallout: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'none',
                minWidth: 28,
                minHeight: 44,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="7" cy="5" r="2" fill="currentColor"/>
                <circle cx="13" cy="5" r="2" fill="currentColor"/>
                <circle cx="7" cy="10" r="2" fill="currentColor"/>
                <circle cx="13" cy="10" r="2" fill="currentColor"/>
                <circle cx="7" cy="15" r="2" fill="currentColor"/>
                <circle cx="13" cy="15" r="2" fill="currentColor"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function TaskDetailModal({ task, onClose, onEdit, onDelete, onPatch, onAddComment }: {
  task: Task
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onPatch: (u: Record<string, unknown>) => void
  onAddComment: (text: string) => Promise<void>
}) {
  const [commentText, setCommentText] = useState('')
  const [saving, setSaving] = useState(false)
  const st = STATUS_STYLE[task.status] ?? STATUS_STYLE.pending

  const STATUS_NEXT: Record<string, string> = {
    pending: 'in_progress', in_progress: 'done', done: 'pending', blocked: 'pending',
  }

  async function submitComment() {
    if (!commentText.trim()) return
    setSaving(true)
    await onAddComment(commentText.trim())
    setCommentText('')
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 sticky top-0 bg-white rounded-t-2xl z-10"
          style={{ borderBottom: '1px solid #d8e8d8' }}>
          <div className="flex flex-wrap gap-1.5 flex-1 pr-3">
            <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: st.bg, color: st.color }}>
              {STATUS_LABEL[task.status]}
            </span>
            <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#f0e8ec', color: '#c0607a' }}>
              {ASSIGN_LABEL[task.assigned_to]}
            </span>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-xl shrink-0"
            style={{ backgroundColor: '#f0f4f0', color: '#9db89f' }}>×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <h2 className="text-xl font-semibold leading-snug"
            style={{ color: '#2d4a30' }}>
            {task.title}
          </h2>

          {/* Description */}
          {task.description && (
            <p className="text-sm leading-relaxed" style={{ color: '#5a7d5e' }}>{task.description}</p>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onPatch({ priority: PRIORITY_NEXT[task.priority] })}
              className="rounded-xl p-3 text-left"
              style={{ backgroundColor: PRIORITY_STYLE[task.priority]?.bg ?? '#f0f4f0' }}
            >
              <p className="text-xs mb-0.5" style={{ color: '#9db89f' }}>Priority (tap to cycle)</p>
              <p className="text-sm font-medium" style={{ color: PRIORITY_STYLE[task.priority]?.color ?? '#2d4a30' }}>
                {PRIORITY_STYLE[task.priority]?.label ?? task.priority}
              </p>
            </button>
            {[
              { label: 'Assigned', value: ASSIGN_LABEL[task.assigned_to] },
              task.due_date ? { label: 'Due', value: new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) } : null,
              task.completed_date ? { label: 'Completed', value: new Date(task.completed_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) } : null,
              task.completed_by ? { label: 'Completed by', value: task.completed_by } : null,
              task.responsible_party ? { label: 'Responsible', value: task.responsible_party } : null,
              task.important_contacts ? { label: 'Contacts', value: task.important_contacts } : null,
            ].filter(Boolean).map(item => (
              <div key={item!.label} className="rounded-xl p-3" style={{ backgroundColor: '#f0f4f0' }}>
                <p className="text-xs mb-0.5" style={{ color: '#9db89f' }}>{item!.label}</p>
                <p className="text-sm font-medium" style={{ color: '#2d4a30' }}>{item!.value}</p>
              </div>
            ))}
          </div>

          {task.status === 'blocked' && task.blocked_by && (
            <div className="rounded-xl p-3" style={{ backgroundColor: '#f0e8ec' }}>
              <p className="text-xs mb-0.5" style={{ color: '#c0607a' }}>Blocked by</p>
              <p className="text-sm font-medium" style={{ color: '#c0607a' }}>{task.blocked_by}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => onPatch({ status: STATUS_NEXT[task.status] })}
              className="flex-1 text-sm font-medium rounded-xl"
              style={{ backgroundColor: '#e8f0e8', color: '#5a7d5e', minHeight: 44 }}>
              → {STATUS_LABEL[STATUS_NEXT[task.status]]}
            </button>
            <button
              onClick={onEdit}
              className="flex-1 text-sm font-medium rounded-xl text-white"
              style={{ backgroundColor: '#7a9e7e', minHeight: 44 }}>
              Edit
            </button>
            <button
              onClick={() => { if (confirm('Delete this task?')) { onDelete() } }}
              className="text-sm font-medium rounded-xl px-4"
              style={{ backgroundColor: '#fdecea', color: '#c0607a', minHeight: 44 }}>
              Del
            </button>
          </div>

          {/* Comments */}
          <div style={{ borderTop: '1px solid #d8e8d8' }} className="pt-4 space-y-3">
            <p className="text-sm font-semibold" style={{ color: '#2d4a30' }}>
              Comments {(task.task_comments?.length ?? 0) > 0 && `(${task.task_comments.length})`}
            </p>
            {(task.task_comments ?? []).length === 0 && (
              <p className="text-sm" style={{ color: '#b8d0ba' }}>No comments yet.</p>
            )}
            <div className="space-y-2">
              {(task.task_comments ?? []).map((c: TaskComment, i: number) => (
                <div key={i} className="rounded-xl px-3 py-2.5" style={{ backgroundColor: '#f0f4f0' }}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold" style={{ color: '#5a7d5e' }}>{c.name}</span>
                    <span className="text-xs" style={{ color: '#b8d0ba' }}>
                      {new Date(c.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: '#2d4a30' }}>{c.text}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={commentText} onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="Add a comment..."
                className="flex-1 rounded-xl px-4 py-3 focus:outline-none"
                style={{ border: '1px solid #b8d0ba', color: '#2d4a30' }} />
              <button onClick={submitComment} disabled={!commentText.trim() || saving}
                className="px-4 text-white rounded-xl font-medium"
                style={{ backgroundColor: '#7a9e7e', opacity: !commentText.trim() || saving ? 0.5 : 1, minHeight: 52 }}>
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

type TaskFormData = {
  title: string; description: string; category: string; assigned_to: string
  priority: string; due_date: string; status: string
  blocked_by: string; responsible_party: string; important_contacts: string
}

function TaskModal({ task, onClose, onSave, onAddComment }: {
  task?: Task
  onClose: () => void
  onSave: (data: TaskFormData) => Promise<void>
  onAddComment?: (text: string) => Promise<void>
}) {
  const [form, setForm] = useState<TaskFormData>({
    title: task?.title ?? '',
    description: task?.description ?? '',
    category: task?.category ?? '',
    assigned_to: task?.assigned_to ?? 'both',
    priority: task?.priority ?? 'medium',
    due_date: task?.due_date?.slice(0, 10) ?? '',
    status: task?.status ?? 'pending',
    blocked_by: task?.blocked_by ?? '',
    responsible_party: task?.responsible_party ?? '',
    important_contacts: task?.important_contacts ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [addingComment, setAddingComment] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  async function submitComment() {
    if (!commentText.trim() || !onAddComment) return
    setAddingComment(true)
    await onAddComment(commentText.trim())
    setCommentText('')
    setAddingComment(false)
  }

  const inputStyle = { border: '1px solid #b8d0ba', color: '#2d4a30' }
  const labelStyle = { color: '#9db89f' }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sticky top-0 bg-white rounded-t-2xl z-10" style={{ borderBottom: '1px solid #d8e8d8' }}>
          <h2 className="font-semibold text-base" style={{ color: '#2d4a30' }}>{task ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-xl rounded-full" style={{ color: '#9db89f', backgroundColor: '#f0f4f0' }}>×</button>
        </div>

        <form onSubmit={submit} className="p-4 space-y-3">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Task title" required
            className="w-full rounded-xl px-4 py-3 focus:outline-none" style={inputStyle} />

          <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
            placeholder="Category (e.g. Flowers, DJ, Venue)"
            className="w-full rounded-xl px-4 py-3 focus:outline-none" style={inputStyle} />

          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optional)" rows={2}
            className="w-full rounded-xl px-4 py-3 focus:outline-none resize-none" style={inputStyle} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm mb-1 block" style={labelStyle}>Assign to</label>
              <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                className="w-full rounded-xl px-3 py-3 focus:outline-none" style={inputStyle}>
                <option value="both">Both</option>
                <option value="nick">Nick</option>
                <option value="siobhan">Siobhan</option>
                <option value="taylor">Taylor</option>
                <option value="dad">Dad</option>
              </select>
            </div>
            <div>
              <label className="text-sm mb-1 block" style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-xl px-3 py-3 focus:outline-none" style={inputStyle}>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>

          {form.status === 'blocked' && (
            <input value={form.blocked_by} onChange={e => setForm({ ...form, blocked_by: e.target.value })}
              placeholder="Blocked by..."
              className="w-full rounded-xl px-4 py-3 focus:outline-none" style={inputStyle} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm mb-1 block" style={labelStyle}>Priority</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-xl px-3 py-3 focus:outline-none" style={inputStyle}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-sm mb-1 block" style={labelStyle}>Due date</label>
              <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                className="w-full rounded-xl px-3 py-3 focus:outline-none" style={inputStyle} />
            </div>
          </div>

          <div>
            <label className="text-sm mb-1 block" style={labelStyle}>Responsible party</label>
            <input value={form.responsible_party} onChange={e => setForm({ ...form, responsible_party: e.target.value })}
              placeholder="e.g. Siobhan and Mom"
              className="w-full rounded-xl px-4 py-3 focus:outline-none" style={inputStyle} />
          </div>

          <div>
            <label className="text-sm mb-1 block" style={labelStyle}>Important contacts</label>
            <input value={form.important_contacts} onChange={e => setForm({ ...form, important_contacts: e.target.value })}
              placeholder="Names / numbers"
              className="w-full rounded-xl px-4 py-3 focus:outline-none" style={inputStyle} />
          </div>

          <button type="submit" disabled={saving}
            className="w-full font-medium rounded-xl text-white"
            style={{ backgroundColor: '#d4849a', opacity: saving ? 0.6 : 1, minHeight: 52 }}>
            {saving ? 'Saving...' : task ? 'Save Changes' : 'Create Task'}
          </button>
        </form>

        {task && (
          <div className="px-4 pb-4 space-y-2" style={{ borderTop: '1px solid #d8e8d8' }}>
            <p className="text-sm font-semibold pt-3" style={{ color: '#2d4a30' }}>Comments</p>
            {(task.task_comments ?? []).length === 0 && (
              <p className="text-sm" style={{ color: '#b8d0ba' }}>No comments yet.</p>
            )}
            {(task.task_comments ?? []).map((c: TaskComment, i: number) => (
              <div key={i} className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: '#f0f4f0' }}>
                <span className="font-medium" style={{ color: '#5a7d5e' }}>{c.name}</span>
                <span className="ml-2 text-xs" style={{ color: '#9db89f' }}>
                  {new Date(c.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <p className="mt-0.5" style={{ color: '#2d4a30' }}>{c.text}</p>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <input value={commentText} onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="Add a comment..."
                className="flex-1 rounded-xl px-4 py-3 focus:outline-none"
                style={{ border: '1px solid #b8d0ba', color: '#2d4a30' }} />
              <button onClick={submitComment} disabled={!commentText.trim() || addingComment}
                className="px-4 text-white rounded-xl font-medium"
                style={{ backgroundColor: '#7a9e7e', opacity: !commentText.trim() || addingComment ? 0.5 : 1, minHeight: 52 }}>
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsModal({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #d8e8d8' }}>
          <h2 className="font-semibold" style={{ color: '#2d4a30' }}>Account</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-xl"
            style={{ backgroundColor: '#f0f4f0', color: '#9db89f' }}>×</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: '#2d4a30' }}>Push Notifications</p>
            <PushManagerInline />
          </div>
          <div style={{ borderTop: '1px solid #d8e8d8' }} className="pt-4">
            <button onClick={onLogout}
              className="w-full text-sm font-medium rounded-xl"
              style={{ backgroundColor: '#f0e8ec', color: '#c0607a', minHeight: 44 }}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NotifyModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ to: 'siobhan', title: '', body: '' })
  const [status, setStatus] = useState('')

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setStatus('Sending...')
    const res = await fetch('/api/push/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, badge_count: 1 }),
    })
    const data = await res.json()
    setStatus(res.ok ? `Sent to ${data.sent} device(s)!` : data.error)
  }

  const inputStyle = { border: '1px solid #b8d0ba', color: '#2d4a30' }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #d8e8d8' }}>
          <h2 className="font-semibold text-base" style={{ color: '#2d4a30' }}>Send Notification</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-xl rounded-full" style={{ color: '#9db89f', backgroundColor: '#f0f4f0' }}>×</button>
        </div>
        <form onSubmit={send} className="p-4 space-y-3">
          <div>
            <label className="text-sm mb-1 block" style={{ color: '#9db89f' }}>Send to</label>
            <select value={form.to} onChange={e => setForm({ ...form, to: e.target.value })}
              className="w-full rounded-xl px-3 py-3 focus:outline-none" style={inputStyle}>
              <option value="siobhan">Siobhan</option>
              <option value="nick">Nick</option>
              <option value="all">Both</option>
            </select>
          </div>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Notification title" required
            className="w-full rounded-xl px-4 py-3 focus:outline-none" style={inputStyle} />
          <input value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
            placeholder="Message (optional)"
            className="w-full rounded-xl px-4 py-3 focus:outline-none" style={inputStyle} />
          {status && <p className="text-sm text-center" style={{ color: '#7a9e7e' }}>{status}</p>}
          <button type="submit" className="w-full font-medium rounded-xl text-white" style={{ backgroundColor: '#d4849a', minHeight: 52 }}>
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

const QUICK_MESSAGES = [
  { label: '👀 Check your tasks', title: 'Hey!', body: 'Can you take a look at your wedding tasks when you get a chance?' },
  { label: '🌸 Quick reminder', title: 'Wedding reminder 💍', body: "Just a reminder to check in on the wedding planner today!" },
  { label: '🔥 Needs attention', title: 'Something needs attention', body: 'There are a few things on your list that need to be sorted soon!' },
  { label: '✅ We made progress!', title: 'Wedding update 🎉', body: 'Made some good progress today — check the planner for updates!' },
  { label: '❓ Question for you', title: 'Quick question', body: '' },
  { label: '📅 Date to check', title: 'Check the calendar', body: 'Take a look at the calendar — something important coming up!' },
]

function NotifyTab() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [flash, setFlash] = useState('')

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSending(true)
    setFlash('')
    const res = await fetch('/api/push/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'siobhan', title: title.trim(), body: body.trim(), url: '/her-dashboard', badge_count: 1 }),
    })
    const data = await res.json()
    if (res.ok) {
      setFlash('Sent!')
      setTitle('')
      setBody('')
    } else {
      setFlash(data.error ?? 'Failed to send')
    }
    setSending(false)
  }

  function applyQuick(q: typeof QUICK_MESSAGES[0]) {
    setTitle(q.title)
    setBody(q.body)
    setFlash('')
  }

  const inputStyle: React.CSSProperties = {
    border: '1px solid #d8e8d8',
    color: '#2d4a30',
    backgroundColor: '#f5f7f5',
    width: '100%',
    borderRadius: 16,
    padding: '12px 16px',
    fontSize: 14,
    outline: 'none',
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: '#fce8ef', border: '1px solid #f0b8c8' }}>
        <p className="font-semibold text-sm" style={{ color: '#c0607a' }}>Send to Siobhan 💍</p>
        <p className="text-xs mt-0.5" style={{ color: '#d4849a' }}>She'll get a push notification on her phone</p>
      </div>

      {/* Quick messages */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9db89f' }}>Quick send</p>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_MESSAGES.map(q => (
            <button
              key={q.label}
              onClick={() => applyQuick(q)}
              className="text-left rounded-2xl px-3 py-2.5 text-xs font-medium"
              style={{ backgroundColor: '#f0f4f0', color: '#2d4a30', border: '1px solid #e4ede4' }}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Compose */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9db89f' }}>Compose</p>
        <form onSubmit={send} className="space-y-2">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title"
            required
            style={inputStyle}
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Message (optional)"
            rows={3}
            style={{ ...inputStyle, resize: 'none' }}
          />
          {flash && (
            <p className="text-sm text-center font-medium" style={{ color: flash === 'Sent!' ? '#2d6a30' : '#c0607a' }}>
              {flash === 'Sent!' ? '✓ Notification sent!' : flash}
            </p>
          )}
          <button
            type="submit"
            disabled={sending || !title.trim()}
            className="w-full font-semibold rounded-2xl text-white"
            style={{ backgroundColor: '#d4849a', opacity: sending || !title.trim() ? 0.5 : 1, minHeight: 52 }}
          >
            {sending ? 'Sending...' : 'Send to Siobhan'}
          </button>
        </form>
      </div>
    </div>
  )
}
