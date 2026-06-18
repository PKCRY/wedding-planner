'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked'
type Comment = { user: string; name: string; text: string; at: string }

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
  share_note: string
  task_comments: Comment[]
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

const PRIORITY_LABEL: Record<string, string> = {
  high: 'High', medium: 'Medium', low: 'Low',
}

export default function SharedTaskPage() {
  const { token } = useParams<{ token: string }>()

  const [task, setTask] = useState<SharedTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)

  const [name, setName] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | ''>('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/task-share/${token}`)
      .then(r => {
        if (!r.ok) { setInvalid(true); return null }
        return r.json()
      })
      .then(data => {
        if (data) {
          setTask(data)
          setSelectedStatus(data.status)
          setName(data.responsible_party || '')
        }
      })
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [task?.task_comments?.length])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setSubmitError('')

    const statusToSend = selectedStatus !== task?.status ? selectedStatus : undefined
    const res = await fetch(`/api/task-share/${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responsible_party: name.trim(),
        status: statusToSend || undefined,
        comment: note.trim() || undefined,
      }),
    })

    if (res.ok) {
      const updated = await res.json()
      setTask(updated)
      setSelectedStatus(updated.status)
      setNote('')
      setSubmitted(true)
    } else {
      setSubmitError('Could not save — please try again.')
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
  const comments = task.task_comments ?? []
  const canSubmit = name.trim().length > 0

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f4f8f4' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white px-4 py-3 flex items-center justify-between" style={{ borderBottom: border }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base" style={{ backgroundColor: '#d4849a' }}>
            💍
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: green }}>{task.title}</p>
            <p className="text-xs" style={{ color: muted }}>Nick & Siobhan's Wedding</p>
          </div>
        </div>
        <span
          className="text-xs font-medium px-3 py-1.5 rounded-full shrink-0 ml-2"
          style={{ backgroundColor: st.bg, color: st.color }}
        >
          {STATUS_LABEL[task.status]}
        </span>
      </div>

      <div className="max-w-lg mx-auto w-full px-4 pb-10 space-y-4 pt-4">

        {/* Note from sender */}
        {task.share_note && (
          <div className="rounded-2xl px-4 py-3.5" style={{ backgroundColor: '#fff8e6', border: '1px solid #e8d8a0' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#b08020' }}>Message from Nick & Siobhan 💍</p>
            <p className="text-sm leading-relaxed" style={{ color: '#7a6010' }}>{task.share_note}</p>
          </div>
        )}

        {/* Full task details */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border }}>
          <div className="px-4 pt-4 pb-1">
            <h1 className="text-lg font-semibold leading-snug" style={{ color: green }}>{task.title}</h1>
          </div>
          <div className="px-4 pb-4 pt-2 space-y-2">
            {task.description && (
              <p className="text-sm leading-relaxed" style={{ color: '#5a7d5e' }}>{task.description}</p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-1">
              {task.category && (
                <div className="text-sm">
                  <span style={{ color: muted }}>Category </span>
                  <span className="font-medium" style={{ color: green }}>{task.category}</span>
                </div>
              )}
              {task.priority && (
                <div className="text-sm">
                  <span style={{ color: muted }}>Priority </span>
                  <span className="font-medium" style={{ color: green }}>{PRIORITY_LABEL[task.priority] ?? task.priority}</span>
                </div>
              )}
              {task.due_date && (
                <div className="text-sm">
                  <span style={{ color: muted }}>Due </span>
                  <span className="font-medium" style={{ color: green }}>
                    {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}
              {task.important_contacts && (
                <div className="text-sm">
                  <span style={{ color: muted }}>Contacts </span>
                  <span className="font-medium" style={{ color: green }}>{task.important_contacts}</span>
                </div>
              )}
              {task.responsible_party && (
                <div className="text-sm">
                  <span style={{ color: muted }}>Handling </span>
                  <span className="font-medium" style={{ color: green }}>{task.responsible_party}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Claim + update form */}
        {submitted ? (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border }}>
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">✅</span>
                <p className="text-sm font-semibold" style={{ color: green }}>Saved! Thanks, {name.trim()}.</p>
              </div>
              <button
                onClick={() => setSubmitted(false)}
                className="text-sm font-medium"
                style={{ color: muted }}
              >
                Make another update
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border }}>
            <div className="px-4 pt-4 pb-3 space-y-4">
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: green }}>Claim this task</p>
                <p className="text-xs" style={{ color: muted }}>Enter your name, update the status, and leave a note if needed.</p>
              </div>

              {/* Name */}
              <div>
                <p className="text-xs mb-2" style={{ color: muted }}>
                  Your name <span style={{ color: '#c0607a' }}>*</span>
                </p>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Mum, Aiden…"
                  required
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                  style={{ border: `1px solid ${name.trim() ? '#7a9e7e' : '#b8d0ba'}`, color: green }}
                />
              </div>

              {/* Status */}
              <div>
                <p className="text-xs mb-2" style={{ color: muted }}>Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(STATUS_LABEL) as TaskStatus[]).map(s => {
                    const isCurrent = s === task.status
                    const isSelected = s === selectedStatus
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedStatus(s)}
                        className="rounded-xl px-3 py-3 text-sm font-medium text-left transition-colors relative"
                        style={{
                          backgroundColor: isSelected ? STATUS_STYLE[s].bg : '#f8faf8',
                          color: isSelected ? STATUS_STYLE[s].color : muted,
                          border: isSelected ? `2px solid ${STATUS_STYLE[s].color}` : '2px solid transparent',
                        }}
                      >
                        {STATUS_LABEL[s]}
                        {isCurrent && (
                          <span className="absolute top-1.5 right-2 font-normal" style={{ color: STATUS_STYLE[s].color, opacity: 0.7, fontSize: 10 }}>
                            current
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Note */}
              <div>
                <p className="text-xs mb-2" style={{ color: muted }}>Note (optional)</p>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Any updates, questions, or context…"
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                  style={{ border: '1px solid #b8d0ba', color: green }}
                />
              </div>

              {submitError && (
                <p className="text-sm" style={{ color: '#c0607a' }}>{submitError}</p>
              )}
            </div>

            <div className="px-4 pb-4">
              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className="w-full font-medium rounded-xl text-white"
                style={{ backgroundColor: '#d4849a', opacity: submitting || !canSubmit ? 0.5 : 1, minHeight: 52 }}
              >
                {submitting ? 'Saving…' : 'Claim & update'}
              </button>
            </div>
          </form>
        )}

        {/* Chat history */}
        {comments.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide px-1" style={{ color: muted }}>Messages</p>
            {comments.map((c, i) => (
              <div key={i} className="bg-white rounded-2xl px-4 py-3" style={{ border }}>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-sm font-semibold" style={{ color: green }}>
                    {c.user === 'nick' || c.user === 'siobhan' ? 'Nick & Siobhan 💍' : c.name}
                  </span>
                  <span className="text-xs" style={{ color: muted }}>
                    {new Date(c.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-sm leading-snug" style={{ color: '#5a7d5e' }}>{c.text}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
