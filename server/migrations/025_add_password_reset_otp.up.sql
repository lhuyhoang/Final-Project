CREATE TABLE password_reset_requests (
  email VARCHAR(254) PRIMARY KEY,
  request_id UUID NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  otp_hash CHAR(64) NOT NULL CHECK (otp_hash ~ '^[0-9a-f]{64}$'),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  send_count INTEGER NOT NULL DEFAULT 1 CHECK (send_count BETWEEN 1 AND 5),
  verified_at TIMESTAMPTZ,
  reset_token_hash CHAR(64) CHECK (reset_token_hash ~ '^[0-9a-f]{64}$'),
  reset_expires_at TIMESTAMPTZ,
  CHECK (expires_at > requested_at)
);
CREATE INDEX password_reset_requests_expiry_idx ON password_reset_requests (expires_at);
