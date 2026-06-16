-- Track when status last changed, for stale "working on" reminders
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;
