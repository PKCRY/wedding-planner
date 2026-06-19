ALTER TABLE inventory ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS quantity_have text NOT NULL DEFAULT '';

UPDATE tasks SET due_date = '2026-06-30' WHERE due_date < '2026-06-01' AND due_date IS NOT NULL;
