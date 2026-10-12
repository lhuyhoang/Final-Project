UPDATE users
SET password_hash = 'neon-auth-account'
WHERE password_hash IS NULL;

ALTER TABLE users
  DROP CONSTRAINT users_auth_user_id_key,
  DROP CONSTRAINT users_auth_user_id_not_blank,
  DROP COLUMN auth_user_id;

ALTER TABLE users
  ALTER COLUMN password_hash SET NOT NULL;

ALTER TABLE users
  ADD CONSTRAINT users_password_not_blank CHECK (password_hash <> '');
