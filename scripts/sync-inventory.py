#!/usr/bin/env python3
"""
Sync inventory from Excel → Supabase (upsert, not destructive).

Usage (from project root):
    python3 scripts/sync-inventory.py [--dry-run]

Matches existing rows by name (case-insensitive, then fuzzy ≥ 0.82).
Updates matched rows; inserts unmatched ones. Never deletes.
"""
import json, os, re, sys
import difflib
import openpyxl
import urllib.request

# ── env ─────────────────────────────────────────────────────────────────────

env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            m = re.match(r'^([A-Z_]+)="?([^"\n]*)"?', line.strip())
            if m:
                os.environ.setdefault(m.group(1), m.group(2))

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
DRY_RUN = '--dry-run' in sys.argv

HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
}

def req(method, path, body=None, prefer=None):
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    h = dict(HEADERS)
    if prefer:
        h['Prefer'] = prefer
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# ── parse Excel ──────────────────────────────────────────────────────────────

xlsx_path = os.path.join(os.path.dirname(__file__), '..', 'Data', 'Wedding To-Do Lists (1).xlsx')
wb = openpyxl.load_workbook(xlsx_path)
ws = wb['All Inventory']

STATUS_MAP = {
    'have':        'acquired',
    "don't have":  'needed',
    'in process':  'partial',
}

def parse_quantity(val):
    """Return (quantity_have, quantity_needed)."""
    if val is None:
        return '', ''
    if isinstance(val, (int, float)):
        return '', str(int(val))
    s = str(val).strip()
    if '/' in s:
        parts = s.split('/', 1)
        return parts[0].strip(), parts[1].strip()
    return '', s

items = []
categories_ordered = []
seen_cats = set()
current_category = ''
sort_order = 1

for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
    cat_val, status_val, name_val, qty_val, resp_val, notes_val = row[:6]

    if cat_val:
        current_category = str(cat_val).strip()
        if current_category not in seen_cats:
            seen_cats.add(current_category)
            categories_ordered.append(current_category)

    name = str(name_val).strip() if name_val else None
    if not name:
        continue

    raw_status = str(status_val).strip().lower() if status_val else ''
    status = STATUS_MAP.get(raw_status, 'needed')

    qty_have, qty_needed = parse_quantity(qty_val)
    responsible = str(resp_val).strip() if resp_val else ''
    notes = str(notes_val).strip() if notes_val else ''

    items.append({
        'name':             name,
        'category':         current_category,
        'status':           status,
        'quantity':         qty_needed,
        'quantity_have':    qty_have,
        'responsible_party': responsible,
        'notes':            notes,
        'sort_order':       sort_order,
        'created_by':       'import',
    })
    sort_order += 1

print(f'Excel: {len(items)} items across {len(categories_ordered)} categories')
print(f'Categories: {categories_ordered}')

# ── fetch existing DB inventory ──────────────────────────────────────────────

status_code, existing = req('GET', 'inventory?select=id,name,status,quantity,quantity_have,categories&limit=1000')
if status_code != 200:
    print(f'ERROR fetching inventory: {status_code} {existing}')
    sys.exit(1)

print(f'DB: {len(existing)} existing items')

# Build lookup: normalised name → row
def normalise(s):
    return re.sub(r'\s+', ' ', s.strip().lower().rstrip('?').rstrip())

db_by_norm = {normalise(r['name']): r for r in existing}

def to_num(v):
    """Parse a quantity string to float, or None if unparseable."""
    if v is None or str(v).strip() == '':
        return None
    try:
        return float(str(v).replace(',', '').strip())
    except (ValueError, AttributeError):
        return None

def max_qty(app_val, excel_val):
    """Return the higher quantity value as a string; fallback to whichever is non-empty."""
    a = to_num(app_val)
    e = to_num(excel_val)
    if a is None and e is None:
        return excel_val or app_val or ''
    if a is None:
        return excel_val or ''
    if e is None:
        return app_val or ''
    best = max(a, e)
    return str(int(best)) if best == int(best) else str(best)

