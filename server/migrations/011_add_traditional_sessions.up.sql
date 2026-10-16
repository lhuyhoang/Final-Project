DO $$
BEGIN
  IF TO_REGCLASS('neon_auth."user"') IS NOT NULL THEN
    EXECUTE $migration$
      INSERT INTO users (
        id, name, email, phone, landline, address, province,
        password_hash, role, status, created_at, updated_at
      )
      SELECT
        id,
        CASE
          WHEN CHAR_LENGTH(BTRIM(COALESCE(name, ''))) BETWEEN 2 AND 60 THEN BTRIM(name)
          ELSE 'Thành viên QuadPro'
        END,
        LOWER(BTRIM(email)),
        '', '', '', '', NULL,
        CASE WHEN role = 'admin' THEN 'admin' ELSE 'customer' END,
        CASE WHEN COALESCE(banned, FALSE) THEN 'blocked' ELSE 'active' END,
        COALESCE("createdAt", NOW()),
        COALESCE("updatedAt", "createdAt", NOW())
      FROM neon_auth."user"
      WHERE email IS NOT NULL
        AND BTRIM(email) <> ''
      ON CONFLICT (email) DO UPDATE
      SET role = CASE
            WHEN EXCLUDED.role = 'admin' THEN 'admin'
            ELSE users.role
          END,
          status = CASE
            WHEN EXCLUDED.status = 'blocked' THEN 'blocked'
            ELSE users.status
          END,
          updated_at = GREATEST(users.updated_at, EXCLUDED.updated_at)
    $migration$;
  END IF;
END $$;

ALTER TABLE users
  DROP COLUMN IF EXISTS auth_user_id;

-- Clear unsupported legacy/demo values first. Better Auth credentials are
-- copied below with a prefix so the application can verify and transparently
-- rehash them after the first successful login.
UPDATE users
SET password_hash = NULL
WHERE password_hash IS NOT NULL
  AND password_hash NOT LIKE 'scrypt$%';

DO $$
BEGIN
  IF TO_REGCLASS('neon_auth."user"') IS NOT NULL
     AND TO_REGCLASS('neon_auth.account') IS NOT NULL THEN
    EXECUTE $migration$
      UPDATE users
      SET password_hash = 'better-auth$' || credential.password
      FROM neon_auth."user" AS auth_user
      JOIN neon_auth.account AS credential
        ON credential."userId" = auth_user.id
       AND credential."providerId" = 'credential'
      WHERE LOWER(users.email) = LOWER(auth_user.email)
        AND credential.password IS NOT NULL
        AND credential.password <> ''
    $migration$;
  END IF;
END $$;

CREATE TABLE user_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  user_agent VARCHAR(500) NOT NULL DEFAULT '',
  ip_address VARCHAR(64) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT user_sessions_token_hash_valid CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT user_sessions_expiry_valid CHECK (expires_at > created_at)
);

CREATE INDEX user_sessions_user_id_idx ON user_sessions (user_id);
CREATE INDEX user_sessions_expires_at_idx ON user_sessions (expires_at);
