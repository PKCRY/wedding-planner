-- Notification preferences per user (opt-out of activity notifications)
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id    text     PRIMARY KEY,
  enabled    boolean  NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notification_prefs DISABLE ROW LEVEL SECURITY;
