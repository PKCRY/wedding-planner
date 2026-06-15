'use client'

import { useState, useEffect } from 'react'
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
import type { InventoryItem } from '@/lib/db'

const STATUS_BAR: Record<string, string> = {
  needed:   '#d4849a',
  partial:  '#e6c84a',
  acquired: '#7a9e7e',
}

const STATUS_BG: Record<string, string> = {
  needed:   '#fce8ef',
  partial:  '#fef9e7',
  acquired: '#e8f4e8',
}

const STATUS_TEXT: Record<string, string> = {
  needed:   '#c0607a',
  partial:  '#a07800',
  acquired: '#2d6a30',
}

const STATUS_LABEL: Record<string, string> = {
  needed:   'Needed',
  partial:  'In Progress',
  acquired: 'Acquired',
}

const NEXT_STATUS: Record<string, InventoryItem['status']> = {
  needed: 'partial',
  partial: 'acquired',
  acquired: 'needed',
}

export default function InventoryList({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/inventory')
    if (res.ok) setItems(await res.json() as InventoryItem[])
    setLoading(false)
  }

  async function cycleStatus(item: InventoryItem) {
    const res = await fetch(`/api/inventory/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: NEXT_STATUS[item.status] }),
    })
    if (res.ok) {
      const updated = await res.json() as InventoryItem
      setItems(prev => prev.map(i => i.id === item.id ? updated : i))
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeItems = items.filter(i => i.status !== 'acquired')
    const acquired = items.filter(i => i.status === 'acquired')
    const oldIndex = activeItems.findIndex(i => i.id === active.id)
    const newIndex = activeItems.findIndex(i => i.id === over.id)
    const reordered = arrayMove(activeItems, oldIndex, newIndex)
    const updated = reordered.map((item, idx) => ({ ...item, sort_order: idx + 1 }))
    setItems([...updated, ...acquired])

    fetch('/api/inventory/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated.map(i => ({ id: i.id, sort_order: i.sort_order }))),
    }).catch(() => {})
  }

  async function toggleDone(item: InventoryItem) {
    const next = item.status === 'acquired' ? 'needed' : 'acquired'
    const res = await fetch(`/api/inventory/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) {
      const updated = await res.json() as InventoryItem
      setItems(prev => prev.map(i => i.id === item.id ? updated : i))
    }
  }

  async function saveItem(id: number | null, data: Partial<InventoryItem>) {
    if (id === null) {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) { const item = await res.json() as InventoryItem; setItems(prev => [...prev, item]) }
    } else {
      const res = await fetch(`/api/inventory/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json() as InventoryItem
        setItems(prev => prev.map(i => i.id === id ? updated : i))
      }
    }
  }

  async function deleteItem(id: number) {
    await fetch(`/api/inventory/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  if (loading) {
    return <div className="py-12 text-center text-sm" style={{ color: '#9db89f' }}>Loading inventory...</div>
  }

  const active = items.filter(i => i.status !== 'acquired')
  const acquired = items.filter(i => i.status === 'acquired')
  const counts = {
    needed: items.filter(i => i.status === 'needed').length,
    partial: items.filter(i => i.status === 'partial').length,
    acquired: items.filter(i => i.status === 'acquired').length,
  }

  return (
    <div className="space-y-3 pb-24">

      {/* Summary bar */}
      <div className="rounded-2xl p-4 flex flex-wrap gap-4" style={{ backgroundColor: '#fff', border: '1px solid #e4ede4' }}>
        {(['needed', 'partial', 'acquired'] as const).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: STATUS_BAR[s] }} />
            <span className="text-xs font-semibold" style={{ color: STATUS_TEXT[s] }}>
              {counts[s]} {STATUS_LABEL[s]}
            </span>
          </div>
        ))}
        <span className="text-xs ml-auto" style={{ color: '#b8d0ba' }}>
          {counts.acquired}/{items.length} acquired
        </span>
      </div>

      {/* Add button */}
      <button
        onClick={() => setShowAdd(true)}
        className="w-full rounded-2xl font-semibold text-sm"
        style={{ backgroundColor: '#e8f4e8', color: '#2d6a30', minHeight: 48 }}
      >
        + Add Item
      </button>

      {/* Active items */}
      {active.length === 0 && (
        <div className="py-8 text-center text-sm" style={{ color: '#b8d0ba' }}>
          All items acquired!
        </div>
      )}
      <div className="drag-list">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={active.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {active.map(item => (
            <SortableItemCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              onCycle={() => cycleStatus(item)}
              onEdit={() => setEditItem(item)}
              onToggleDone={() => toggleDone(item)}
            />
          ))}
        </SortableContext>
      </DndContext>
      </div>

      {/* Acquired section */}
      {acquired.length > 0 && (
        <>
          <div className="pt-4 pb-1 flex items-center gap-2">
            <div className="flex-1 h-px" style={{ backgroundColor: '#e4ede4' }} />
            <span className="text-xs font-semibold uppercase tracking-wide px-2" style={{ color: '#b8d0ba' }}>
              Acquired · {acquired.length}
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: '#e4ede4' }} />
          </div>
          {acquired.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              onCycle={() => cycleStatus(item)}
              onEdit={() => setEditItem(item)}
              onToggleDone={() => toggleDone(item)}
            />
          ))}
        </>
      )}

      {/* Edit modal */}
      {editItem && (
        <ItemModal
          item={editItem}
          isAdmin={isAdmin}
          onClose={() => setEditItem(null)}
          onSave={async data => { await saveItem(editItem.id, data); setEditItem(null) }}
          onDelete={async () => { await deleteItem(editItem.id); setEditItem(null) }}
        />
      )}

      {/* Add modal */}
      {showAdd && (
        <ItemModal
          isAdmin={isAdmin}
          onClose={() => setShowAdd(false)}
          onSave={async data => { await saveItem(null, data); setShowAdd(false) }}
        />
      )}
    </div>
  )
}

