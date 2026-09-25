ALTER TABLE parties
  ADD COLUMN IF NOT EXISTS province VARCHAR(80),
  ADD COLUMN IF NOT EXISTS city VARCHAR(120);

CREATE OR REPLACE FUNCTION prevent_duplicate_party_display_name()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext(
      'parties:display-name:' || NEW.company_id::text || ':' || lower(btrim(NEW.display_name))
    )
  );

  IF EXISTS (
    SELECT 1
    FROM parties existing_party
    WHERE existing_party.company_id = NEW.company_id
      AND existing_party.id <> NEW.id
      AND lower(btrim(existing_party.display_name)) = lower(btrim(NEW.display_name))
      AND (
        NEW.party_type = 'company'
        OR existing_party.party_type = 'company'
        OR NOT (
          existing_party.national_id IS NOT DISTINCT FROM NEW.national_id
          AND existing_party.mobile IS NOT DISTINCT FROM NEW.mobile
        )
      )
  ) THEN
    RAISE EXCEPTION 'طرف‌حسابی با این نام و شناسه‌ها از قبل وجود دارد.'
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
