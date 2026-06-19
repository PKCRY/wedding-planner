ALTER TABLE inventory ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS inventory_categories (
  id         bigserial    PRIMARY KEY,
  name       text         NOT NULL UNIQUE,
  sort_order integer      NOT NULL DEFAULT 999,
  created_at timestamptz  NOT NULL DEFAULT now()
);
ALTER TABLE inventory_categories DISABLE ROW LEVEL SECURITY;
