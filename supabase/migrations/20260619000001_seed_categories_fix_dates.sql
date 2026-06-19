-- Ensure category column exists before seeding
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '';

-- Seed inventory_categories from existing item category strings
INSERT INTO inventory_categories (name)
SELECT DISTINCT TRIM(category) FROM inventory WHERE TRIM(category) != ''
ON CONFLICT (name) DO NOTHING;

-- Move all pre-June due dates to end of June
UPDATE tasks SET due_date = '2026-06-30' WHERE due_date < '2026-06-01' AND due_date IS NOT NULL;
