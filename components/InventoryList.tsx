'use client'

import { useState, useEffect, Fragment } from 'react'
import AddToTimelineSheet from '@/components/AddToTimelineSheet'
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
import type { InventoryItem, InventoryCategory } from '@/lib/db'

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
  partial:  'In Progress',
  acquired: 'Done',
}

const EXCEL_STATUS_LABEL: Record<string, string> = {
  needed:   "Don't Have",
  partial:  'In Prog',
  acquired: 'Have',
}

const NEXT_STATUS: Record<string, InventoryItem['status']> = {
  needed: 'partial',
  partial: 'acquired',
  acquired: 'needed',
}

export default function InventoryList({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [categories, setCategories] = useState<InventoryCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addDefaultCategory, setAddDefaultCategory] = useState('')
  const [search, setSearch] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [expandedDone, setExpandedDone] = useState<Set<string>>(new Set())

  // Sensors for item drag (kept for future use)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 0, tolerance: 8 } }),
  )

  // Sensors for category drag (longer touch delay so taps still work)
  const catSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  useEffect(() => { load() }, [])

  async function load() {
    const [itemsRes, catsRes] = await Promise.all([
      fetch('/api/inventory'),
      fetch('/api/inventory/categories'),
    ])
    const loadedItems: InventoryItem[] = itemsRes.ok ? await itemsRes.json() : []
    const loadedCats: InventoryCategory[] = catsRes.ok ? await catsRes.json() : []
    setItems(loadedItems)
    setCategories(loadedCats)
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

  async function setStatus(item: InventoryItem, newStatus: InventoryItem['status']) {
    const res = await fetch(`/api/inventory/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const updated = await res.json() as InventoryItem
      setItems(prev => prev.map(i => i.id === item.id ? updated : i))
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const pool = items.filter(i => i.status !== 'acquired').sort((a, b) => a.sort_order - b.sort_order)
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

  async function handleCatDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = categories.findIndex(c => c.id === active.id)
    const newIndex = categories.findIndex(c => c.id === over.id)
    const reordered = arrayMove(categories, oldIndex, newIndex)
    const withOrder = reordered.map((c, idx) => ({ ...c, sort_order: idx + 1 }))
    setCategories(withOrder)
    fetch('/api/inventory/categories/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withOrder.map(c => ({ id: c.id, sort_order: c.sort_order }))),
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

  async function createCategory(name: string) {
    const res = await fetch('/api/inventory/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const cat = await res.json() as InventoryCategory
      setCategories(prev => prev.some(c => c.name === cat.name) ? prev : [...prev, cat])
    }
  }

  async function renameCategory(id: number, oldName: string, newName: string, updateItems: boolean) {
    const res = await fetch(`/api/inventory/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, updateItems }),
    })
    if (!res.ok) return
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c))
    if (updateItems) {
      setItems(prev => prev.map(i => ({
        ...i,
        categories: (i.categories ?? []).map(c => c === oldName ? newName : c),
      })))
    }
  }

  async function deleteCategory(id: number) {
    const res = await fetch(`/api/inventory/categories/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  function toggleCategory(key: string) {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleDone(key: string) {
    setExpandedDone(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function matchesSearch(item: InventoryItem): boolean {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      item.name.toLowerCase().includes(q) ||
      (item.notes ?? '').toLowerCase().includes(q) ||
      (item.responsible_party ?? '').toLowerCase().includes(q) ||
      (item.categories ?? []).some(c => c.toLowerCase().includes(q))
    )
  }

  // Categories ordered by sort_order (from API, not re-sorted alphabetically)
  const allCategoryNames = categories.map(c => c.name)
  const itemCounts: Record<string, number> = {}
  for (const cat of allCategoryNames) {
    itemCounts[cat] = items.filter(i => (i.categories ?? []).includes(cat)).length
  }

  const hasUncategorized = items.some(i => !i.categories?.length)

  function getCatItems(cat: string) {
    if (cat === '__none__') return items.filter(i => !i.categories?.length)
    return items.filter(i => (i.categories ?? []).includes(cat))
  }

  const allCategoryKeys = [...allCategoryNames, ...(hasUncategorized ? ['__none__'] : [])]

  const counts = {
    needed: items.filter(i => i.status === 'needed').length,
    partial: items.filter(i => i.status === 'partial').length,
    acquired: items.filter(i => i.status === 'acquired').length,
  }

  if (loading) {
    return <div className="py-12 text-center text-sm" style={{ color: '#9db89f' }}>Loading inventory...</div>
  }

  function renderCatContent(catKey: string) {
    const catItems = getCatItems(catKey)
    const activeItems = catItems.filter(i => i.status !== 'acquired').filter(matchesSearch).sort((a, b) => a.sort_order - b.sort_order)
    const doneItems = catItems.filter(i => i.status === 'acquired').filter(matchesSearch)
    const totalVisible = activeItems.length + doneItems.length
    // Hide during active search if nothing matches; always show when not searching
    if (totalVisible === 0 && search.trim()) return null

    const isCollapsed = collapsedCategories.has(catKey)
    const isDoneExpanded = expandedDone.has(catKey)
    const pct = totalVisible > 0 ? Math.round((doneItems.length / totalVisible) * 100) : 0

    return { activeItems, doneItems, totalVisible, isCollapsed, isDoneExpanded, pct }
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

      {/* ── Desktop: Excel-style spreadsheet table ── */}
      <div className="hidden lg:block overflow-hidden rounded-xl" style={{ border: '1px solid #c8dcc8', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#dceadc' }}>
                {[
                  ['Status', 130],
                  ['Item', null],
                  ['Have / Needed', 130],
                  ['Responsible Party', 160],
                  ['Notes', null],
                ].map(([label, w], i, arr) => (
                  <th key={label as string} style={{
                    width: w ? (w as number) : undefined,
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: 11,
                    color: '#2d4a30',
                    borderBottom: '2px solid #adc8ad',
                    borderRight: i < arr.length - 1 ? '1px solid #adc8ad' : undefined,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                  }}>
                    {label as string}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allCategoryKeys.every(k => getCatItems(k).filter(matchesSearch).length === 0) ? (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#b8d0ba' }}>
                    {search.trim() ? 'No items match your search.' : 'No inventory items yet.'}
                  </td>
                </tr>
              ) : allCategoryKeys.map((catKey, catIdx) => {
                const catLabel = catKey === '__none__' ? 'Other' : catKey
                const group = getCatItems(catKey).filter(matchesSearch).sort((a, b) => a.sort_order - b.sort_order)
                // Hide during active search if nothing matches; always show when not searching
                if (!group.length && search.trim()) return null
                const isCollapsed = collapsedCategories.has(catKey)
                const doneCount = group.filter(i => i.status === 'acquired').length
                const isFirst = catIdx === 0
                return (
                  <Fragment key={catKey}>
                    {/* Category header row */}
                    <tr
                      onClick={() => toggleCategory(catKey)}
                      style={{ cursor: 'pointer', backgroundColor: '#d8ebd8', userSelect: 'none' }}
                    >
                      <td colSpan={5} style={{
                        padding: '8px 14px',
                        borderTop: !isFirst ? '2px solid #adc8ad' : undefined,
                        borderBottom: '1px solid #adc8ad',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <svg
                            width="14" height="14" viewBox="0 0 14 14" fill="none"
                            style={{ color: '#7a9e7e', flexShrink: 0, transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}
                          >
                            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span style={{ fontWeight: 700, fontSize: 12, color: '#2d4a30' }}>{catLabel}</span>
                          <span style={{ fontSize: 11, color: '#7a9e7e', fontWeight: 500 }}>
                            {doneCount}/{group.length} done
                          </span>
                        </div>
                      </td>
                    </tr>
                    {/* Item rows */}
                    {!isCollapsed && group.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: '10px 14px 10px 28px', color: '#b8d0ba', fontSize: 12, borderBottom: '1px solid #e4ede4' }}>
                          No items in this category yet
                        </td>
                      </tr>
                    )}
                    {!isCollapsed && group.map((item, ri) => {
                      const acquired = item.status === 'acquired'
                      return (
                        <tr key={item.id} onClick={() => setEditItem(item)} className="group cursor-pointer">
                          <td className="group-hover:bg-[#f5f9f5]" style={{ padding: '4px 10px', borderBottom: '1px solid #e4ede4', borderRight: '1px solid #e4ede4' }}>
                            <select
                              value={item.status}
                              onClick={e => e.stopPropagation()}
                              onChange={e => { e.stopPropagation(); setStatus(item, e.target.value as InventoryItem['status']) }}
                              style={{
                                backgroundColor: STATUS_BG[item.status],
                                color: STATUS_TEXT[item.status],
                                fontSize: 12,
                                fontWeight: 600,
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: `1px solid ${STATUS_BAR[item.status]}`,
                                cursor: 'pointer',
                                width: '100%',
                                appearance: 'auto',
                              }}
                            >
                              <option value="acquired">Have</option>
                              <option value="needed">Don&apos;t Have</option>
                              <option value="partial">In Prog</option>
                            </select>
                          </td>
                          <td className="group-hover:bg-[#f5f9f5]" style={{ padding: '7px 14px', borderBottom: '1px solid #e4ede4', borderRight: '1px solid #e4ede4', color: acquired ? '#9db89f' : '#2d4a30', fontWeight: 500, fontSize: 13 }}>
                            {item.name}
                          </td>
                          <td className="group-hover:bg-[#f5f9f5]" style={{ padding: '7px 14px', borderBottom: '1px solid #e4ede4', borderRight: '1px solid #e4ede4', color: '#5a7d5e', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                            {item.quantity_have && item.quantity
                              ? `${item.quantity_have} / ${item.quantity}`
                              : item.quantity_have
                              ? item.quantity_have
                              : item.quantity
                              ? `— / ${item.quantity}`
                              : ''}
                          </td>
                          <td className="group-hover:bg-[#f5f9f5]" style={{ padding: '7px 14px', borderBottom: '1px solid #e4ede4', borderRight: '1px solid #e4ede4', color: '#7a9e7e', fontSize: 12 }}>
                            {item.responsible_party}
                          </td>
                          <td className="group-hover:bg-[#f5f9f5]" style={{ padding: '7px 14px', borderBottom: '1px solid #e4ede4', color: '#9db89f', fontSize: 12 }}>
                            {item.notes}
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile: category accordion (sortable) ── */}
      <div className="lg:hidden">
      <DndContext sensors={catSensors} collisionDetection={closestCenter} onDragEnd={handleCatDragEnd}>
        <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 pb-24 lg:pb-8">

            {/* Named categories (sortable) */}
            {categories.map(cat => {
              const content = renderCatContent(cat.name)
              if (!content) return null
              const { activeItems, doneItems, totalVisible, isCollapsed, isDoneExpanded, pct } = content

              return (
                <SortableCatBlock key={cat.id} catId={cat.id}>
                  {(handleProps) => (
                    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #e4ede4' }}>
                      <div className="flex items-center" style={{ WebkitTapHighlightColor: 'transparent' }}>
                        {/* Drag handle */}
                        <button
                          {...handleProps}
                          onClick={e => e.stopPropagation()}
                          className="flex items-center justify-center shrink-0"
                          style={{ color: '#c8dcc8', cursor: 'grab', touchAction: 'none', padding: '14px 2px 14px 10px', userSelect: 'none', WebkitUserSelect: 'none' }}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="5" cy="4" r="1.5" fill="currentColor"/>
                            <circle cx="11" cy="4" r="1.5" fill="currentColor"/>
                            <circle cx="5" cy="8" r="1.5" fill="currentColor"/>
                            <circle cx="11" cy="8" r="1.5" fill="currentColor"/>
                            <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
                            <circle cx="11" cy="12" r="1.5" fill="currentColor"/>
                          </svg>
                        </button>
                        {/* Collapse toggle */}
                        <button
                          onClick={() => toggleCategory(cat.name)}
                          className="flex-1 pr-4 pt-3.5 pb-3 text-left"
                          style={{ paddingLeft: 6, WebkitTapHighlightColor: 'transparent' }}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-sm flex-1 text-left" style={{ color: '#2d4a30' }}>{cat.name}</span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full tabular-nums shrink-0" style={{ backgroundColor: '#e8f0e8', color: '#7a9e7e' }}>
                              {doneItems.length}/{totalVisible}
                            </span>
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
                              style={{ color: '#b8d0ba', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease', flexShrink: 0 }}>
                              <path d="M4.5 7l4.5 4.5L13.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ backgroundColor: '#e4ede4' }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#7a9e7e' : '#e6c84a' }} />
                          </div>
                        </button>
                      </div>

                      {!isCollapsed && (
                        <div style={{ borderTop: '1px solid #f0f4f0' }}>
                          {totalVisible === 0 && (
                            <p className="px-4 py-3 text-sm" style={{ color: '#b8d0ba' }}>No items in this category yet</p>
                          )}
                          {activeItems.length > 0 && (
                            <div className="px-2 pb-2 pt-1 space-y-2">
                              {activeItems.map(item => (
                                <ItemCard key={item.id} item={item} isAdmin={isAdmin} onCycle={() => cycleStatus(item)} onEdit={() => setEditItem(item)} />
                              ))}
                            </div>
                          )}
                          {doneItems.length > 0 && (
                            <>
                              <button onClick={() => toggleDone(cat.name)}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold select-none"
                                style={{ color: '#b8d0ba', borderTop: activeItems.length > 0 ? '1px solid #f0f4f0' : undefined, WebkitTapHighlightColor: 'transparent' }}>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                                  style={{ color: '#c8d8c8', transform: isDoneExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
                                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Done · {doneItems.length}
                              </button>
                              {isDoneExpanded && (
                                <div className="px-2 pb-2 space-y-2">
                                  {doneItems.map(item => (
                                    <ItemCard key={item.id} item={item} isAdmin={isAdmin} onCycle={() => cycleStatus(item)} onEdit={() => setEditItem(item)} />
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </SortableCatBlock>
              )
            })}

            {/* Uncategorized (not sortable, always last) */}
            {hasUncategorized && (() => {
              const content = renderCatContent('__none__')
              if (!content) return null
              const { activeItems, doneItems, totalVisible, isCollapsed, isDoneExpanded, pct } = content
              return (
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #e4ede4' }}>
                  <button onClick={() => toggleCategory('__none__')} className="w-full px-4 pt-3.5 pb-3 text-left" style={{ WebkitTapHighlightColor: 'transparent' }}>
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-sm flex-1 text-left" style={{ color: '#2d4a30' }}>Other</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full tabular-nums shrink-0" style={{ backgroundColor: '#e8f0e8', color: '#7a9e7e' }}>
                        {doneItems.length}/{totalVisible}
                      </span>
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
                        style={{ color: '#b8d0ba', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease', flexShrink: 0 }}>
                        <path d="M4.5 7l4.5 4.5L13.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ backgroundColor: '#e4ede4' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#7a9e7e' : '#e6c84a' }} />
                    </div>
                  </button>
                  {!isCollapsed && (
                    <div style={{ borderTop: '1px solid #f0f4f0' }}>
                      {activeItems.length > 0 && (
                        <div className="px-2 pb-2 pt-1 space-y-2">
                          {activeItems.map(item => (
                            <ItemCard key={item.id} item={item} isAdmin={isAdmin} onCycle={() => cycleStatus(item)} onEdit={() => setEditItem(item)} />
                          ))}
                        </div>
                      )}
                      {doneItems.length > 0 && (
                        <>
                          <button onClick={() => toggleDone('__none__')}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold select-none"
                            style={{ color: '#b8d0ba', borderTop: activeItems.length > 0 ? '1px solid #f0f4f0' : undefined, WebkitTapHighlightColor: 'transparent' }}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                              style={{ color: '#c8d8c8', transform: isDoneExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
                              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Done · {doneItems.length}
                          </button>
                          {isDoneExpanded && (
                            <div className="px-2 pb-2 space-y-2">
                              {doneItems.map(item => (
                                <ItemCard key={item.id} item={item} isAdmin={isAdmin} onCycle={() => cycleStatus(item)} onEdit={() => setEditItem(item)} />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {allCategoryKeys.every(cat => getCatItems(cat).filter(matchesSearch).length === 0) && (
              <div className="py-8 text-center text-sm" style={{ color: '#b8d0ba' }}>
                {search.trim() ? 'No items match your search.' : 'No inventory items yet.'}
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
      </div>{/* end lg:hidden */}

      {/* FAB */}
      <button
        onClick={() => { setAddDefaultCategory(''); setShowAdd(true) }}
        className="fixed right-5 w-14 h-14 text-white rounded-full shadow-lg text-2xl flex items-center justify-center z-10 fab-above-nav"
        style={{ backgroundColor: '#7a9e7e' }}
      >
        +
      </button>

      {/* Edit modal */}
      {editItem && (
        <ItemModal
          item={editItem}
          isAdmin={isAdmin}
          allCategories={categories}
          itemCounts={itemCounts}
          onCreateCategory={createCategory}
          onRenameCategory={renameCategory}
          onDeleteCategory={deleteCategory}
          onClose={() => setEditItem(null)}
          onSave={async data => { await saveItem(editItem.id, data); setEditItem(null) }}
          onDelete={async () => { await deleteItem(editItem.id); setEditItem(null) }}
        />
      )}

      {/* Add modal */}
      {showAdd && (
        <ItemModal
          isAdmin={isAdmin}
          allCategories={categories}
          itemCounts={itemCounts}
          defaultCategory={addDefaultCategory}
          onCreateCategory={createCategory}
          onRenameCategory={renameCategory}
          onDeleteCategory={deleteCategory}
          onClose={() => setShowAdd(false)}
          onSave={async data => { await saveItem(null, data); setShowAdd(false) }}
        />
      )}
    </div>
  )
}

// ── Sortable category wrapper ────────────────────────────────────────────────

function SortableCatBlock({ catId, children }: {
  catId: number
  children: (handleProps: React.HTMLAttributes<HTMLElement>) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: catId })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      {children({ ...attributes, ...listeners })}
    </div>
  )
}

// ── Item card ────────────────────────────────────────────────────────────────

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
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
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
      <div className="pl-3 pr-4 py-3.5 flex items-center gap-3">
        <button
          onClick={e => { e.stopPropagation(); onCycle() }}
          className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap shrink-0"
          style={{ minHeight: 36, backgroundColor: STATUS_BG[item.status], color: STATUS_TEXT[item.status], minWidth: 80, textAlign: 'center' }}
        >
          {STATUS_LABEL[item.status]}
        </button>
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

// ── Item modal ───────────────────────────────────────────────────────────────

function ItemModal({ item, isAdmin, allCategories, itemCounts, defaultCategory = '', onCreateCategory, onRenameCategory, onDeleteCategory, onClose, onSave, onDelete }: {
  item?: InventoryItem
  isAdmin: boolean
  allCategories: InventoryCategory[]
  itemCounts: Record<string, number>
  defaultCategory?: string
  onCreateCategory?: (name: string) => Promise<void>
  onRenameCategory?: (id: number, oldName: string, newName: string, updateItems: boolean) => Promise<void>
  onDeleteCategory?: (id: number) => Promise<void>
  onClose: () => void
  onSave: (data: Partial<InventoryItem>) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    item?.categories ?? (defaultCategory ? [defaultCategory] : [])
  )
  const [quantity, setQuantity] = useState(item?.quantity ?? '')
  const [quantityHave, setQuantityHave] = useState(item?.quantity_have ?? '')
  const [status, setStatus] = useState<InventoryItem['status']>(item?.status ?? 'needed')
  const [responsibleParty, setResponsibleParty] = useState(item?.responsible_party ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [sortOrder, setSortOrder] = useState<string>(item?.sort_order != null ? String(item.sort_order) : '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [manageCatsOpen, setManageCatsOpen] = useState(false)
  const [addCatOpen, setAddCatOpen] = useState(false)
  const [newCatText, setNewCatText] = useState('')
  const [showAddTimeline, setShowAddTimeline] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleAddCat() {
    const t = newCatText.trim()
    if (!t) return
    await onCreateCategory?.(t)
    setSelectedCategories(prev => prev.includes(t) ? prev : [...prev, t])
    setNewCatText('')
    setAddCatOpen(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const parsed = sortOrder !== '' ? parseInt(sortOrder, 10) : undefined
    await onSave({
      name: name.trim(),
      categories: selectedCategories,
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

          {/* Categories */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#b8d0ba' }}>Categories</p>
              {isAdmin && onRenameCategory && (
                <button type="button" onClick={() => setManageCatsOpen(true)} className="text-xs font-medium" style={{ color: '#9db89f' }}>
                  Manage
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedCategories.map(cat => (
                <button key={cat} type="button"
                  onClick={() => setSelectedCategories(prev => prev.filter(c => c !== cat))}
                  className="text-sm font-medium rounded-full px-3 py-1.5 flex items-center gap-1.5"
                  style={{ backgroundColor: '#7a9e7e', color: '#fff' }}
                >
                  {cat} <span style={{ opacity: 0.7, fontSize: 15, lineHeight: 1 }}>×</span>
                </button>
              ))}
              <button type="button" onClick={() => setAddCatOpen(p => !p)}
                className="text-sm font-medium rounded-full px-3 py-1.5"
                style={{ backgroundColor: '#f5f7f5', color: '#9db89f', border: '1px dashed #c8d8c8' }}
              >
                {addCatOpen ? '− Close' : '+ Add category'}
              </button>
            </div>
            {addCatOpen && (
              <div className="space-y-2 pt-1">
                {allCategories.filter(cat => !selectedCategories.includes(cat.name)).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {allCategories.filter(cat => !selectedCategories.includes(cat.name)).map(cat => (
                      <button key={cat.id} type="button"
                        onClick={() => setSelectedCategories(prev => [...prev, cat.name])}
                        className="text-sm font-medium rounded-full px-3 py-1.5 transition-colors"
                        style={{ backgroundColor: '#e8f0e8', color: '#5a7d5e' }}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={newCatText}
                    onChange={e => setNewCatText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newCatText.trim()) handleAddCat() }}
                    placeholder="New category name"
                    autoFocus
                    className="flex-1 min-w-0 rounded-xl px-4 text-sm focus:outline-none"
                    style={{ border: '1px solid #b8d0ba', color: '#2d4a30', minHeight: 44 }}
                  />
                  <button type="button" onClick={handleAddCat} disabled={!newCatText.trim()}
                    className="rounded-xl px-4 text-sm font-medium text-white"
                    style={{ backgroundColor: '#7a9e7e', opacity: newCatText.trim() ? 1 : 0.45, minHeight: 44 }}>
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              value={quantityHave}
              onChange={e => setQuantityHave(e.target.value)}
              placeholder="Have so far"
              className="flex-1 min-w-0 rounded-2xl px-4 py-3 text-sm focus:outline-none"
              style={{ border: '1px solid #d8e8d8', color: '#2d4a30', backgroundColor: '#f5f7f5' }}
            />
            <input
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="Total needed"
              className="flex-1 min-w-0 rounded-2xl px-4 py-3 text-sm focus:outline-none"
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
            <option value="partial">In Progress</option>
            <option value="acquired">Done</option>
          </select>
          <div className="flex gap-2">
            <input
              value={responsibleParty}
              onChange={e => setResponsibleParty(e.target.value)}
              placeholder="Responsible party (optional)"
              className="flex-1 min-w-0 rounded-2xl px-4 py-3 text-sm focus:outline-none"
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

          {item && (
            <button
              type="button"
              onClick={() => setShowAddTimeline(true)}
              className="w-full rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ backgroundColor: '#e8f0e8', color: '#5a7d5e', minHeight: 48 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Add to Timeline
            </button>
          )}

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

      {manageCatsOpen && (
        <CategoryPickerSheet
          categories={allCategories}
          itemCounts={itemCounts}
          value=''
          onSelect={cat => {
            if (cat) {
              setSelectedCategories(prev =>
                prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
              )
            }
            setManageCatsOpen(false)
          }}
          onCreateCategory={onCreateCategory}
          onRenameCategory={onRenameCategory ? async (id, oldName, newName, ui) => {
            await onRenameCategory(id, oldName, newName, ui)
            setSelectedCategories(prev => prev.map(c => c === oldName ? newName : c))
          } : undefined}
          onDeleteCategory={onDeleteCategory ? async (id) => {
            const cat = allCategories.find(c => c.id === id)
            await onDeleteCategory(id)
            if (cat) setSelectedCategories(prev => prev.filter(c => c !== cat.name))
          } : undefined}
          onClose={() => setManageCatsOpen(false)}
        />
      )}

      {showAddTimeline && item && (
        <AddToTimelineSheet
          title={item.name}
          inventoryId={item.id}
          type="inventory"
          onClose={() => setShowAddTimeline(false)}
        />
      )}
    </div>
  )
}

// ── Category picker sheet ────────────────────────────────────────────────────

const SUGGESTED_CATEGORIES = [
  'Flowers', 'Decorations', 'Catering', 'Drinks', 'Clothing',
  'Photography', 'Videography', 'Stationery', 'Entertainment',
  'Beauty & Hair', 'Favours', 'Transport', 'Venue', 'Accommodation',
  'Jewellery', 'Cake', 'Gifts', 'Lighting',
]

function CategoryPickerSheet({ categories, itemCounts, value, onSelect, onCreateCategory, onRenameCategory, onDeleteCategory, onClose }: {
  categories: InventoryCategory[]
  itemCounts: Record<string, number>
  value: string
  onSelect: (cat: string) => void
  onCreateCategory?: (name: string) => Promise<void>
  onRenameCategory?: (id: number, oldName: string, newName: string, updateItems: boolean) => Promise<void>
  onDeleteCategory?: (id: number) => Promise<void>
  onClose: () => void
}) {
  const [newCatText, setNewCatText] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [updateItems, setUpdateItems] = useState(true)
  const [editSaving, setEditSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const categoryNames = categories.map(c => c.name)
  const suggestions = SUGGESTED_CATEGORIES.filter(s => !categoryNames.includes(s))

  async function handleAdd() {
    const trimmed = newCatText.trim()
    if (!trimmed) return
    setNewCatText('')
    await onCreateCategory?.(trimmed)
    onSelect(trimmed)
  }

  function startEdit(cat: InventoryCategory) {
    setEditingId(cat.id)
    setEditName(cat.name)
    setUpdateItems(true)
    setConfirmDeleteId(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setConfirmDeleteId(null)
  }

  async function saveEdit(cat: InventoryCategory) {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === cat.name) { cancelEdit(); return }
    setEditSaving(true)
    await onRenameCategory?.(cat.id, cat.name, trimmed, updateItems)
    setEditSaving(false)
    setEditingId(null)
    if (value === cat.name) onSelect(trimmed)
  }

  async function handleDelete(cat: InventoryCategory) {
    await onDeleteCategory?.(cat.id)
    setConfirmDeleteId(null)
    setEditingId(null)
    if (value === cat.name) onSelect('')
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center z-[60]"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-t-3xl w-full max-w-lg shadow-2xl flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-9 h-1.5 rounded-full" style={{ backgroundColor: '#d8e8d8' }} />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 shrink-0">
          <h3 className="font-semibold text-base" style={{ color: '#2d4a30' }}>Category</h3>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-full text-xl"
            style={{ color: '#9db89f', backgroundColor: '#f0f4f0' }}>×</button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="px-4 pt-2 pb-3" style={{ borderBottom: '1px solid #f0f4f0' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#b8d0ba' }}>Suggestions</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map(s => (
                  <button key={s} type="button"
                    onClick={async () => { await onCreateCategory?.(s); onSelect(s) }}
                    className="text-sm font-medium rounded-full px-3 py-1 transition-colors"
                    style={{ backgroundColor: '#e8f0e8', color: '#5a7d5e' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clear option */}
          {value && (
            <button type="button" onClick={() => onSelect('')}
              className="w-full flex items-center justify-between px-5 text-sm"
              style={{ minHeight: 52, color: '#c0607a', borderTop: '1px solid #f0f4f0' }}>
              <span>No category</span>
            </button>
          )}

          {/* Category rows */}
          {categories.map(cat => {
            const isEditing = editingId === cat.id
            const nameChanged = editName.trim() !== cat.name && editName.trim() !== ''
            const count = itemCounts[cat.name] ?? 0

            if (isEditing) {
              return (
                <div key={cat.id} className="px-4 py-3 space-y-2" style={{ borderTop: '1px solid #f0f4f0', backgroundColor: '#fafcfa' }}>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(cat); if (e.key === 'Escape') cancelEdit() }}
                    autoFocus
                    className="w-full rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none"
                    style={{ border: '1px solid #b8d0ba', color: '#2d4a30', backgroundColor: '#fff' }}
                  />

                  {nameChanged && count > 0 && (
                    <button type="button" onClick={() => setUpdateItems(v => !v)}
                      className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-left"
                      style={{ border: '1px solid #e4ede4', backgroundColor: '#fff' }}>
                      <span className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                        style={{ backgroundColor: updateItems ? '#7a9e7e' : '#fff', border: updateItems ? 'none' : '2px solid #b8d0ba' }}>
                        {updateItems && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span style={{ color: '#5a7d5e' }}>
                        Also rename {count} item{count !== 1 ? 's' : ''}
                      </span>
                    </button>
                  )}

                  {confirmDeleteId === cat.id ? (
                    <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: '#fce8ef', border: '1px solid #f0b8c8' }}>
                      <p className="text-xs font-semibold text-center" style={{ color: '#2d4a30' }}>
                        Delete "{cat.name}"?{count > 0 ? ` ${count} item${count !== 1 ? 's' : ''} become uncategorized.` : ''}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="flex-1 rounded-xl text-xs font-semibold"
                          style={{ backgroundColor: '#fff', color: '#9db89f', minHeight: 36, border: '1px solid #e4ede4' }}>
                          Cancel
                        </button>
                        <button onClick={() => handleDelete(cat)}
                          className="flex-1 rounded-xl text-xs font-semibold text-white"
                          style={{ backgroundColor: '#c0607a', minHeight: 36 }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={cancelEdit}
                        className="rounded-xl px-3 text-xs font-semibold"
                        style={{ backgroundColor: '#f0f4f0', color: '#9db89f', minHeight: 36 }}>
                        Cancel
                      </button>
                      <button onClick={() => saveEdit(cat)} disabled={editSaving}
                        className="flex-1 rounded-xl text-xs font-semibold text-white"
                        style={{ backgroundColor: '#7a9e7e', opacity: editSaving ? 0.5 : 1, minHeight: 36 }}>
                        {editSaving ? 'Saving…' : 'Save'}
                      </button>
                      {onDeleteCategory && (
                        <button onClick={() => setConfirmDeleteId(cat.id)}
                          className="rounded-xl px-3 text-xs font-semibold"
                          style={{ backgroundColor: '#fce8ef', color: '#c0607a', minHeight: 36 }}>
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div key={cat.id} className="flex items-center" style={{ borderTop: '1px solid #f0f4f0' }}>
                <button type="button" onClick={() => onSelect(cat.name)}
                  className="flex-1 flex items-center justify-between px-5 text-sm"
                  style={{ minHeight: 52, color: value === cat.name ? '#7a9e7e' : '#2d4a30', fontWeight: value === cat.name ? 600 : 400 }}>
                  <span>{cat.name}</span>
                  {value === cat.name && (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M3.75 9l3.75 3.75 6.75-7.5" stroke="#7a9e7e" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                {onRenameCategory && (
                  <button type="button" onClick={() => startEdit(cat)}
                    className="flex items-center justify-center gap-1 pr-4 pl-1 shrink-0 text-xs font-medium"
                    style={{ color: '#9db89f', minHeight: 52 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                  </button>
                )}
              </div>
            )
          })}

          {/* New category */}
          <div style={{ borderTop: '1px solid #d8e8d8' }}>
            <div className="px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#b8d0ba' }}>New category</p>
              <div className="flex gap-2">
                <input
                  value={newCatText}
                  onChange={e => setNewCatText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && newCatText.trim() && handleAdd()}
                  placeholder="Category name"
                  className="flex-1 rounded-xl px-4 text-sm focus:outline-none"
                  style={{ border: '1px solid #b8d0ba', color: '#2d4a30', minHeight: 48 }}
                />
                <button type="button" onClick={handleAdd} disabled={!newCatText.trim()}
                  className="rounded-xl px-5 text-sm font-medium text-white"
                  style={{ backgroundColor: '#7a9e7e', opacity: newCatText.trim() ? 1 : 0.45, minHeight: 48 }}>
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
      </div>
    </div>
  )
}
