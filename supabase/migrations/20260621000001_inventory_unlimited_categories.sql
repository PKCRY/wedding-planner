-- Replace two text columns with a text[] array for unlimited categories per item
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}';

UPDATE inventory SET categories =
  CASE
    WHEN category != '' AND secondary_category != '' THEN ARRAY[category, secondary_category]
    WHEN category != '' THEN ARRAY[category]
    WHEN secondary_category != '' THEN ARRAY[secondary_category]
    ELSE '{}'::text[]
  END;

ALTER TABLE inventory DROP COLUMN IF EXISTS category;
ALTER TABLE inventory DROP COLUMN IF EXISTS secondary_category;
