CREATE TABLE fiscal_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  title VARCHAR(120) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'soft_closed', 'final_closed')),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES users(id),
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (starts_on <= ends_on),
  UNIQUE (company_id, title)
);

CREATE UNIQUE INDEX fiscal_year_period_unique
ON fiscal_years (company_id, starts_on, ends_on);

CREATE TRIGGER fiscal_years_updated_at
BEFORE UPDATE ON fiscal_years
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id),
  period_number SMALLINT NOT NULL CHECK (period_number BETWEEN 1 AND 14),
  title VARCHAR(120) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'soft_closed', 'final_closed')),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES users(id),
  CHECK (starts_on <= ends_on),
  UNIQUE (fiscal_year_id, period_number)
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  parent_id UUID REFERENCES accounts(id),
  code VARCHAR(40) NOT NULL,
  name VARCHAR(180) NOT NULL,
  account_level VARCHAR(20) NOT NULL
    CHECK (
      account_level IN (
        'group',
        'general',
        'subsidiary',
        'floating'
      )
    ),
  account_type VARCHAR(20) NOT NULL
    CHECK (
      account_type IN (
        'asset',
        'liability',
        'equity',
        'income',
        'expense',
        'memo'
      )
    ),
  normal_balance VARCHAR(10) NOT NULL
    CHECK (normal_balance IN ('debit', 'credit')),
  system_key VARCHAR(80),
  allows_posting BOOLEAN NOT NULL DEFAULT false,
  requires_party BOOLEAN NOT NULL DEFAULT false,
  requires_branch BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE UNIQUE INDEX accounts_system_key_unique
ON accounts (company_id, system_key)
WHERE system_key IS NOT NULL;

CREATE INDEX accounts_parent_idx ON accounts (parent_id);

CREATE TRIGGER accounts_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id),
  entry_number BIGINT NOT NULL,
  entry_date DATE NOT NULL,
  document_date DATE,
  reference_number VARCHAR(120),
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'posted', 'reversed')),
  source_type VARCHAR(60) NOT NULL DEFAULT 'manual',
  source_id UUID,
  reversal_of_id UUID REFERENCES journal_entries(id),
  created_by UUID NOT NULL REFERENCES users(id),
  posted_by UUID REFERENCES users(id),
  posted_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES users(id),
  reversed_at TIMESTAMPTZ,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, fiscal_year_id, entry_number)
);

CREATE UNIQUE INDEX journal_source_unique
ON journal_entries (company_id, source_type, source_id)
WHERE source_id IS NOT NULL AND reversal_of_id IS NULL;

CREATE UNIQUE INDEX journal_reversal_unique
ON journal_entries (reversal_of_id)
WHERE reversal_of_id IS NOT NULL;

CREATE INDEX journal_entries_date_idx
ON journal_entries (company_id, entry_date DESC);

CREATE TRIGGER journal_entries_updated_at
BEFORE UPDATE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL
    REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  account_id UUID NOT NULL REFERENCES accounts(id),
  party_id UUID REFERENCES parties(id),
  branch_id UUID REFERENCES branches(id),
  description TEXT,
  debit_irr BIGINT NOT NULL DEFAULT 0 CHECK (debit_irr >= 0),
  credit_irr BIGINT NOT NULL DEFAULT 0 CHECK (credit_irr >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (debit_irr > 0 AND credit_irr = 0)
    OR (credit_irr > 0 AND debit_irr = 0)
  ),
  UNIQUE (journal_entry_id, line_number)
);

CREATE INDEX journal_lines_account_idx
ON journal_lines (account_id);

CREATE INDEX journal_lines_party_idx
ON journal_lines (party_id)
WHERE party_id IS NOT NULL;

CREATE OR REPLACE FUNCTION validate_journal_posting()
RETURNS TRIGGER AS $$
DECLARE
  total_debit BIGINT;
  total_credit BIGINT;
  line_count INTEGER;
  fiscal_status VARCHAR(20);
  posting_account_count INTEGER;
