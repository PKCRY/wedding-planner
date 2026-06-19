-- Secondary category for inventory items (item can appear in 2 categories)
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS secondary_category text NOT NULL DEFAULT '';
