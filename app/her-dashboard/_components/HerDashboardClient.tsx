'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Task, Event, TaskComment } from '@/lib/db'
import type { SessionUser } from '@/lib/session'
import Calendar from '@/components/Calendar'
import PushManagerInline from '@/components/PushManagerInline'

const PRIORITY_DOT: Record<string, string> = {
  high: '#c0607a',
  medium: '#d4849a',
  low: '#7a9e7e',
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

type Tab = 'tasks' | 'calendar'

export default function HerDashboardClient({
  user,
  initialTop5,
  totalAssigned,
  totalDone,
  initialEvents,
}: {
  user: SessionUser
  initialTop5: Task[]
  totalAssigned: number
  totalDone: number
  initialEvents: Event[]
}) {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>(initialTop5)
  const [events, setEvents] = useState<Event[]>(initialEvents)
  const [done, setDone] = useState(totalDone)
  const [total] = useState(totalAssigned)
  const [tab, setTab] = useState<Tab>('tasks')
  const [showAdd, setShowAdd] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  async function refreshList() {
    const listRes = await fetch('/api/tasks')
    if (listRes.ok) {
      const next = await listRes.json() as Task[]
      setTasks(next)
      setDone(parseInt(listRes.headers.get('x-done') ?? '0'))
      return next
    }
    return tasks
  }

  async function setStatus(task: Task, status: string) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return
    const next = await refreshList()
    if (detailTask?.id === task.id) {
      setDetailTask(next.find(t => t.id === task.id) ?? null)
    }
  }

  async function addComment(taskId: number, text: string) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ add_comment: text }),
    })
    if (res.ok) {
      const updated = await res.json() as Task
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t))
      if (detailTask?.id === taskId) setDetailTask(updated)
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

  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f0' }}>
      <header className="bg-white sticky top-0 z-10" style={{ borderBottom: '1px solid #b8d0ba' }}>
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm leading-tight" style={{ color: '#2d4a30' }}>Wedding Planner</div>
            <div className="text-xs" style={{ color: '#9db89f' }}>Hey {user.name}!</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={logout} className="text-sm px-4 rounded-xl font-medium hidden sm:block"
              style={{ backgroundColor: '#f0e8ec', color: '#c0607a', minHeight: 44 }}>
              Logout
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-base shrink-0 shadow-sm"
              style={{ backgroundColor: '#d4849a' }}
              title="Account settings"
            >
              {user.name.charAt(0).toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
        {/* Progress */}
        <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: '1px solid #d8e8d8' }}>
          <div className="flex justify-between text-xs mb-2" style={{ color: '#9db89f' }}>
            <span>Progress</span>
            <span>{done} of {total} done ({pct}%)</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#d8e8d8' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: '#d4849a' }} />
          </div>
          {total > 0 && done === total && (
            <p className="text-center text-xs mt-2 font-medium" style={{ color: '#7a9e7e' }}>All done! You&apos;re amazing!</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: '#d8e8d8' }}>
          {(['tasks', 'calendar'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 text-sm font-medium rounded-lg capitalize"
              style={{ backgroundColor: tab === t ? '#fff' : 'transparent', color: tab === t ? '#2d4a30' : '#7a9e7e', minHeight: 44 }}>
              {t === 'tasks' ? 'My Tasks' : 'Calendar'}
            </button>
          ))}
        </div>

        {tab === 'tasks' && (
          <>
            {tasks.length === 0 && (
              <div className="text-center py-12 text-sm" style={{ color: '#b8d0ba' }}>
                No tasks right now — you&apos;re all caught up!
              </div>
            )}

            <div className="space-y-3">
              {tasks.map(task => (
                <HerTaskCard
                  key={task.id}
                  task={task}
                  onMarkDone={() => setStatus(task, 'done')}
                  onStart={() => setStatus(task, 'in_progress')}
                  onDetail={() => setDetailTask(task)}
                />
              ))}
            </div>

            <button onClick={() => setShowAdd(true)}
              className="w-full font-medium rounded-xl text-white"
              style={{ backgroundColor: '#d4849a', minHeight: 52 }}>
              + Add Task
            </button>
          </>
        )}

        {tab === 'calendar' && (
          <Calendar tasks={[]} events={events} onAddEvent={addEvent} onDeleteEvent={deleteEvent} />
        )}
      </div>

      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onStart={() => setStatus(detailTask, 'in_progress')}
          onMarkDone={() => setStatus(detailTask, 'done')}
          onAddComment={text => addComment(detailTask.id, text)}
        />
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #d8e8d8' }}>
              <h2 className="font-semibold" style={{ color: '#2d4a30' }}>Account</h2>
              <button onClick={() => setShowSettings(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-xl"
                style={{ backgroundColor: '#f0f4f0', color: '#9db89f' }}>×</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: '#2d4a30' }}>Push Notifications</p>
                <PushManagerInline />
              </div>
              <div style={{ borderTop: '1px solid #d8e8d8' }} className="pt-4">
                <button onClick={logout}
                  className="w-full text-sm font-medium rounded-xl"
                  style={{ backgroundColor: '#f0e8ec', color: '#c0607a', minHeight: 44 }}>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <AddTaskModal onClose={() => setShowAdd(false)} onSave={async ({ title, description }) => {
          const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description }),
          })
          if (res.ok) setShowAdd(false)
        }} />
      )}
    </div>
  )
}