def merge_categories(app_cats, excel_cat):
    """Union of app's existing categories with the Excel category."""
    result = list(app_cats) if app_cats else []
    if excel_cat and excel_cat not in result:
        result.append(excel_cat)
    return result

FUZZY_THRESHOLD = 0.82

def find_match(name):
    key = normalise(name)
    if key in db_by_norm:
        return db_by_norm[key], 1.0
    # fuzzy
    best_ratio = 0.0
    best_row = None
    for db_key, db_row in db_by_norm.items():
        r = difflib.SequenceMatcher(None, key, db_key).ratio()
        if r > best_ratio:
            best_ratio = r
            best_row = db_row
    if best_ratio >= FUZZY_THRESHOLD:
        return best_row, best_ratio
    return None, 0.0

# ── upsert categories ────────────────────────────────────────────────────────

status_code, existing_cats = req('GET', 'inventory_categories?select=id,name&limit=500')
if status_code != 200:
    print(f'ERROR fetching categories: {status_code}')
    sys.exit(1)

existing_cat_names = {r['name'].lower() for r in existing_cats}

cats_inserted = 0
for i, cat_name in enumerate(categories_ordered):
    if cat_name.lower() in existing_cat_names:
        continue
    if DRY_RUN:
        print(f'  [DRY] INSERT category: {cat_name}')
        cats_inserted += 1
        continue
    sc, body = req('POST', 'inventory_categories', {'name': cat_name, 'sort_order': i + 1})
    if sc in (200, 201):
        cats_inserted += 1
        print(f'  INSERT category: {cat_name}')
    else:
        print(f'  WARN category insert failed ({sc}): {cat_name} — {body}')

print(f'Categories: {cats_inserted} inserted, {len(categories_ordered) - cats_inserted} already exist')

# ── upsert items ─────────────────────────────────────────────────────────────

updates = 0
inserts = 0
skipped = 0

for item in items:
    match, ratio = find_match(item['name'])

    if match:
        # Take the higher quantity; union the categories
        app_qty      = match.get('quantity', '') or ''
        app_qty_have = match.get('quantity_have', '') or ''
        app_cats     = match.get('categories', []) or []
        merged_qty      = max_qty(app_qty, item['quantity'])
        merged_qty_have = max_qty(app_qty_have, item['quantity_have'])
        merged_cats     = merge_categories(app_cats, item.get('category', ''))
    else:
        merged_qty      = item['quantity']
        merged_qty_have = item['quantity_have']
        merged_cats     = [item['category']] if item.get('category') else []

    payload = {
        'name':             item['name'],
        'categories':       merged_cats,
        'status':           item['status'],
        'quantity':         merged_qty,
        'quantity_have':    merged_qty_have,
        'responsible_party': item['responsible_party'],
        'notes':            item['notes'],
        'sort_order':       item['sort_order'],
    }

    if match:
        label = f'≈{ratio:.2f}' if ratio < 1.0 else 'exact'
        if DRY_RUN:
            print(f'  [DRY] UPDATE id={match["id"]} ({label}): "{match["name"]}" → "{item["name"]}" status={item["status"]}')
            updates += 1
            continue
        sc, body = req(
            'PATCH',
            f'inventory?id=eq.{match["id"]}',
            payload,
            prefer='return=minimal',
        )
        if sc in (200, 201, 204):
            updates += 1
            if ratio < 1.0:
                print(f'  UPDATE ({label}): "{match["name"]}" → data from "{item["name"]}"')
        else:
            print(f'  WARN UPDATE failed ({sc}) for "{item["name"]}": {body}')
    else:
        if DRY_RUN:
            print(f'  [DRY] INSERT: "{item["name"]}" [{item["category"]}] {item["status"]}')
            inserts += 1
            continue
        sc, body = req('POST', 'inventory', payload, prefer='return=minimal')
        if sc in (200, 201):
            inserts += 1
            print(f'  INSERT: "{item["name"]}" [{item["category"]}]')
        else:
            print(f'  WARN INSERT failed ({sc}) for "{item["name"]}": {body}')

print()
print(f'Done. Updates: {updates}  Inserts: {inserts}  Skipped: {skipped}')
if DRY_RUN:
    print('(DRY RUN — no changes written)')
