CREATE UNIQUE INDEX users_company_full_name_unique
ON users (company_id, lower(btrim(full_name)));

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
  ) THEN
    RAISE EXCEPTION 'طرف‌حسابی با این نام از قبل وجود دارد.'
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parties_display_name_unique_check
BEFORE INSERT OR UPDATE OF display_name ON parties
FOR EACH ROW
EXECUTE FUNCTION prevent_duplicate_party_display_name();
