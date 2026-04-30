-- Live sessions: rider currently at a spot
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  spot_id UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_spot_active
ON sessions(spot_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_sessions_user
ON sessions(user_id);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can read active sessions
CREATE POLICY "sessions_public_read" ON sessions
  FOR SELECT USING (expires_at > now());
