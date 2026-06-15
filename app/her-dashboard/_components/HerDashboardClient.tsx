'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Task, Event, TaskComment } from '@/lib/db'
import type { SessionUser } from '@/lib/session'
import Calendar from '@/components/Calendar'
import PushManagerInline from '@/components/PushManagerInline'

const STATUS_BAR: Record<string, string> = {
  done:        '#7a9e7e',
  in_progress: '#e6c84a',
  pending:     '#d4849a',
  blocked:     '#c0607a',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:     { bg: '#fce8ef', color: '#c0607a' },
  in_progress: { bg: '#fef9e7', color: '#a07800' },
  done:        { bg: '#e8f4e8', color: '#2d6a30' },
  blocked:     { bg: '#f0e8ec', color: '#c0607a' },
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'To Do', in_progress: 'In Progress', done: 'Done', blocked: 'Blocked',
}

type Tab = 'tasks' | 'calendar'

export default function HerDashboardClient({
  user,
  initialTop5,
  initialEvents,
}: {
  user: SessionUser
  initialTop5: Task[]
  initialEvents: Event[]
}) {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>(initialTop5)
  const [events, setEvents] = useState<Event[]>(initialEvents)
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f7f5' }}>

      {/* Header */}
      <header className="bg-white sticky top-0 z-10" style={{ borderBottom: '1px solid #e4ede4' }}>
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide uppercase" style={{ color: '#b8d0ba', letterSpacing: '0.08em' }}>
              Wedding Planner
            </p>
            <p className="text-lg font-semibold leading-tight mt-0.5" style={{ color: '#2d4a30' }}>
              Hi {user.name}!
            </p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-base shrink-0 shadow-sm active:scale-95 transition-transform"
            style={{ backgroundColor: '#d4849a' }}
          >
            {user.name.charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-5 space-y-4 pb-28">

        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl p-1" style={{ backgroundColor: '#e4ede4' }}>
          {(['tasks', 'calendar'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 text-sm font-semibold rounded-xl transition-all"
              style={{
                backgroundColor: tab === t ? '#fff' : 'transparent',
                color: tab === t ? '#2d4a30' : '#9db89f',
                minHeight: 44,
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              {t === 'tasks' ? 'My Tasks' : 'Calendar'}
            </button>
          ))}
        </div>

        {tab === 'tasks' && (
          <>
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-2">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: '#e8f4e8' }}>
                  ✓
                </div>
                <p className="font-semibold text-base" style={{ color: '#2d4a30' }}>All caught up!</p>
                <p className="text-sm text-center" style={{ color: '#b8d0ba' }}>No tasks right now. Enjoy the moment.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => (
                  <HerTaskCard
                    key={task.id}
                    task={task}
                    onDetail={() => setDetailTask(task)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'calendar' && (
          <Calendar tasks={[]} events={events} onAddEvent={addEvent} onDeleteEvent={deleteEvent} />
        )}
      </div>

      {/* FAB — Add Task */}
      {tab === 'tasks' && (
        <button
          onClick={() => setShowAdd(true)}
          className="fixed bottom-8 right-5 w-11 h-11 rounded-full text-white text-xl flex items-center justify-center shadow-lg active:scale-95 transition-transform z-10"
          style={{ backgroundColor: '#d4849a', boxShadow: '0 4px 16px rgba(212,132,154,0.4)' }}
        >
          +
        </button>
      )}

      {/* Task detail sheet */}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onMarkDone={() => setStatus(detailTask, 'done')}
          onAddComment={text => addComment(detailTask.id, text)}
        />
      )}

      {/* Settings sheet */}
      {showSettings && (
        <BottomSheet onClose={() => setShowSettings(false)}>
          <div className="px-5 pb-6 space-y-5">
            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: '#2d4a30' }}>Push Notifications</p>
              <PushManagerInline />
            </div>
            <button onClick={logout}
              className="w-full text-sm font-semibold rounded-2xl"
              style={{ backgroundColor: '#fce8ef', color: '#c0607a', minHeight: 52 }}>
              Logout
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Add task sheet */}
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

function BottomSheet({ children, onClose, title }: {
  children: React.ReactNode
  onClose: () => void
  title?: string
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Handle */}
        <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: '#d8e8d8' }} />
        </div>
        {title && (
          <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid #e4ede4' }}>
            <p className="font-semibold text-base" style={{ color: '#2d4a30' }}>{title}</p>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-xl"
              style={{ backgroundColor: '#f5f7f5', color: '#9db89f' }}>×</button>
          </div>
        )}
        <div className="overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

function HerTaskCard({ task, onDetail }: {
  task: Task
  onDetail: () => void
}) {
  const isDone = task.status === 'done'

  return (
    <div
      className="relative bg-white rounded-2xl overflow-hidden active:scale-[0.98] transition-transform"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e4ede4' }}
    >
      <div className="absolute right-0 top-0 bottom-0 w-[5px]" style={{ backgroundColor: STATUS_BAR[task.status] ?? '#d8e8d8' }} />
      <button type="button" onClick={onDetail} className="absolute inset-0 w-full h-full z-0" />
      <div className="relative flex items-center px-5 pr-6 py-5 pointer-events-none">
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-[17px] leading-snug ${isDone ? 'line-through' : ''}`}
            style={{ color: isDone ? '#b8d0ba' : '#2d4a30' }}>
            {task.title}
          </p>
          {task.due_date && (
            <p className="text-sm mt-1" style={{ color: '#b8d0ba' }}>
              Due {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function TaskDetailModal({ task, onClose, onMarkDone, onAddComment }: {
  task: Task
  onClose: () => void
  onMarkDone: () => void
  onAddComment: (text: string) => Promise<void>
}) {
  const [commentText, setCommentText] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDone, setConfirmDone] = useState(false)
  const isDone = task.status === 'done'
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
      className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {/* Handle */}
        <div className="flex items-center justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: '#d8e8d8' }} />
        </div>

        {/* Status + close */}
        <div className="flex items-center justify-between px-5 pb-4 shrink-0">
          <span className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: st.bg, color: st.color }}>
            {STATUS_LABEL[task.status]}
          </span>
          <button onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-xl"
            style={{ backgroundColor: '#f5f7f5', color: '#9db89f' }}>×</button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 space-y-5 pb-6">

          {/* Title */}
          <h2 className={`text-xl font-bold leading-snug ${isDone ? 'line-through' : ''}`}
            style={{ color: isDone ? '#b8d0ba' : '#2d4a30' }}>
            {task.title}
          </h2>

          {task.description && (
            <p className="text-base leading-relaxed" style={{ color: '#5a7d5e' }}>{task.description}</p>
          )}

          {/* Meta chips */}
          {(task.due_date || task.completed_date || task.responsible_party || task.important_contacts) && (
            <div className="grid grid-cols-2 gap-2.5">
              {task.due_date && (
                <div className="rounded-2xl p-4" style={{ backgroundColor: '#f5f7f5' }}>
                  <p className="text-xs font-medium mb-1" style={{ color: '#9db89f' }}>Due date</p>
                  <p className="text-sm font-semibold" style={{ color: '#2d4a30' }}>
                    {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  </p>
                </div>
              )}
              {task.completed_date && (
                <div className="rounded-2xl p-4" style={{ backgroundColor: '#e8f4e8' }}>
                  <p className="text-xs font-medium mb-1" style={{ color: '#9db89f' }}>Completed</p>
                  <p className="text-sm font-semibold" style={{ color: '#2d6a30' }}>
                    {new Date(task.completed_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  </p>
                </div>
              )}
              {task.responsible_party && (
                <div className="rounded-2xl p-4" style={{ backgroundColor: '#f5f7f5' }}>
                  <p className="text-xs font-medium mb-1" style={{ color: '#9db89f' }}>Responsible</p>
                  <p className="text-sm font-semibold" style={{ color: '#2d4a30' }}>{task.responsible_party}</p>
                </div>
              )}
              {task.important_contacts && (
                <div className="rounded-2xl p-4" style={{ backgroundColor: '#f5f7f5' }}>
                  <p className="text-xs font-medium mb-1" style={{ color: '#9db89f' }}>Contacts</p>
                  <p className="text-sm font-semibold" style={{ color: '#2d4a30' }}>{task.important_contacts}</p>
                </div>
              )}
            </div>
          )}

          {task.status === 'blocked' && task.blocked_by && (
            <div className="rounded-2xl p-4" style={{ backgroundColor: '#fce8ef' }}>
              <p className="text-xs font-medium mb-1" style={{ color: '#c0607a' }}>Blocked by</p>
              <p className="text-sm font-semibold" style={{ color: '#c0607a' }}>{task.blocked_by}</p>
            </div>
          )}

          {/* Mark done — two-step confirm */}
          {!isDone && (
            confirmDone ? (
              <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: '#fce8ef', border: '1px solid #f0b8c8' }}>
                <p className="text-base font-semibold text-center" style={{ color: '#2d4a30' }}>
                  Are you sure this is complete?
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmDone(false)}
                    className="flex-1 font-semibold rounded-2xl text-sm"
                    style={{ backgroundColor: '#fff', color: '#9db89f', minHeight: 52, border: '1px solid #e4ede4' }}>
                    Not yet
                  </button>
                  <button onClick={() => { onMarkDone(); onClose() }}
                    className="flex-1 font-semibold rounded-2xl text-sm text-white"
                    style={{ backgroundColor: '#7a9e7e', minHeight: 52 }}>
                    Yes, done! ✓
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDone(true)}
                className="w-full font-semibold rounded-2xl text-white"
                style={{ backgroundColor: '#d4849a', minHeight: 56 }}>
                Mark as Done
              </button>
            )
          )}

          {/* Comments */}
          <div style={{ borderTop: '1px solid #e4ede4' }} className="pt-5 space-y-3">
            <p className="text-sm font-semibold" style={{ color: '#2d4a30' }}>
              Notes {(task.task_comments?.length ?? 0) > 0 && `· ${task.task_comments.length}`}
            </p>

            {(task.task_comments ?? []).length === 0 && (
              <p className="text-sm" style={{ color: '#b8d0ba' }}>No notes yet.</p>
            )}

            <div className="space-y-2">
              {(task.task_comments ?? []).map((c: TaskComment, i: number) => (
                <div key={i} className="rounded-2xl px-4 py-3" style={{ backgroundColor: '#f5f7f5' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold" style={{ color: '#5a7d5e' }}>{c.name}</span>
                    <span className="text-xs" style={{ color: '#b8d0ba' }}>
                      {new Date(c.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#2d4a30' }}>{c.text}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="Add a note..."
                className="flex-1 rounded-2xl px-4 py-3 text-sm focus:outline-none"
                style={{ border: '1px solid #d8e8d8', color: '#2d4a30', backgroundColor: '#f5f7f5' }}
              />
              <button onClick={submitComment} disabled={!commentText.trim() || saving}
                className="px-5 text-white rounded-2xl font-semibold text-sm"
                style={{ backgroundColor: '#7a9e7e', opacity: !commentText.trim() || saving ? 0.4 : 1, minHeight: 52 }}>
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

  return (
    <BottomSheet onClose={onClose} title="New Task">
      <form onSubmit={submit} className="px-5 pt-4 pb-6 space-y-3">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          required
          autoFocus
          className="w-full rounded-2xl px-4 py-4 text-base focus:outline-none"
          style={{ border: '1px solid #d8e8d8', color: '#2d4a30', backgroundColor: '#f5f7f5' }}
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Any details? (optional)"
          rows={3}
          className="w-full rounded-2xl px-4 py-4 text-base focus:outline-none resize-none"
          style={{ border: '1px solid #d8e8d8', color: '#2d4a30', backgroundColor: '#f5f7f5' }}
        />
        <p className="text-xs px-1" style={{ color: '#b8d0ba' }}>
          Nick will set the priority when he reviews it.
        </p>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="w-full font-semibold rounded-2xl text-white"
          style={{ backgroundColor: '#d4849a', opacity: saving || !title.trim() ? 0.5 : 1, minHeight: 56 }}
        >
          {saving ? 'Adding...' : 'Add Task'}
        </button>
      </form>
    </BottomSheet>
  )
}
