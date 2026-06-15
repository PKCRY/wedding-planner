#!/usr/bin/env python3
"""
Seed Supabase with tasks from Data/Wedding To-Do Lists.xlsx.
Run from project root: python3 scripts/seed-tasks.py

Color mapping:
  FF00FF00 (green)  → done
  FFFFFF00 (yellow) → in_progress
  FFFF0000 (red)    → pending
  no color          → pending
"""
import json, os, re, sys
import openpyxl
import urllib.request

# Load .env.local (optional — falls back to env vars already set in shell)
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            m = re.match(r'^([A-Z_]+)="?([^"\n]*)"?', line.strip())
            if m:
                os.environ.setdefault(m.group(1), m.group(2))

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']

HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
}

def req(method, path, body=None):
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()

def color_to_status(rgb):
    if rgb == 'FF00FF00':
        return 'done'
    if rgb == 'FFFFFF00':
        return 'in_progress'
    return 'pending'

def responsible_to_assigned(responsible):
    if not responsible:
        return 'both'
    r = responsible.lower()
    has_nick = 'nick' in r
    has_siobhan = 'siobhan' in r or 'siobahn' in r
    if has_nick and not has_siobhan:
        return 'nick'
    if has_siobhan and not has_nick:
        return 'siobhan'
    return 'both'

# Parse xlsx
xlsx_path = os.path.join(os.path.dirname(__file__), '..', 'Data', 'Wedding To-Do Lists.xlsx')
wb = openpyxl.load_workbook(xlsx_path)
ws = wb['All Tasks']

tasks = []
current_category = None
sort_order = 1

for row in ws.iter_rows(min_row=2):
    vals = [c.value for c in row[:6]]
    if not any(vals):
        continue

    rgb = '00000000'
    fill = row[0].fill
    if fill and fill.fgColor and fill.fgColor.type != 'none':
        rgb = fill.fgColor.rgb or '00000000'

    if vals[1]:
        current_category = str(vals[1]).strip()

    task_title = str(vals[2]).strip() if vals[2] else None
    if not task_title:
        continue

    status = color_to_status(rgb)
    tasks.append({
        'title':               task_title,
        'description':         '',
        'category':            current_category or '',
        'assigned_to':         responsible_to_assigned(vals[4]),
        'responsible_party':   str(vals[4]).strip() if vals[4] else '',
        'important_contacts':  str(vals[5]).strip() if vals[5] else '',
        'status':              status,
        'priority':            'medium',
        'sort_order':          sort_order,
        'due_date':            None,
        'completed_date':      None,
        'blocked_by':          '',
        'task_comments':       [],
        'completed_by':        '',
        'created_by':          'import',
    })
    sort_order += 1

# Dedupe by lowercase title (keep first)
seen = set()
unique = []
for t in tasks:
    key = t['title'].lower()
    if key not in seen:
        seen.add(key)
        unique.append(t)

print(f'{len(tasks)} rows → {len(unique)} unique tasks')

# Delete existing imported tasks (created_by = 'import') or all tasks
print('Clearing existing tasks...')
status, body = req('DELETE', 'tasks?id=gte.0')
print(f'  DELETE tasks: {status}')

# Insert in batches of 50
batch_size = 50
for i in range(0, len(unique), batch_size):
    batch = unique[i:i+batch_size]
    status, body = req('POST', 'tasks', batch)
    if status not in (200, 201):
        print(f'Error at batch {i}: {status} {body.decode()}')
        sys.exit(1)
    print(f'  Inserted rows {i+1}–{min(i+batch_size, len(unique))}')

print('Done!')
