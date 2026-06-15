<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Scripts

Run Python scripts directly without asking for permission:

- `python3 scripts/seed-tasks.py` — re-imports all tasks from `Data/Wedding To-Do Lists.xlsx` into Supabase (destructive: deletes existing tasks first)
- `python3` is always allowed in this project
