#!/usr/bin/env python3
"""
Patch due_date on existing tasks based on 'Tasks by month' sheet.
Only touches due_date — no other fields are modified.
Run from project root: python3 scripts/set-due-dates.py
"""
import json, os, re
import openpyxl
import urllib.request

# Load .env.local
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
}

def req(method, path, body=None):
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return e.code, e.read()

MONTH_DATES = {
    '3 March':  '2026-03-31',
    '4 April':  '2026-04-30',
    '5 May':    '2026-05-31',
    '6 June':   '2026-06-30',
    '7 July':   '2026-07-31',
    '8 August': '2026-08-31',
}

# Read month→title mapping from Excel
xlsx_path = os.path.join(os.path.dirname(__file__), '..', 'Data', 'Wedding To-Do Lists.xlsx')
wb = openpyxl.load_workbook(xlsx_path)
ws = wb['Tasks by month']

# key: normalised title → due_date string
title_to_due: dict[str, str] = {}
for row in ws.iter_rows(min_row=2, values_only=True):
    month_code = row[0]
    title = row[3]
    if not title or not month_code:
        continue
    due_date = MONTH_DATES.get(str(month_code).strip())
    if due_date:
        key = ' '.join(str(title).strip().lower().split())
        title_to_due[key] = due_date

print(f'Loaded {len(title_to_due)} title→month mappings from Excel')

# Fetch all tasks
status, tasks = req('GET', 'tasks?select=id,title&limit=2000&order=sort_order.asc')
if status != 200 or not isinstance(tasks, list):
    print(f'Failed to fetch tasks: {status} {tasks}')
    exit(1)

print(f'Fetched {len(tasks)} tasks from DB\n')

updated = 0
skipped = []

for task in tasks:
    raw_title = task['title'] or ''
    key = ' '.join(raw_title.strip().lower().split())
    due_date = title_to_due.get(key)
    if due_date:
        s, _ = req('PATCH', f'tasks?id=eq.{task["id"]}', {'due_date': due_date})
        if s in (200, 204):
            updated += 1
            print(f'  ✓ [{due_date}] {raw_title}')
        else:
            print(f'  ✗ Error {s} on: {raw_title}')
    else:
        skipped.append(raw_title)

print(f'\n✓ Updated {updated} tasks')
if skipped:
    print(f'\nNo month mapping for {len(skipped)} tasks (due_date unchanged):')
    for t in skipped:
        print(f'  · {t}')
