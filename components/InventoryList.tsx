'use client'

import { useState, useEffect, useRef } from 'react'
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
  needed:   'Still Need',
  partial:  'Partially Complete',
  acquired: 'Done',
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
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 0, tolerance: 8 } }),
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

    const pool = getFilteredActive()
    const oldIndex = pool.findIndex(i => i.id === active.id)
    const newIndex = pool.findIndex(i => i.id === over.id)
    const reordered = arrayMove(pool, oldIndex, newIndex)
    const withOrder = reordered.map((item, idx) => ({ ...item, sort_order: idx + 1 }))
    const byId = new Map(withOrder.map(i => [i.id, i.sort_order]))
    setItems(prev => prev.map(i => byId.has(i.id) ? { ...i, sort_order: byId.get(i.id)! } : i))

    fetch('/api/inventory/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withOrder.map(i => ({ id: i.id, sort_order: i.sort_order }))),
    }).catch(() => {})
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
    const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(i => i.id !== id))
  }

  // Derived state
  const knownCategories = Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort() as string[]
  const allActive = items.filter(i => i.status !== 'acquired').sort((a, b) => a.sort_order - b.sort_order)
  const acquired = items.filter(i => i.status === 'acquired')
  const hasUncategorized = allActive.some(i => !i.category)

  function matchesSearch(item: InventoryItem): boolean {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      item.name.toLowerCase().includes(q) ||
      (item.notes ?? '').toLowerCase().includes(q) ||
      (item.responsible_party ?? '').toLowerCase().includes(q) ||
      (item.category ?? '').toLowerCase().includes(q)
    )
  }

  function getFilteredActive(): InventoryItem[] {
    let pool = allActive
    if (categoryFilter === '__none__') pool = pool.filter(i => !i.category)
    else if (categoryFilter !== 'all') pool = pool.filter(i => i.category === categoryFilter)
    return pool.filter(matchesSearch)
  }

  const filteredActive = getFilteredActive()
  const filteredAcquired = acquired.filter(matchesSearch)
  const canDrag = categoryFilter !== 'all' && !search.trim()

  const counts = {
    needed: items.filter(i => i.status === 'needed').length,
    partial: items.filter(i => i.status === 'partial').length,
    acquired: items.filter(i => i.status === 'acquired').length,
  }

  // Pre-fill category when adding from a filtered view
  const defaultCategory = categoryFilter === 'all' || categoryFilter === '__none__' ? '' : categoryFilter

  if (loading) {
    return <div className="py-12 text-center text-sm" style={{ color: '#9db89f' }}>Loading inventory...</div>
  }

  return (
    <div className="space-y-3 pb-24">

      {/* Summary bar */}
      <div className="rounded-2xl p-4 flex flex-wrap gap-x-5 gap-y-2 items-center" style={{ backgroundColor: '#fff', border: '1px solid #e4ede4' }}>
        {(['needed', 'partial', 'acquired'] as const).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: STATUS_BAR[s] }} />
            <span className="text-xs font-bold tabular-nums" style={{ color: STATUS_TEXT[s] }}>{counts[s]}</span>
            <span className="text-xs" style={{ color: STATUS_TEXT[s] }}>{STATUS_LABEL[s]}</span>
          </div>
        ))}
        <span className="text-xs font-semibold ml-auto tabular-nums" style={{ color: '#b8d0ba' }}>
          {counts.acquired} / {items.length} done
        </span>
      </div>

      {/* Search bar */}
      <div className="relative">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9db89f' }}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search items…"
          className="w-full rounded-2xl pl-10 pr-10 text-sm focus:outline-none"
          style={{ backgroundColor: '#f5f7f5', border: '1px solid #e4ede4', color: '#2d4a30', minHeight: 44 }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-xs"
            style={{ backgroundColor: '#b8d0ba', color: '#fff' }}
          >×</button>
        )}
      </div>

      {/* Category filter chips */}
      {knownCategories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {(['all', ...knownCategories, ...(hasUncategorized ? ['__none__'] : [])] as string[]).map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className="shrink-0 text-sm font-medium rounded-full whitespace-nowrap transition-colors"
              style={{
                backgroundColor: categoryFilter === cat ? '#2d4a30' : '#e8f0e8',
                color: categoryFilter === cat ? '#fff' : '#5a7d5e',
                minHeight: 36,
                padding: '0 14px',
              }}
            >
              {cat === 'all' ? 'All' : cat === '__none__' ? 'Other' : cat}
            </button>
          ))}
        </div>
      )}


      {/* Active items */}
      {filteredActive.length === 0 && (
        <div className="py-8 text-center text-sm" style={{ color: '#b8d0ba' }}>
          {search.trim() ? 'No items match your search.' : categoryFilter === 'all' ? 'All items acquired!' : 'No items in this category.'}
        </div>
      )}

      {categoryFilter === 'all' && filteredActive.length > 0 ? (
        /* Grouped view — no drag */
        <div className="space-y-4">
          {knownCategories.map(cat => {
            const catItems = allActive.filter(i => i.category === cat).filter(matchesSearch)
            if (catItems.length === 0) return null
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#7a9e7e' }}>{cat}</span>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#e8f0e8', color: '#7a9e7e' }}>{catItems.length}</span>
                  <div className="flex-1 h-px" style={{ backgroundColor: '#e4ede4' }} />
                </div>
                <div className="space-y-2">
                  {catItems.map(item => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      isAdmin={isAdmin}
                      onCycle={() => cycleStatus(item)}
                      onEdit={() => setEditItem(item)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
          {hasUncategorized && (() => {
            const uncatItems = allActive.filter(i => !i.category).filter(matchesSearch)
            if (uncatItems.length === 0) return null
            return (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#b8d0ba' }}>Other</span>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#f0f4f0', color: '#b8d0ba' }}>
                    {uncatItems.length}
                  </span>
                  <div className="flex-1 h-px" style={{ backgroundColor: '#e4ede4' }} />
                </div>
                <div className="space-y-2">
                  {uncatItems.map(item => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      isAdmin={isAdmin}
                      onCycle={() => cycleStatus(item)}
                      onEdit={() => setEditItem(item)}
                    />
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      ) : filteredActive.length > 0 ? (
        /* Filtered + draggable view */
        <div className="drag-list">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredActive.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {filteredActive.map(item => (
                  <SortableItemCard
                    key={item.id}
                    item={item}
                    isAdmin={isAdmin}
                    onCycle={() => cycleStatus(item)}
                    onEdit={() => setEditItem(item)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ) : null}

      {/* Acquired section */}
      {filteredAcquired.length > 0 && (
        <>
          <div className="pt-4 pb-1 flex items-center gap-2">
            <div className="flex-1 h-px" style={{ backgroundColor: '#e4ede4' }} />
            <span className="text-xs font-semibold uppercase tracking-wide px-2" style={{ color: '#b8d0ba' }}>
              Done · {filteredAcquired.length}
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: '#e4ede4' }} />
          </div>
          {filteredAcquired.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              onCycle={() => cycleStatus(item)}
              onEdit={() => setEditItem(item)}
            />
          ))}
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed right-5 w-14 h-14 text-white rounded-full shadow-lg text-2xl flex items-center justify-center z-10 fab-bottom"
        style={{ backgroundColor: '#7a9e7e' }}
      >
        +
      </button>

      {/* Edit modal */}
      {editItem && (
        <ItemModal
          item={editItem}
          isAdmin={isAdmin}
          knownCategories={knownCategories}
          onClose={() => setEditItem(null)}
          onSave={async data => { await saveItem(editItem.id, data); setEditItem(null) }}
          onDelete={async () => { await deleteItem(editItem.id); setEditItem(null) }}
        />
      )}

      {/* Add modal */}
      {showAdd && (
        <ItemModal
          isAdmin={isAdmin}
          knownCategories={knownCategories}
          defaultCategory={defaultCategory}
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

function ItemCard({ item, isAdmin, onCycle, onEdit, dragHandle }: ItemCardProps) {
  return (
    <div
      onClick={onEdit}
      className="relative bg-white rounded-2xl overflow-hidden cursor-pointer"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e4ede4', userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <div className="pl-4 pr-4 py-3.5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[15px] leading-snug" style={{ color: '#2d4a30' }}>{item.name}</p>
          {(item.quantity || item.quantity_have || item.responsible_party) && (
            <p className="text-xs mt-0.5 break-words" style={{ color: '#9db89f' }}>
              {[
                item.quantity && (item.quantity_have
                  ? `${item.quantity_have} / ${item.quantity}`
                  : `Qty: ${item.quantity}`),
                item.responsible_party,
              ].filter(Boolean).join(' · ')}
            </p>
          )}
          {item.notes && (
            <p className="text-xs mt-0.5 break-words" style={{ color: '#b8d0ba' }}>{item.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onCycle() }}
            className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap"
            style={{ minHeight: 44, backgroundColor: STATUS_BG[item.status], color: STATUS_TEXT[item.status] }}
          >
            {STATUS_LABEL[item.status]}
          </button>
          {dragHandle && (
            <button
              {...dragHandle}
              onClick={e => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
              onTouchStart={(e) => e.preventDefault()}
              className="touch-none rounded cursor-grab active:cursor-grabbing flex items-center justify-center"
              style={{
                color: '#b8d0ba',
                WebkitTouchCallout: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'none',
                minWidth: 36,
                minHeight: 44,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
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

function ItemModal({ item, isAdmin, knownCategories, defaultCategory = '', onClose, onSave, onDelete }: {
  item?: InventoryItem
  isAdmin: boolean
  knownCategories: string[]
  defaultCategory?: string
  onClose: () => void
  onSave: (data: Partial<InventoryItem>) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState(item?.category ?? defaultCategory)
  const [quantity, setQuantity] = useState(item?.quantity ?? '')
  const [quantityHave, setQuantityHave] = useState(item?.quantity_have ?? '')
  const [status, setStatus] = useState<InventoryItem['status']>(item?.status ?? 'needed')
  const [responsibleParty, setResponsibleParty] = useState(item?.responsible_party ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [sortOrder, setSortOrder] = useState<string>(item?.sort_order != null ? String(item.sort_order) : '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [categorySheetOpen, setCategorySheetOpen] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const parsed = sortOrder !== '' ? parseInt(sortOrder, 10) : undefined
    await onSave({
      name: name.trim(),
      category: category.trim(),
      quantity,
      quantity_have: quantityHave,
      status,
      responsible_party: responsibleParty,
      notes,
      ...(parsed != null && !isNaN(parsed) ? { sort_order: parsed } : {}),
    })
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden modal-bottom">
        <div className="sm:hidden flex items-center justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: '#d8e8d8' }} />
        </div>
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid #e4ede4' }}>
          <p className="font-semibold text-base" style={{ color: '#2d4a30' }}>
            {item ? 'Edit Item' : 'Add Item'}
          </p>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-full text-xl"
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

          {/* Category */}
          <button
            type="button"
            onClick={() => setCategorySheetOpen(true)}
            className="w-full rounded-2xl px-4 py-3 text-left flex items-center justify-between focus:outline-none text-sm"
            style={{ border: '1px solid #d8e8d8', color: category ? '#2d4a30' : '#9db89f', backgroundColor: '#f5f7f5' }}
          >
            <span>{category || 'Select or create category…'}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: '#9db89f', flexShrink: 0 }}>
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="flex gap-2">
            <input
              value={quantityHave}
              onChange={e => setQuantityHave(e.target.value)}
              placeholder="Have so far"
              className="flex-1 rounded-2xl px-4 py-3 text-sm focus:outline-none"
              style={{ border: '1px solid #d8e8d8', color: '#2d4a30', backgroundColor: '#f5f7f5' }}
            />
            <input
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="Total needed"
              className="flex-1 rounded-2xl px-4 py-3 text-sm focus:outline-none"
              style={{ border: '1px solid #d8e8d8', color: '#2d4a30', backgroundColor: '#f5f7f5' }}
            />
          </div>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as InventoryItem['status'])}
            className="w-full rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none appearance-none"
            style={{ border: '1px solid #d8e8d8', backgroundColor: STATUS_BG[status], color: STATUS_TEXT[status] }}
          >
            <option value="needed">Still Need</option>
            <option value="partial">Partially Complete</option>
            <option value="acquired">Done</option>
          </select>
          <div className="flex gap-2">
            <input
              value={responsibleParty}
              onChange={e => setResponsibleParty(e.target.value)}
              placeholder="Responsible party (optional)"
              className="flex-1 rounded-2xl px-4 py-3 text-sm focus:outline-none"
              style={{ border: '1px solid #d8e8d8', color: '#2d4a30', backgroundColor: '#f5f7f5' }}
            />
            <input
              type="number"
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              placeholder="Position"
              min={1}
              className="w-24 rounded-2xl px-4 py-3 text-sm focus:outline-none text-center"
              style={{ border: '1px solid #d8e8d8', color: '#2d4a30', backgroundColor: '#f5f7f5' }}
            />
          </div>
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

      {categorySheetOpen && (
        <CategoryPickerSheet
          categories={knownCategories}
          value={category}
          onSelect={cat => { setCategory(cat); setCategorySheetOpen(false) }}
          onClose={() => setCategorySheetOpen(false)}
        />
      )}
    </div>
  )
}

function CategoryPickerSheet({ categories, value, onSelect, onClose }: {
  categories: string[]
  value: string
  onSelect: (cat: string) => void
  onClose: () => void
}) {
  const [showNewInput, setShowNewInput] = useState(false)
  const [newCatText, setNewCatText] = useState('')
  const newInputRef = useRef<HTMLInputElement>(null)

  function handleAdd() {
    const trimmed = newCatText.trim()
    if (!trimmed) return
    onSelect(trimmed)
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center z-[60]"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-t-3xl w-full max-w-lg shadow-2xl flex flex-col" style={{ maxHeight: '70vh' }}>
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-9 h-1.5 rounded-full" style={{ backgroundColor: '#d8e8d8' }} />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 shrink-0">
          <h3 className="font-semibold text-base" style={{ color: '#2d4a30' }}>Category</h3>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-full text-xl"
            style={{ color: '#9db89f', backgroundColor: '#f0f4f0' }}>×</button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Clear option */}
          {value && (
            <button
              type="button"
              onClick={() => onSelect('')}
              className="w-full flex items-center justify-between px-5 text-sm"
              style={{ minHeight: 52, color: '#c0607a', borderTop: '1px solid #f0f4f0' }}
            >
              <span>No category</span>
            </button>
          )}

          {categories.map((cat, i) => (
            <button
              key={cat}
              type="button"
              onClick={() => onSelect(cat)}
              className="w-full flex items-center justify-between px-5 text-sm"
              style={{
                minHeight: 52,
                color: value === cat ? '#7a9e7e' : '#2d4a30',
                fontWeight: value === cat ? 600 : 400,
                borderTop: '1px solid #f0f4f0',
              }}
            >
              <span>{cat}</span>
              {value === cat && (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3.75 9l3.75 3.75 6.75-7.5" stroke="#7a9e7e" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}

          <div style={{ borderTop: '1px solid #d8e8d8' }}>
            {showNewInput ? (
              <div className="flex gap-2 px-4 py-3">
                <input
                  ref={newInputRef}
                  autoFocus
                  value={newCatText}
                  onChange={e => setNewCatText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  placeholder="Category name"
                  className="flex-1 rounded-xl px-4 py-3 text-sm focus:outline-none"
                  style={{ border: '1px solid #b8d0ba', color: '#2d4a30' }}
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!newCatText.trim()}
                  className="rounded-xl px-5 text-sm font-medium text-white"
                  style={{ backgroundColor: '#7a9e7e', opacity: newCatText.trim() ? 1 : 0.45, minHeight: 48 }}
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setShowNewInput(true); setTimeout(() => newInputRef.current?.focus(), 50) }}
                className="w-full flex items-center gap-3 px-5 text-sm font-medium"
                style={{ minHeight: 52, color: '#d4849a' }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 3.75v10.5M3.75 9h10.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
                Create new category
              </button>
            )}
          </div>
        </div>

        <div className="shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
      </div>
    </div>
  )
}
