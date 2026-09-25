ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

UPDATE users
SET account_status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END
WHERE account_status NOT IN ('active', 'inactive', 'archived')
   OR (account_status = 'active' AND is_active = false);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_account_status_check'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_account_status_check
      CHECK (account_status IN ('active', 'inactive', 'archived'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS users_company_status_idx
ON users (company_id, account_status, full_name);

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoke_reason TEXT,
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sessions_active_user_idx
ON sessions (user_id, last_seen_at DESC)
WHERE revoked_at IS NULL;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS user_name_snapshot VARCHAR(160),
  ADD COLUMN IF NOT EXISTS username_snapshot VARCHAR(80),
  ADD COLUMN IF NOT EXISTS module VARCHAR(80) NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS outcome VARCHAR(20) NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS error_code VARCHAR(120),
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'audit_logs_outcome_check'
      AND conrelid = 'audit_logs'::regclass
  ) THEN
    ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_outcome_check
      CHECK (outcome IN ('success', 'failure'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS audit_company_action_time_idx
ON audit_logs (company_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_company_user_time_idx
ON audit_logs (company_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_company_ip_time_idx
ON audit_logs (company_id, ip_address, created_at DESC);
