-- Run in Supabase SQL Editor after schema.sql

-- Add new columns to tasks
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS sort_order   integer      NOT NULL DEFAULT 999,
  ADD COLUMN IF NOT EXISTS blocked_by   text         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category     text         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS responsible_party    text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS important_contacts   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completed_date       date,
  ADD COLUMN IF NOT EXISTS task_comments        jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Rename fiance → siobhan in existing data
UPDATE tasks SET assigned_to = 'siobhan' WHERE assigned_to = 'fiance';

-- Calendar events table
CREATE TABLE IF NOT EXISTS events (
  id          bigserial    PRIMARY KEY,
  title       text         NOT NULL,
  date        date         NOT NULL,
  description text         NOT NULL DEFAULT '',
  created_by  text         NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now()
);
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
