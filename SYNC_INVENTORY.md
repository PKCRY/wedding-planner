# Syncing Inventory from Excel

## What it does

`scripts/sync-inventory.py` reads **Data/Wedding To-Do Lists (1).xlsx → "All Inventory" sheet** and upserts into Supabase prod. It never deletes existing rows.

- **Updates** existing items (matched by name, exact or fuzzy ≥ 82% similarity)
- **Inserts** new items not found in the DB
- **Upserts** categories into `inventory_categories` table

## Column mapping

| Excel column | DB field |
|---|---|
| Category (col A, merged) | `category` |
| Status (col B) | `status` (see map below) |
| Item (col C) | `name` |
| Have / Needed (col D) | `quantity_have` / `quantity` |
| Responsible Party (col E) | `responsible_party` |
| Notes (col F) | `notes` |

**Status map:**

| Excel | DB value |
|---|---|
| Have | `acquired` |
| Don't Have | `needed` |
| In Process | `partial` |
| (blank) | `needed` |

## How to run

```bash
# Dry run — preview changes, no writes
python3 scripts/sync-inventory.py --dry-run

# Live run — writes to prod Supabase
python3 scripts/sync-inventory.py
```

Requires `.env.local` at project root with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## When to re-run

Any time the Excel sheet changes — add items, update statuses, change quantities, fix notes. Just re-run the script. Existing rows get updated in place; new rows get added.

## Fuzzy matching

Items are matched case-insensitively (trailing spaces, `?` stripped). If no exact match, difflib similarity ≥ 0.82 is used. Fuzzy matches print the ratio so you can audit them:

```
UPDATE (≈0.94): "Green tablecloths" → data from "Green tablecoth"
```

If a match looks wrong, rename the item in the DB to match the Excel exactly, then re-run.

## Adding a new Excel file version

1. Place the new file in `Data/` (e.g. `Wedding To-Do Lists (2).xlsx`)
2. Update the `xlsx_path` line in `scripts/sync-inventory.py`:
   ```python
   xlsx_path = os.path.join(..., 'Data', 'Wedding To-Do Lists (2).xlsx')
   ```
3. Run dry-run, verify output, then run live.

## Last sync

- **Date:** 2026-06-19
- **Source:** `Data/Wedding To-Do Lists (1).xlsx`
- **Result:** 51 updated, 97 inserted, 12 categories created
