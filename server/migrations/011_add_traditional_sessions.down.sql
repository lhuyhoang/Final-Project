DROP TABLE IF EXISTS user_sessions;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_user_id TEXT;

ALTER TABLE users
  ADD CONSTRAINT users_auth_user_id_not_blank
    CHECK (auth_user_id IS NULL OR BTRIM(auth_user_id) <> ''),
  ADD CONSTRAINT users_auth_user_id_key UNIQUE (auth_user_id);
