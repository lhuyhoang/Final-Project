ALTER TABLE users
  ADD COLUMN auth_user_id TEXT;

ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
  DROP CONSTRAINT users_password_not_blank;

ALTER TABLE users
  ADD CONSTRAINT users_auth_user_id_not_blank
    CHECK (auth_user_id IS NULL OR BTRIM(auth_user_id) <> ''),
  ADD CONSTRAINT users_auth_user_id_key UNIQUE (auth_user_id);
