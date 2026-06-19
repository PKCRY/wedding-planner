'use client'

import { useState, useEffect, useRef } from 'react'
import type { InventoryItem, InventoryCategory } from '@/lib/db'

const STATUS_COLORS = {
  needed:   { bg: '#fce8ef', color: '#c0607a', label: 'Still Need' },
  partial:  { bg: '#fef9e7', color: '#a07800', label: 'Partial' },
  acquired: { bg: '#e8f4e8', color: '#2d6a30', label: 'Done' },
}

const SUGGESTED = [
  'Flowers', 'Decorations', 'Catering', 'Drinks', 'Clothing',
  'Photography', 'Videography', 'Stationery', 'Entertainment',
  'Beauty & Hair', 'Favours', 'Transport', 'Venue', 'Accommodation',
  'Jewellery', 'Cake', 'Gifts', 'Lighting',
]

export default function InventoryReview() {
  const [allItems, setAllItems] = useState<InventoryItem[]>([])
  const [categories, setCategories] = useState<InventoryCategory[]>([])
  const [queue, setQueue] = useState<InventoryItem[]>([])
  const [index, setIndex] = useState(0)
  const [exitDir, setExitDir] = useState<'left' | 'right' | null>(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [loading, setLoading] = useState(true)
  const startX = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const wasDrag = useRef(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [itemsRes, catsRes] = await Promise.all([
      fetch('/api/inventory'),
      fetch('/api/inventory/categories'),
    ])
    const items: InventoryItem[] = itemsRes.ok ? await itemsRes.json() : []
    const cats: InventoryCategory[] = catsRes.ok ? await catsRes.json() : []
    setAllItems(items)
    setCategories(cats)
    // All uncategorized first (any status), then non-acquired categorized
    const uncategorized = items.filter(i => !i.category?.trim())
    const categorized = items.filter(i => i.category?.trim() && i.status !== 'acquired')
    setQueue([...uncategorized, ...categorized])
    setLoading(false)
  }

  function updateItem(updated: InventoryItem) {
    setAllItems(prev => prev.map(i => i.id === updated.id ? updated : i))
    setQueue(prev => prev.map(i => i.id === updated.id ? updated : i))
  }

  const current = queue[index]
  const remaining = queue.length - index

  function advance(dir: 'left' | 'right') {
    setExitDir(dir)
    setTimeout(() => {
      setExitDir(null)
      setDragX(0)
      setIndex(p => p + 1)
    }, 260)
  }

  async function approve() {
    if (!current) return
    const res = await fetch(`/api/inventory/${current.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acquired' }),
    })
    if (res.ok) updateItem(await res.json())
    advance('right')
  }

  function skip() { advance('left') }

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX
    wasDrag.current = false
    setDragging(true)
    cardRef.current?.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return
    const dx = e.clientX - startX.current
    if (Math.abs(dx) > 6) wasDrag.current = true
    setDragX(dx)
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dragging) return
    setDragging(false)
    const dx = e.clientX - startX.current
    if (!wasDrag.current) {
      setDragX(0)
      setEditItem(current)
    } else if (dx > 80) {
      approve()
    } else if (dx < -80) {
      skip()
    } else {
      setDragX(0)
    }
  }

  // Category breakdown
  const catNames = categories.map(c => c.name)
  const catStats = catNames.map(name => {
    const catItems = allItems.filter(i => i.category === name)
    const done = catItems.filter(i => i.status === 'acquired').length
    return { name, total: catItems.length, done }
  }).filter(c => c.total > 0)
  const uncatCount = allItems.filter(i => !i.category?.trim()).length
  const totalDone = allItems.filter(i => i.status === 'acquired').length
  const totalItems = allItems.length
  const overallPct = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0

  if (loading) return <div className="py-8 text-center text-sm" style={{ color: '#9db89f' }}>Loading inventory...</div>

  const rotation = dragX / 18
  const cardStyle: React.CSSProperties = exitDir === 'right'
    ? { transform: 'translateX(130%) rotate(22deg)', opacity: 0, transition: 'transform 0.26s ease, opacity 0.26s ease' }
    : exitDir === 'left'
    ? { transform: 'translateX(-130%) rotate(-22deg)', opacity: 0, transition: 'transform 0.26s ease, opacity 0.26s ease' }
    : dragging
    ? { transform: `translateX(${dragX}px) rotate(${rotation}deg)`, transition: 'none' }
    : { transform: 'translateX(0) rotate(0deg)', transition: 'transform 0.18s ease' }

  return (
    <div className="space-y-5 pb-24 lg:pb-8">

      {/* Overall progress */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: '#fff', border: '1px solid #e4ede4' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold" style={{ color: '#2d4a30' }}>Overall progress</p>
          <span className="text-sm font-bold tabular-nums" style={{ color: '#7a9e7e' }}>{overallPct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#e4ede4' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${overallPct}%`, backgroundColor: overallPct === 100 ? '#7a9e7e' : '#e6c84a' }} />
        </div>
        <div className="mt-3 space-y-1.5">
          {catStats.map(({ name, total, done }) => {
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            return (
              <div key={name}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs" style={{ color: '#5a7d5e' }}>{name}</span>
                  <span className="text-xs tabular-nums font-medium" style={{ color: '#9db89f' }}>{done}/{total}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#e4ede4' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#7a9e7e' : '#e6c84a' }} />
                </div>
              </div>
            )
          })}
          {uncatCount > 0 && (
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-xs" style={{ color: '#c0607a' }}>Uncategorized</span>
              <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fce8ef', color: '#c0607a' }}>{uncatCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Swipe queue */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold" style={{ color: '#2d4a30' }}>Item review</p>
          <span className="text-xs" style={{ color: '#9db89f' }}>{remaining} remaining</span>
        </div>

        {!current ? (
          <div className="rounded-2xl py-14 text-center" style={{ backgroundColor: '#fff', border: '1px solid #e4ede4' }}>
            <p className="text-3xl mb-2">✓</p>
            <p className="font-semibold" style={{ color: '#2d4a30' }}>All reviewed!</p>
            <p className="text-sm mt-1" style={{ color: '#9db89f' }}>{queue.length} items checked</p>
          </div>
        ) : (
          <>
            {/* Card stack */}
            <div className="relative" style={{ height: 210 }}>
              {queue[index + 2] && (
                <div className="absolute inset-x-4 top-4 rounded-3xl" style={{ height: 190, backgroundColor: '#d8e8d8', border: '1px solid #c8d8c8', zIndex: 0 }} />
              )}
              {queue[index + 1] && (
                <div className="absolute inset-x-2 top-2 rounded-3xl" style={{ height: 194, backgroundColor: '#e8f0e8', border: '1px solid #d4e4d4', zIndex: 1 }} />
              )}
              <div
                ref={cardRef}
                className="absolute inset-x-0 rounded-3xl cursor-grab active:cursor-grabbing"
                style={{ ...cardStyle, backgroundColor: '#fff', border: '1px solid #e4ede4', zIndex: 2, boxShadow: '0 6px 24px rgba(0,0,0,0.09)', touchAction: 'none', height: 198, userSelect: 'none', WebkitUserSelect: 'none' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={() => { if (dragging) { setDragging(false); setDragX(0) } }}
              >
                {/* Swipe overlays */}
                {dragX > 10 && (
                  <div className="absolute inset-0 rounded-3xl flex items-center pl-5 pointer-events-none" style={{ backgroundColor: 'rgba(122,158,126,0.12)' }}>
                    <span className="text-xl font-bold" style={{ color: '#7a9e7e', opacity: Math.min(1, dragX / 70) }}>✓ DONE</span>
                  </div>
                )}
                {dragX < -10 && (
                  <div className="absolute inset-0 rounded-3xl flex items-center justify-end pr-5 pointer-events-none" style={{ backgroundColor: 'rgba(192,96,122,0.12)' }}>
                    <span className="text-xl font-bold" style={{ color: '#c0607a', opacity: Math.min(1, -dragX / 70) }}>SKIP →</span>
                  </div>
                )}

                <div className="p-5 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {!current.category?.trim()
                        ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fce8ef', color: '#c0607a' }}>No category</span>
                        : <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#e8f0e8', color: '#5a7d5e' }}>{current.category}</span>
                      }
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={STATUS_COLORS[current.status]}>
                        {STATUS_COLORS[current.status].label}
                      </span>
                    </div>
                    <p className="font-bold text-lg leading-tight" style={{ color: '#2d4a30' }}>{current.name}</p>
                    {current.notes && <p className="text-xs mt-1 line-clamp-2" style={{ color: '#9db89f' }}>{current.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {(current.quantity || current.quantity_have) && (
                      <span className="text-xs" style={{ color: '#9db89f' }}>
                        {current.quantity_have ? `${current.quantity_have} / ${current.quantity}` : `Need: ${current.quantity}`}
                      </span>
                    )}
                    {current.responsible_party && (
                      <span className="text-xs" style={{ color: '#9db89f' }}>· {current.responsible_party}</span>
                    )}
                    <span className="text-xs ml-auto" style={{ color: '#c8d8c8' }}>tap to edit</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 justify-center mt-4">
              <button
                onClick={skip}
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl"
                style={{ backgroundColor: '#fce8ef', color: '#c0607a', border: '2px solid #f0b8c8', boxShadow: '0 2px 8px rgba(192,96,122,0.15)' }}
              >
                ✕
              </button>
              <button
                onClick={() => setEditItem(current)}
                className="flex-1 h-14 rounded-full flex items-center justify-center text-sm font-semibold"
                style={{ backgroundColor: '#f5f7f5', color: '#5a7d5e', border: '2px solid #d8e8d8' }}
              >
                Edit / Categorize
              </button>
              <button
                onClick={approve}
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl"
                style={{ backgroundColor: '#e8f4e8', color: '#7a9e7e', border: '2px solid #b8d8b8', boxShadow: '0 2px 8px rgba(122,158,126,0.15)' }}
              >
                ✓
              </button>
            </div>
          </>
        )}
      </div>

      {/* Edit sheet */}
      {editItem && (
        <ReviewEditSheet
          item={editItem}
          categories={categories.map(c => c.name)}
          onClose={() => setEditItem(null)}
          onSave={async (updates) => {
            const res = await fetch(`/api/inventory/${editItem.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            })
            if (res.ok) updateItem(await res.json())
            setEditItem(null)
          }}
          onCreateCategory={async (name) => {
            const res = await fetch('/api/inventory/categories', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name }),
            })
            if (res.ok) {
              const cat = await res.json() as InventoryCategory
              setCategories(prev => prev.some(c => c.name === cat.name) ? prev : [...prev, cat])
            }
          }}
        />
      )}
    </div>
  )
}

function ReviewEditSheet({ item, categories, onClose, onSave, onCreateCategory }: {
  item: InventoryItem
  categories: string[]
  onClose: () => void
  onSave: (updates: Partial<InventoryItem>) => Promise<void>
  onCreateCategory: (name: string) => Promise<void>
}) {
  const [category, setCategory] = useState(item.category ?? '')
  const [status, setStatus] = useState<InventoryItem['status']>(item.status)
  const [quantityHave, setQuantityHave] = useState(item.quantity_have ?? '')
  const [quantity, setQuantity] = useState(item.quantity ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [showCatInput, setShowCatInput] = useState(false)

  const suggestions = SUGGESTED.filter(s => !categories.includes(s) && s !== category)

  async function addCategory() {
    const t = newCat.trim()
    if (!t) return
    await onCreateCategory(t)
    setCategory(t)
    setNewCat('')
    setShowCatInput(false)
  }

  async function submit() {
    setSaving(true)
    await onSave({ category, status, quantity_have: quantityHave, quantity, notes })
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full max-w-lg rounded-t-3xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '88vh' }}>
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-9 h-1.5 rounded-full" style={{ backgroundColor: '#d8e8d8' }} />
        </div>
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid #e4ede4' }}>
          <p className="font-semibold text-base" style={{ color: '#2d4a30' }}>{item.name}</p>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-full text-xl" style={{ backgroundColor: '#f5f7f5', color: '#9db89f' }}>×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pt-4 pb-6 space-y-4">
          {/* Category */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#b8d0ba' }}>Category</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className="text-sm font-medium rounded-full px-3 py-1.5 transition-colors"
                  style={{
                    backgroundColor: category === cat ? '#7a9e7e' : '#e8f0e8',
                    color: category === cat ? '#fff' : '#5a7d5e',
                  }}
                >
                  {cat}
                </button>
              ))}
              {category && !categories.includes(category) && (
                <span className="text-sm font-medium rounded-full px-3 py-1.5" style={{ backgroundColor: '#7a9e7e', color: '#fff' }}>{category}</span>
              )}
              <button
                type="button"
                onClick={() => setShowCatInput(p => !p)}
                className="text-sm font-medium rounded-full px-3 py-1.5"
                style={{ backgroundColor: '#f5f7f5', color: '#9db89f', border: '1px dashed #c8d8c8' }}
              >
                + New
              </button>
            </div>

            {showCatInput && (
              <div className="flex gap-2 mb-2">
                <input
                  value={newCat}
                  onChange={e => setNewCat(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && newCat.trim() && addCategory()}
                  placeholder="Category name"
                  autoFocus
                  className="flex-1 min-w-0 rounded-xl px-4 text-sm focus:outline-none"
                  style={{ border: '1px solid #b8d0ba', color: '#2d4a30', minHeight: 44 }}
                />
                <button type="button" onClick={addCategory} disabled={!newCat.trim()}
                  className="rounded-xl px-4 text-sm font-medium text-white"
                  style={{ backgroundColor: '#7a9e7e', opacity: newCat.trim() ? 1 : 0.45, minHeight: 44 }}>
                  Add
                </button>
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div>
                <p className="text-xs mb-1.5" style={{ color: '#b8d0ba' }}>Suggestions</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.slice(0, 8).map(s => (
                    <button key={s} type="button"
                      onClick={async () => { await onCreateCategory(s); setCategory(s) }}
                      className="text-xs font-medium rounded-full px-2.5 py-1"
                      style={{ backgroundColor: '#f0f4f0', color: '#7a9e7e' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#b8d0ba' }}>Status</p>
            <div className="flex gap-2">
              {(['needed', 'partial', 'acquired'] as const).map(s => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className="flex-1 rounded-2xl py-2.5 text-sm font-semibold"
                  style={{
                    backgroundColor: status === s ? STATUS_COLORS[s].bg : '#f5f7f5',
                    color: status === s ? STATUS_COLORS[s].color : '#9db89f',
                    border: status === s ? `1.5px solid ${STATUS_COLORS[s].color}33` : '1.5px solid #e4ede4',
                  }}>
                  {STATUS_COLORS[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#b8d0ba' }}>Quantity</p>
            <div className="flex gap-2">
              <input value={quantityHave} onChange={e => setQuantityHave(e.target.value)}
                placeholder="Have so far" className="flex-1 min-w-0 rounded-2xl px-4 py-3 text-sm focus:outline-none"
                style={{ border: '1px solid #d8e8d8', color: '#2d4a30', backgroundColor: '#f5f7f5' }} />
              <input value={quantity} onChange={e => setQuantity(e.target.value)}
                placeholder="Total needed" className="flex-1 min-w-0 rounded-2xl px-4 py-3 text-sm focus:outline-none"
                style={{ border: '1px solid #d8e8d8', color: '#2d4a30', backgroundColor: '#f5f7f5' }} />
            </div>
          </div>

          {/* Notes */}
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)" rows={2}
            className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none resize-none"
            style={{ border: '1px solid #d8e8d8', color: '#2d4a30', backgroundColor: '#f5f7f5' }} />

          <button onClick={submit} disabled={saving}
            className="w-full font-semibold rounded-2xl text-white"
            style={{ backgroundColor: '#7a9e7e', opacity: saving ? 0.5 : 1, minHeight: 52 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <div className="shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
      </div>
    </div>
  )
}
