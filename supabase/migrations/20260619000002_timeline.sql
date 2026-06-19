CREATE TABLE IF NOT EXISTS timeline_items (
  id              bigserial    PRIMARY KEY,
  day_date        date         NOT NULL,
  time_slot       text         NOT NULL DEFAULT '',
  title           text         NOT NULL DEFAULT '',
  notes           text         NOT NULL DEFAULT '',
  type            text         NOT NULL DEFAULT 'note',
  task_id         bigint,
  inventory_id    bigint,
  created_by      text         NOT NULL DEFAULT '',
  created_at      timestamptz  NOT NULL DEFAULT now(),
  sort_order      integer      NOT NULL DEFAULT 999
);
ALTER TABLE timeline_items DISABLE ROW LEVEL SECURITY;
