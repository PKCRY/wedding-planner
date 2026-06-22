import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-key'
)

export interface TaskComment {
  user: string
  name: string
  text: string
  at: string
}

export interface Task {
  id: number
  title: string
  description: string
  category: string
  assigned_to: string
  status: 'pending' | 'in_progress' | 'done' | 'blocked'
  status_changed_at: string | null
  priority: 'low' | 'medium' | 'high'
  sort_order: number
  due_date: string | null
  completed_date: string | null
  completed_by: string
  blocked_by: string
  responsible_party: string
  important_contacts: string
  task_comments: TaskComment[]
  share_note: string
  created_at: string
  created_by: string
  share_token: string
}

export interface Event {
  id: number
  title: string
  date: string
  description: string
  created_by: string
  created_at: string
}

export interface InventoryItem {
  id: number
  name: string
  categories: string[]
  quantity: string
  quantity_have: string
  status: 'needed' | 'partial' | 'acquired'
  responsible_party: string
  notes: string
  sort_order: number
  created_at: string
  created_by: string
}

export interface InventoryCategory {
  id: number
  name: string
  sort_order: number
  created_at: string
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
}
