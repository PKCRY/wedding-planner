CREATE TABLE IF NOT EXISTS categories (
  id         bigserial    PRIMARY KEY,
  name       text         NOT NULL,
  context    text         NOT NULL DEFAULT 'task',
  sort_order integer      NOT NULL DEFAULT 999,
  created_at timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(name, context)
);
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
