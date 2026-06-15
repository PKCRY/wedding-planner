-- DEPRECATED: use setup.sql instead — it is the canonical, idempotent setup script.
-- This file is kept for historical reference only.

create table if not exists tasks (
  id          bigserial primary key,
  title       text not null,
  description text not null default '',
  assigned_to text not null default 'both',
  status      text not null default 'pending',
  priority    text not null default 'medium',
  due_date    date,
  created_at  timestamptz not null default now(),
  created_by  text not null
);

create table if not exists push_subscriptions (
  id           bigserial primary key,
  user_id      text not null unique,
  subscription jsonb not null,
  updated_at   timestamptz not null default now()
);

alter table tasks              disable row level security;
alter table push_subscriptions disable row level security;