BEGIN
  IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
    SELECT
      COALESCE(sum(debit_irr), 0),
      COALESCE(sum(credit_irr), 0),
      count(*)
    INTO total_debit, total_credit, line_count
    FROM journal_lines
    WHERE journal_entry_id = NEW.id;

    IF line_count < 2 OR total_debit = 0 OR total_debit <> total_credit THEN
      RAISE EXCEPTION 'Journal entry must contain balanced debit and credit lines';
    END IF;

    SELECT count(*)
    INTO posting_account_count
    FROM journal_lines line
    JOIN accounts account ON account.id = line.account_id
    WHERE line.journal_entry_id = NEW.id
      AND (account.allows_posting = false OR account.is_active = false);

    IF posting_account_count > 0 THEN
      RAISE EXCEPTION 'Journal line uses an inactive or non-posting account';
    END IF;

    SELECT status
    INTO fiscal_status
    FROM fiscal_years
    WHERE id = NEW.fiscal_year_id
      AND NEW.entry_date BETWEEN starts_on AND ends_on;

    IF fiscal_status IS NULL OR fiscal_status <> 'open' THEN
      RAISE EXCEPTION 'Fiscal year is closed or entry date is out of range';
    END IF;

    NEW.posted_at = COALESCE(NEW.posted_at, now());
  ELSIF OLD.status = 'posted' AND NEW.status <> 'reversed' THEN
    RAISE EXCEPTION 'Posted journal entries are immutable';
  ELSIF OLD.status = 'reversed' THEN
    RAISE EXCEPTION 'Reversed journal entries are immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_posting_validation
BEFORE UPDATE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION validate_journal_posting();

CREATE OR REPLACE FUNCTION protect_posted_journal_lines()
RETURNS TRIGGER AS $$
DECLARE
  parent_status VARCHAR(20);
  parent_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    parent_id = OLD.journal_entry_id;
  ELSE
    parent_id = NEW.journal_entry_id;
  END IF;

  SELECT status INTO parent_status
  FROM journal_entries
  WHERE id = parent_id;

  IF parent_status <> 'draft' THEN
    RAISE EXCEPTION 'Lines of a posted journal entry are immutable';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_lines_immutable
BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
FOR EACH ROW EXECUTE FUNCTION protect_posted_journal_lines();

CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  branch_id UUID REFERENCES branches(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  bank_name VARCHAR(160) NOT NULL,
  branch_name VARCHAR(160),
  account_number VARCHAR(80),
  iban VARCHAR(40),
  card_number VARCHAR(30),
  opening_balance_irr BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX bank_accounts_iban_unique
ON bank_accounts (company_id, iban)
WHERE iban IS NOT NULL;

CREATE TRIGGER bank_accounts_updated_at
BEFORE UPDATE ON bank_accounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE cashboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  code VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE TRIGGER cashboxes_updated_at
BEFORE UPDATE ON cashboxes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE cheques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  party_id UUID REFERENCES parties(id),
  bank_account_id UUID REFERENCES bank_accounts(id),
  cheque_number VARCHAR(80) NOT NULL,
  bank_name VARCHAR(160),
  branch_name VARCHAR(160),
  due_date DATE NOT NULL,
  amount_irr BIGINT NOT NULL CHECK (amount_irr > 0),
  direction VARCHAR(20) NOT NULL
    CHECK (direction IN ('receivable', 'payable')),
  status VARCHAR(30) NOT NULL DEFAULT 'received'
    CHECK (
      status IN (
        'received',
        'issued',
        'deposited',
        'cleared',
        'bounced',
        'returned',
        'cancelled'
      )
    ),
  current_holder VARCHAR(180),
  description TEXT,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, cheque_number, direction)
);

CREATE INDEX cheques_due_idx
ON cheques (company_id, due_date, status);

CREATE TRIGGER cheques_updated_at
BEFORE UPDATE ON cheques
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE treasury_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  transaction_number BIGINT NOT NULL,
  transaction_date DATE NOT NULL,
  direction VARCHAR(20) NOT NULL
    CHECK (direction IN ('receipt', 'payment')),
  payment_method VARCHAR(20) NOT NULL
    CHECK (payment_method IN ('cash', 'bank', 'card', 'cheque')),
  party_id UUID REFERENCES parties(id),
  cashbox_id UUID REFERENCES cashboxes(id),
  bank_account_id UUID REFERENCES bank_accounts(id),
  cheque_id UUID REFERENCES cheques(id),
  amount_irr BIGINT NOT NULL CHECK (amount_irr > 0),
  reference_number VARCHAR(120),
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'posted', 'reversed')),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID NOT NULL REFERENCES users(id),
  posted_by UUID REFERENCES users(id),
  posted_at TIMESTAMPTZ,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (payment_method = 'cash' AND cashbox_id IS NOT NULL)
    OR (payment_method IN ('bank', 'card') AND bank_account_id IS NOT NULL)
    OR (payment_method = 'cheque' AND cheque_id IS NOT NULL)
  ),
  UNIQUE (company_id, transaction_number)
);

CREATE INDEX treasury_party_idx
ON treasury_transactions (company_id, party_id, transaction_date DESC);

CREATE TRIGGER treasury_transactions_updated_at
BEFORE UPDATE ON treasury_transactions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
