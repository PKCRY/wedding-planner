-- Run this ONCE in Supabase SQL Editor:
-- supabase.com → your project → SQL Editor → paste → Run

-- ── Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id                 bigserial    PRIMARY KEY,
  title              text         NOT NULL,
  description        text         NOT NULL DEFAULT '',
  category           text         NOT NULL DEFAULT '',
  assigned_to        text         NOT NULL DEFAULT 'both',
  status             text         NOT NULL DEFAULT 'pending',
  priority           text         NOT NULL DEFAULT 'medium',
  sort_order         integer      NOT NULL DEFAULT 999,
  due_date           date,
  completed_date     date,
  blocked_by         text         NOT NULL DEFAULT '',
  responsible_party  text         NOT NULL DEFAULT '',
  important_contacts text         NOT NULL DEFAULT '',
  task_comments      jsonb        NOT NULL DEFAULT '[]'::jsonb,
  created_at         timestamptz  NOT NULL DEFAULT now(),
  created_by         text         NOT NULL DEFAULT 'import'
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           bigserial    PRIMARY KEY,
  user_id      text         NOT NULL UNIQUE,
  subscription jsonb        NOT NULL,
  updated_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id          bigserial    PRIMARY KEY,
  title       text         NOT NULL,
  date        date         NOT NULL,
  description text         NOT NULL DEFAULT '',
  created_by  text         NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

-- ── Disable RLS (auth handled by iron-session) ─────────────────────────────

ALTER TABLE tasks              DISABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE events             DISABLE ROW LEVEL SECURITY;

-- ── Add any missing columns if upgrading an existing DB ───────────────────

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS sort_order         integer NOT NULL DEFAULT 999,
  ADD COLUMN IF NOT EXISTS blocked_by         text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category           text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS responsible_party  text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS important_contacts text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completed_date     date,
  ADD COLUMN IF NOT EXISTS completed_by       text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS task_comments      jsonb   NOT NULL DEFAULT '[]'::jsonb;

-- ── Migrate old field value if upgrading ──────────────────────────────────

UPDATE tasks SET assigned_to = 'siobhan' WHERE assigned_to = 'fiance';

-- ── Inventory ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory (
  id                bigserial    PRIMARY KEY,
  name              text         NOT NULL,
  quantity          text         NOT NULL DEFAULT '',
  status            text         NOT NULL DEFAULT 'needed'
                                 CHECK (status IN ('needed', 'partial', 'acquired')),
  responsible_party text         NOT NULL DEFAULT '',
  notes             text         NOT NULL DEFAULT '',
  sort_order        integer      NOT NULL DEFAULT 999,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  created_by        text         NOT NULL DEFAULT ''
);
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
