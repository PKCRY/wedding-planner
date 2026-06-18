CREATE TABLE IF NOT EXISTS member_users (
  id         text         PRIMARY KEY,
  name       text         NOT NULL,
  salt       text         NOT NULL,
  hash       text         NOT NULL,
  created_at timestamptz  NOT NULL DEFAULT now()
);
ALTER TABLE member_users DISABLE ROW LEVEL SECURITY;