function HerTaskCard({ task, onMarkDone, onStart, onDetail }: {
  task: Task
  onMarkDone: () => void
  onStart: () => void
  onDetail: () => void
}) {
  const isDone = task.status === 'done'
  const isActive = task.status === 'in_progress'

  return (
    // Outer button = reliable tap target on all platforms
    <button
      type="button"
      onClick={onDetail}
      className="w-full text-left bg-white rounded-2xl shadow-sm block"
      style={{ border: `1px solid ${isActive ? '#b8d0ba' : '#d8e8d8'}` }}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Checkbox — div with role so it can stop propagation without nesting buttons */}
        <div
          role="checkbox"
          aria-checked={isDone}
          tabIndex={0}
          onClick={e => { e.stopPropagation(); onMarkDone() }}
          onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onMarkDone())}
          className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
          style={{ backgroundColor: isDone ? '#d4849a' : 'transparent', borderColor: isDone ? '#d4849a' : '#b8d0ba', color: '#fff', minWidth: 32 }}
        >
          {isDone && <span className="text-xs leading-none">✓</span>}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_DOT[task.priority] }} />
            {isActive && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#e8f0e8', color: '#5a7d5e' }}>
                In Progress
              </span>
            )}
            {task.status === 'blocked' && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#f0e8ec', color: '#c0607a' }}>
                Blocked
              </span>
            )}
          </div>

          <h3 className={`font-medium text-sm leading-snug ${isDone ? 'line-through' : ''}`} style={{ color: '#2d4a30' }}>
            {task.title}
          </h3>

          {task.description && (
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#9db89f' }}>{task.description}</p>
          )}

          {task.due_date && (
            <p className="text-xs mt-1" style={{ color: '#b8d0ba' }}>
              Due {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>

        {/* Start — div with role so it can stop propagation */}
        {!isDone && !isActive && (
          <div
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onStart() }}
            onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onStart())}
            className="text-sm px-3 rounded-xl font-medium shrink-0 flex items-center"
            style={{ backgroundColor: '#e8f0e8', color: '#5a7d5e', minHeight: 44 }}
          >
            Start
          </div>
        )}
      </div>
    </button>
  )
}

