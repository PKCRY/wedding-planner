# Wedding Planner — Build Notes

## What's Done

### App
- Full Next.js PWA with Supabase backend
- Auth: Nick (admin) and Siobhan (member) login
- Tasks stored in Supabase with priority, status, due date, assigned_to, comments, contacts
- Push notifications via web push (VAPID) — subscribe/unsubscribe in settings
- Calendar tab with events (add/delete)
- Service worker for offline/installable PWA

### Nick's Dashboard (`/dashboard`)
- Full task list: active + completed tabs
- Filter by assignee (All / Mine / Hers / Both)
- Color-coded left border bar: green=done, yellow=in progress, pink=pending, red=blocked
- Create / edit / delete tasks
- Cycle status with ↻ button
- Send push notification to Siobhan from dashboard
- Sidebar calendar on desktop

### Siobhan's Dashboard (`/her-dashboard`)
- Top 5 active tasks, auto-refreshes after marking done
- Color-coded right border bar (same color system)
- Centered text, clean mobile layout — no status labels, no Start button
- Tap card → detail modal
- Mark Done requires two-step confirm ("Are you sure this is complete?")
- Notes/comments on each task
- Calendar tab

### PWA / Icons
- Generated all icon sizes from `images/Wedding logo final.png`
- `apple-touch-icon.png` 180×180 — Safari Add to Home Screen
- `icon-192.png` / `icon-512.png` — PWA manifest
- `icon-maskable-192.png` / `icon-maskable-512.png` — Android adaptive icons (20% safe zone)
- `favicon.ico` (16/32/48 RGBA), `favicon-16x16.png`, `favicon-32x32.png`
- `manifest.json` updated with all sizes and purposes

---

## Next Up

- [ ] Test everything end-to-end
- [ ] Deploy and share link with Siobhan
- [ ] Confirm task priority works by sort order
- [ ] Configure and test push notifications for both users
- [ ] Add messaging/note for Siobhan about check-in frequency
- [ ] Research live/real-time updates (Supabase Realtime is an option)
- [ ] Add tag system for tasks (signs, guest, design, etc.) with tag-based filtering
- [ ] Add task search
- [ ] Master task list view — full list with bulk status management
- [ ] Q&A tab
- [ ] Resources tab