type CardCb = () => void | Promise<void>
type ItemCardProps = {
  item: InventoryItem
  isAdmin: boolean
  onCycle: CardCb
  onEdit: CardCb
  onToggleDone: CardCb
  dragHandle?: Record<string, unknown>
}
function SortableItemCard(props: ItemCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.item.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <ItemCard {...props} dragHandle={{ ...attributes, ...listeners }} />
    </div>
  )
}

function ItemCard({ item, isAdmin, onCycle, onEdit, onToggleDone, dragHandle }: ItemCardProps) {
  const isAcquired = item.status === 'acquired'
  return (
    <div
      className="relative bg-white rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e4ede4', userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <div className="pl-4 pr-4 py-3.5 flex items-center gap-3">
        {/* Checkbox to mark acquired / unmark */}
        <button
          onClick={onToggleDone}
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
          style={{
            backgroundColor: isAcquired ? '#7a9e7e' : '#fff',
            border: `2px solid ${isAcquired ? '#7a9e7e' : '#b8d0ba'}`,
          }}
        >
          {isAcquired && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p
            className={`font-semibold text-[15px] leading-snug ${isAcquired ? 'line-through' : ''}`}
            style={{ color: isAcquired ? '#b8d0ba' : '#2d4a30' }}
          >
            {item.name}
          </p>
          {(item.quantity || item.responsible_party) && (
            <p className="text-xs mt-0.5" style={{ color: '#9db89f' }}>
              {[item.quantity && `Qty: ${item.quantity}`, item.responsible_party].filter(Boolean).join(' · ')}
            </p>
          )}
          {item.notes && (
            <p className="text-xs mt-0.5" style={{ color: '#b8d0ba' }}>{item.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onCycle}
            className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap"
            style={{ backgroundColor: STATUS_BG[item.status], color: STATUS_TEXT[item.status] }}
          >
            {STATUS_LABEL[item.status]}
          </button>
          <button
            onClick={onEdit}
            className="text-xs px-2 py-1.5 rounded-lg"
            style={{ backgroundColor: '#f0f4f0', color: '#7a9e7e' }}
          >
            Edit
          </button>
          {dragHandle && (
            <button
              {...dragHandle}
              onContextMenu={(e) => e.preventDefault()}
              className="touch-none p-1.5 rounded cursor-grab active:cursor-grabbing"
              style={{ color: '#c8dcc8', WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="5" cy="4" r="1.5" fill="currentColor"/>
                <circle cx="11" cy="4" r="1.5" fill="currentColor"/>
                <circle cx="5" cy="8" r="1.5" fill="currentColor"/>
                <circle cx="11" cy="8" r="1.5" fill="currentColor"/>
                <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
                <circle cx="11" cy="12" r="1.5" fill="currentColor"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ItemModal({ item, isAdmin, onClose, onSave, onDelete }: {
  item?: InventoryItem
  isAdmin: boolean
  onClose: () => void
  onSave: (data: Partial<InventoryItem>) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [quantity, setQuantity] = useState(item?.quantity ?? '')
  const [status, setStatus] = useState<InventoryItem['status']>(item?.status ?? 'needed')
  const [responsibleParty, setResponsibleParty] = useState(item?.responsible_party ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), quantity, status, responsible_party: responsibleParty, notes })
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: '#d8e8d8' }} />
        </div>
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid #e4ede4' }}>
          <p className="font-semibold text-base" style={{ color: '#2d4a30' }}>
            {item ? 'Edit Item' : 'Add Item'}
          </p>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-xl"
            style={{ backgroundColor: '#f5f7f5', color: '#9db89f' }}
          >×</button>
        </div>

        <form onSubmit={submit} className="overflow-y-auto flex-1 px-5 pt-4 pb-6 space-y-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Item name"
            required
            autoFocus={!item}
            className="w-full rounded-2xl px-4 py-3 text-base font-semibold focus:outline-none"
            style={{ border: '1px solid #d8e8d8', color: '#2d4a30', backgroundColor: '#f5f7f5' }}
          />
          <input
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="Quantity (e.g. 200, ~100)"
            className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none"
            style={{ border: '1px solid #d8e8d8', color: '#2d4a30', backgroundColor: '#f5f7f5' }}
          />
          <select
            value={status}
            onChange={e => setStatus(e.target.value as InventoryItem['status'])}
            className="w-full rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none appearance-none"
            style={{ border: '1px solid #d8e8d8', backgroundColor: STATUS_BG[status], color: STATUS_TEXT[status] }}
          >
            <option value="needed">Needed</option>
            <option value="partial">In Progress</option>
            <option value="acquired">Acquired</option>
          </select>
          <input
            value={responsibleParty}
            onChange={e => setResponsibleParty(e.target.value)}
            placeholder="Responsible party (optional)"
            className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none"
            style={{ border: '1px solid #d8e8d8', color: '#2d4a30', backgroundColor: '#f5f7f5' }}
          />
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none resize-none"
            style={{ border: '1px solid #d8e8d8', color: '#2d4a30', backgroundColor: '#f5f7f5' }}
          />
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full font-semibold rounded-2xl text-white"
            style={{ backgroundColor: '#7a9e7e', opacity: saving || !name.trim() ? 0.5 : 1, minHeight: 52 }}
          >
            {saving ? 'Saving...' : item ? 'Save Changes' : 'Add Item'}
          </button>

          {onDelete && (
            confirmDelete ? (
              <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: '#fce8ef', border: '1px solid #f0b8c8' }}>
                <p className="text-sm font-semibold text-center" style={{ color: '#2d4a30' }}>Remove this item?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirmDelete(false)}
                    className="flex-1 rounded-2xl text-sm font-semibold"
                    style={{ backgroundColor: '#fff', color: '#9db89f', minHeight: 44, border: '1px solid #e4ede4' }}>
                    Cancel
                  </button>
                  <button type="button" onClick={onDelete}
                    className="flex-1 rounded-2xl text-sm font-semibold text-white"
                    style={{ backgroundColor: '#c0607a', minHeight: 44 }}>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="w-full text-sm font-semibold rounded-2xl"
                style={{ backgroundColor: '#fce8ef', color: '#c0607a', minHeight: 44 }}>
                Remove Item
              </button>
            )
          )}
        </form>
      </div>
    </div>
  )
}