function TaskDetailModal({ task, onClose, onStart, onMarkDone, onAddComment }: {
  task: Task
  onClose: () => void
  onStart: () => void
  onMarkDone: () => void
  onAddComment: (text: string) => Promise<void>
}) {
  const [commentText, setCommentText] = useState('')
  const [saving, setSaving] = useState(false)
  const isDone = task.status === 'done'
  const isActive = task.status === 'in_progress'
  const st = STATUS_STYLE[task.status] ?? STATUS_STYLE.pending

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
        <div className="flex items-center justify-between p-4 sticky top-0 bg-white rounded-t-2xl z-10"
          style={{ borderBottom: '1px solid #d8e8d8' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: st.bg, color: st.color }}>
              {STATUS_LABEL[task.status]}
            </span>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-xl rounded-full shrink-0"
            style={{ color: '#9db89f', backgroundColor: '#f0f4f0' }}>×</button>
        </div>

        <div className="p-4 space-y-4 modal-bottom">
          {/* Title */}
          <h2 className={`text-lg font-semibold leading-snug ${isDone ? 'line-through' : ''}`} style={{ color: '#2d4a30' }}>
            {task.title}
          </h2>

          {/* Description */}
          {task.description && (
            <p className="text-sm leading-relaxed" style={{ color: '#5a7d5e' }}>{task.description}</p>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {task.due_date && (
              <div className="rounded-xl p-3" style={{ backgroundColor: '#f0f4f0' }}>
                <p className="text-xs mb-0.5" style={{ color: '#9db89f' }}>Due date</p>
                <p className="text-sm font-medium" style={{ color: '#2d4a30' }}>
                  {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </p>
              </div>
            )}
            {task.completed_date && (
              <div className="rounded-xl p-3" style={{ backgroundColor: '#e8f4e8' }}>
                <p className="text-xs mb-0.5" style={{ color: '#9db89f' }}>Completed</p>
                <p className="text-sm font-medium" style={{ color: '#2d6a30' }}>
                  {new Date(task.completed_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </p>
              </div>
            )}
            {task.responsible_party && (
              <div className="rounded-xl p-3" style={{ backgroundColor: '#f0f4f0' }}>
                <p className="text-xs mb-0.5" style={{ color: '#9db89f' }}>Responsible</p>
                <p className="text-sm font-medium" style={{ color: '#2d4a30' }}>{task.responsible_party}</p>
              </div>
            )}
            {task.important_contacts && (
              <div className="rounded-xl p-3" style={{ backgroundColor: '#f0f4f0' }}>
                <p className="text-xs mb-0.5" style={{ color: '#9db89f' }}>Contacts</p>
                <p className="text-sm font-medium" style={{ color: '#2d4a30' }}>{task.important_contacts}</p>
              </div>
            )}
          </div>

          {/* Blocked by */}
          {task.status === 'blocked' && task.blocked_by && (
            <div className="rounded-xl p-3" style={{ backgroundColor: '#f0e8ec' }}>
              <p className="text-xs mb-0.5" style={{ color: '#c0607a' }}>Blocked by</p>
              <p className="text-sm font-medium" style={{ color: '#c0607a' }}>{task.blocked_by}</p>
            </div>
          )}

          {/* Action buttons */}
          {!isDone && (
            <div className="flex gap-2">
              {!isActive && (
                <button onClick={() => { onStart(); onClose() }}
                  className="flex-1 font-medium rounded-xl text-sm"
                  style={{ backgroundColor: '#e8f0e8', color: '#5a7d5e', minHeight: 48 }}>
                  Mark In Progress
                </button>
              )}
              <button onClick={() => { onMarkDone(); onClose() }}
                className="flex-1 font-medium rounded-xl text-sm text-white"
                style={{ backgroundColor: '#d4849a', minHeight: 48 }}>
                Mark Done
              </button>
            </div>
          )}

          {/* Comments */}
          <div style={{ borderTop: '1px solid #d8e8d8' }} className="pt-4 space-y-3">
            <p className="text-sm font-semibold" style={{ color: '#2d4a30' }}>
              Notes & Comments {(task.task_comments?.length ?? 0) > 0 && `(${task.task_comments.length})`}
            </p>

            {(task.task_comments ?? []).length === 0 && (
              <p className="text-sm" style={{ color: '#b8d0ba' }}>No notes yet.</p>
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
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="Add a note..."
                className="flex-1 rounded-xl px-4 py-3 focus:outline-none"
                style={{ border: '1px solid #b8d0ba', color: '#2d4a30' }}
              />
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

function AddTaskModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (data: { title: string; description: string }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave({ title, description })
    setSaving(false)
  }

  const inputStyle = { border: '1px solid #b8d0ba', color: '#2d4a30' }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl modal-bottom">
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #d8e8d8' }}>
          <h2 className="font-semibold" style={{ color: '#2d4a30' }}>Add Task</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-xl rounded-full"
            style={{ color: '#9db89f', backgroundColor: '#f0f4f0' }}>×</button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="What needs to be done?" required
            className="w-full rounded-xl px-4 py-3 focus:outline-none" style={inputStyle} />
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Any notes? (optional)" rows={2}
            className="w-full rounded-xl px-4 py-3 focus:outline-none resize-none" style={inputStyle} />
          <p className="text-xs" style={{ color: '#9db89f' }}>
            Nick will assign the priority when he sees it.
          </p>
          <button type="submit" disabled={saving}
            className="w-full font-medium rounded-xl text-white"
            style={{ backgroundColor: '#d4849a', opacity: saving ? 0.6 : 1, minHeight: 52 }}>
            {saving ? 'Adding...' : 'Add Task'}
          </button>
        </form>
      </div>
    </div>
  )
}
