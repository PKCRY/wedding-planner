'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked'

interface SharedTask {
  id: number
  title: string
  description: string
  category: string
  assigned_to: string
  status: TaskStatus
  priority: string
  due_date: string | null
  responsible_party: string
  important_contacts: string
  task_comments: { user: string; name: string; text: string; at: string }[]
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
  blocked: 'Blocked',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:     { bg: '#f0f4f0', color: '#7a9e7e' },
  in_progress: { bg: '#fff8e6', color: '#b08020' },
  done:        { bg: '#e8f4e8', color: '#3a7a3a' },
  blocked:     { bg: '#fdecea', color: '#c0607a' },
}

export default function SharedTaskPage() {
  const { token } = useParams<{ token: string }>()

  const [task, setTask] = useState<SharedTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)

  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | ''>('')
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    fetch(`/api/task-share/${token}`)
      .then(r => {
        if (!r.ok) { setInvalid(true); return null }
        return r.json()
      })
      .then(data => { if (data) setTask(data) })
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStatus && !comment.trim()) return
    setSubmitting(true)
    setSubmitError('')
    const res = await fetch(`/api/task-share/${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: selectedStatus || undefined,
        comment: comment.trim() || undefined,
        commenter_name: name.trim() || undefined,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTask(updated)
      setSubmitted(true)
      setComment('')
      setSelectedStatus('')
    } else {
      setSubmitError('Something went wrong — please try again.')
    }
    setSubmitting(false)
  }

  const green = '#2d4a30'
  const muted = '#9db89f'
  const border = '1px solid #d8e8d8'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f4f8f4' }}>
        <p className="text-sm" style={{ color: muted }}>Loading…</p>
      </div>
    )
  }

  if (invalid || !task) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ backgroundColor: '#f4f8f4' }}>
        <div className="text-4xl mb-4">🔗</div>
        <h1 className="font-semibold text-lg mb-2" style={{ color: green }}>Invalid link</h1>
        <p className="text-sm" style={{ color: muted }}>This link is expired or incorrect.</p>
      </div>
    )
  }

  const st = STATUS_STYLE[task.status] ?? STATUS_STYLE.pending

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f4f8f4' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white px-4 py-3 flex items-center gap-3" style={{ borderBottom: border }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0" style={{ backgroundColor: '#d4849a' }}>
          💍
        </div>
        <div>
          <p className="text-xs font-semibold" style={{ color: green }}>Nick & Siobhan's Wedding</p>
          <p className="text-xs" style={{ color: muted }}>Task update</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Task card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border }}>
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-start gap-2 mb-3">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full shrink-0" style={{ backgroundColor: st.bg, color: st.color }}>
                {STATUS_LABEL[task.status]}
              </span>
              {task.category && (
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: '#f0f4f0', color: muted }}>
                  {task.category}
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold leading-snug mb-2" style={{ color: green }}>{task.title}</h1>
            {task.description && (
              <p className="text-sm leading-relaxed" style={{ color: '#5a7d5e' }}>{task.description}</p>
            )}
          </div>

          {(task.responsible_party || task.important_contacts || task.due_date) && (
            <div className="px-4 py-3 space-y-2" style={{ borderTop: border }}>
              {task.responsible_party && (
                <div className="flex gap-2 text-sm">
                  <span className="shrink-0" style={{ color: muted }}>Responsible</span>
                  <span className="font-medium" style={{ color: green }}>{task.responsible_party}</span>
                </div>
              )}
              {task.important_contacts && (
                <div className="flex gap-2 text-sm">
                  <span className="shrink-0" style={{ color: muted }}>Contacts</span>
                  <span className="font-medium" style={{ color: green }}>{task.important_contacts}</span>
                </div>
              )}
              {task.due_date && (
                <div className="flex gap-2 text-sm">
                  <span className="shrink-0" style={{ color: muted }}>Due</span>
                  <span className="font-medium" style={{ color: green }}>
                    {new Date(task.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Update form */}
        {submitted ? (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm" style={{ border }}>
            <div className="text-3xl mb-3">✅</div>
            <p className="font-semibold" style={{ color: green }}>Update sent!</p>
            <p className="text-sm mt-1" style={{ color: muted }}>Nick & Siobhan have been notified.</p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-4 text-sm font-medium px-4 py-2 rounded-xl"
              style={{ backgroundColor: '#e8f0e8', color: '#5a7d5e' }}
            >
              Send another update
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border }}>
            <div className="px-4 pt-4 pb-3 space-y-4">
              <p className="text-sm font-semibold" style={{ color: green }}>Update progress</p>

              <div>
                <p className="text-xs mb-2" style={{ color: muted }}>New status (optional)</p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(STATUS_LABEL) as TaskStatus[]).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedStatus(prev => prev === s ? '' : s)}
                      className="rounded-xl px-3 py-3 text-sm font-medium text-left transition-colors"
                      style={{
                        backgroundColor: selectedStatus === s ? STATUS_STYLE[s].bg : '#f8faf8',
                        color: selectedStatus === s ? STATUS_STYLE[s].color : muted,
                        border: selectedStatus === s ? `2px solid ${STATUS_STYLE[s].color}` : '2px solid transparent',
                      }}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs mb-2" style={{ color: muted }}>Your name</p>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Mum, Aiden…"
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                  style={{ border: '1px solid #b8d0ba', color: green }}
                />
              </div>

              <div>
                <p className="text-xs mb-2" style={{ color: muted }}>Comment (optional)</p>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Any updates or notes…"
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                  style={{ border: '1px solid #b8d0ba', color: green }}
                />
              </div>
            </div>

            {submitError && (
              <p className="px-4 pb-2 text-sm" style={{ color: '#c0607a' }}>{submitError}</p>
            )}

            <div className="px-4 pb-4">
              <button
                type="submit"
                disabled={submitting || (!selectedStatus && !comment.trim())}
                className="w-full font-medium rounded-xl text-white"
                style={{ backgroundColor: '#d4849a', opacity: submitting || (!selectedStatus && !comment.trim()) ? 0.5 : 1, minHeight: 52 }}
              >
                {submitting ? 'Sending…' : 'Send update'}
              </button>
            </div>
          </form>
        )}

        {/* Comments */}
        {(task.task_comments?.length ?? 0) > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border }}>
            <p className="px-4 pt-4 pb-2 text-sm font-semibold" style={{ color: green }}>Comments</p>
            <div style={{ borderTop: border }}>
              {task.task_comments.map((c, i) => (
                <div key={i} className="px-4 py-3" style={{ borderTop: i > 0 ? border : undefined }}>
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-sm font-medium" style={{ color: green }}>{c.name}</span>
                    <span className="text-xs" style={{ color: muted }}>
                      {new Date(c.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: '#5a7d5e' }}>{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
