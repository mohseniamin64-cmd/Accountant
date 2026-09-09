INSERT INTO accounts (
  company_id,
  parent_id,
  code,
  name,
  account_level,
  account_type,
  normal_balance,
  system_key,
  allows_posting,
  is_system
)
SELECT
  parent.company_id,
  parent.id,
  '1103',
  U&'\0627\0633\0646\0627\062F \062F\0631\06CC\0627\0641\062A\0646\06CC',
  'subsidiary',
  'asset',
  'debit',
  'cheques_receivable',
  true,
  true
FROM accounts parent
WHERE parent.system_key = 'current_assets'
ON CONFLICT DO NOTHING;

INSERT INTO accounts (
  company_id,
  parent_id,
  code,
  name,
  account_level,
  account_type,
  normal_balance,
  system_key,
  allows_posting,
  is_system
)
SELECT
  parent.company_id,
  parent.id,
  '2102',
  U&'\0627\0633\0646\0627\062F \067E\0631\062F\0627\062E\062A\0646\06CC',
  'subsidiary',
  'liability',
  'credit',
  'cheques_payable',
  true,
  true
FROM accounts parent
WHERE parent.system_key = 'current_liabilities'
ON CONFLICT DO NOTHING;
