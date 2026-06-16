-- In-app notification center: persisted alongside push so users can review/clear history
CREATE TABLE IF NOT EXISTS notifications (
  id          bigserial    PRIMARY KEY,
  user_id     text         NOT NULL,
  title       text         NOT NULL,
  body        text         NOT NULL,
  url         text         NOT NULL DEFAULT '/',
  read        boolean      NOT NULL DEFAULT false,
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id, created_at DESC);
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
