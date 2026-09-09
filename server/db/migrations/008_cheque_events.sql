CREATE TABLE cheque_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  cheque_id UUID NOT NULL REFERENCES cheques(id),
  event_type VARCHAR(20) NOT NULL
    CHECK (event_type IN ('deposit', 'clear', 'bounce')),
  event_date DATE NOT NULL,
  from_status VARCHAR(30) NOT NULL,
  to_status VARCHAR(30) NOT NULL,
  bank_account_id UUID REFERENCES bank_accounts(id),
  previous_bank_account_id UUID REFERENCES bank_accounts(id),
  previous_holder VARCHAR(180),
  journal_entry_id UUID REFERENCES journal_entries(id),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_at TIMESTAMPTZ,
  reversal_date DATE,
  reversed_by UUID REFERENCES users(id),
  reversal_reason TEXT,
  reversal_journal_entry_id UUID REFERENCES journal_entries(id),
  CHECK (
    (
      reversed_at IS NULL
      AND reversal_date IS NULL
      AND reversed_by IS NULL
      AND reversal_reason IS NULL
    )
    OR
    (
      reversed_at IS NOT NULL
      AND reversal_date IS NOT NULL
      AND reversed_by IS NOT NULL
      AND reversal_reason IS NOT NULL
    )
  )
);

CREATE INDEX cheque_events_cheque_idx
ON cheque_events (cheque_id, created_at DESC);

CREATE INDEX cheque_events_company_date_idx
ON cheque_events (company_id, event_date DESC);

CREATE UNIQUE INDEX cheque_events_journal_unique
ON cheque_events (journal_entry_id)
WHERE journal_entry_id IS NOT NULL;

CREATE UNIQUE INDEX cheque_events_reversal_journal_unique
ON cheque_events (reversal_journal_entry_id)
WHERE reversal_journal_entry_id IS NOT NULL;
