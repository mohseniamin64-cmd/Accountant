ALTER TABLE parties
  ADD COLUMN archived_at TIMESTAMPTZ;

CREATE INDEX parties_company_archived_idx
ON parties (company_id, archived_at, is_active, display_name);
