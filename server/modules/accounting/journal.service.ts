import type {PoolClient, QueryResultRow} from 'pg';
import {AppError} from '../../common/errors.js';
import {asBigInt} from '../../common/values.js';
import {nextSequence} from '../../infrastructure/sequences.js';

export interface JournalLineInput {
  accountId: string;
  partyId?: string | null | undefined;
  branchId?: string | null | undefined;
  description?: string | null | undefined;
  debitIrr: string;
  creditIrr: string;
}

export interface CreateJournalInput {
  companyId: string;
  branchId: string;
  entryDate: string;
  documentDate?: string | null | undefined;
  referenceNumber?: string | null | undefined;
  description: string;
  sourceType: string;
  sourceId?: string | null | undefined;
  reversalOfId?: string | null | undefined;
  createdBy: string;
  lines: readonly JournalLineInput[];
  post: boolean;
}

export interface CreatedJournal {
  id: string;
  entryNumber: string;
  fiscalYearId: string;
  status: 'draft' | 'posted';
}

interface FiscalYearRow extends QueryResultRow {
  id: string;
}

interface IdRow extends QueryResultRow {
  id: string;
}

interface OriginalEntryRow extends QueryResultRow {
  id: string;
  company_id: string;
  branch_id: string;
  fiscal_year_id: string;
  entry_date: string;
  description: string;
  status: 'draft' | 'posted' | 'reversed';
}

interface OriginalLineRow extends QueryResultRow {
  account_id: string;
  party_id: string | null;
  branch_id: string | null;
  description: string | null;
  debit_irr: string;
  credit_irr: string;
}

export function validateJournalLines(lines: readonly JournalLineInput[]): void {
  if (lines.length < 2) {
    throw new AppError(
      422,
      'JOURNAL_REQUIRES_TWO_LINES',
      'سند حسابداری باید حداقل دو ردیف داشته باشد.',
    );
  }

  let debit = 0n;
  let credit = 0n;
  lines.forEach((line, index) => {
    const lineDebit = asBigInt(line.debitIrr, `بدهکار ردیف ${index + 1}`);
    const lineCredit = asBigInt(
      line.creditIrr,
      `بستانکار ردیف ${index + 1}`,
    );
    if (
      (lineDebit === 0n && lineCredit === 0n) ||
      (lineDebit > 0n && lineCredit > 0n)
    ) {
      throw new AppError(
        422,
        'INVALID_JOURNAL_LINE',
        `ردیف ${index + 1} باید فقط بدهکار یا فقط بستانکار باشد.`,
      );
    }
    debit += lineDebit;
    credit += lineCredit;
  });

  if (debit === 0n || debit !== credit) {
    throw new AppError(
      422,
      'UNBALANCED_JOURNAL',
      'جمع بدهکار و بستانکار سند برابر نیست.',
      {debitIrr: debit.toString(), creditIrr: credit.toString()},
    );
  }
}


export async function validateJournalDimensions(
  client: PoolClient,
  companyId: string,
  lines: readonly JournalLineInput[],
): Promise<void> {
  const accountIds = [...new Set(lines.map((line) => line.accountId))];
  const accountResult = await client.query<{
    id: string;
    allows_posting: boolean;
    requires_party: boolean;
    is_active: boolean;
  }>(
    `
      SELECT id, allows_posting, requires_party, is_active
      FROM accounts
      WHERE company_id = $1 AND id = ANY($2::uuid[])
    `,
    [companyId, accountIds],
  );
  const accounts = new Map(accountResult.rows.map((row) => [row.id, row]));
  for (const [index, line] of lines.entries()) {
    const account = accounts.get(line.accountId);
    if (!account || !account.is_active || !account.allows_posting) {
      throw new AppError(
        422,
        'INVALID_POSTING_ACCOUNT',
        'حساب ردیف ' + (index + 1) + ' فعال یا قابل ثبت نیست.',
      );
    }
    if (account.requires_party && !line.partyId) {
      throw new AppError(
        422,
        'JOURNAL_PARTY_REQUIRED',
        'طرف‌حساب برای ردیف ' + (index + 1) + ' الزامی است.',
      );
    }
  }

  const partyIds = [
    ...new Set(
      lines
        .map((line) => line.partyId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  if (partyIds.length > 0) {
    const partyResult = await client.query<{id: string}>(
      `
        SELECT id
        FROM parties
        WHERE company_id = $1
          AND id = ANY($2::uuid[])
          AND is_active = true
      `,
      [companyId, partyIds],
    );
    const valid = new Set(partyResult.rows.map((row) => row.id));
    if (partyIds.some((id) => !valid.has(id))) {
      throw new AppError(
        422,
        'INVALID_JOURNAL_PARTY',
        'یکی از طرف‌حساب‌های سند معتبر یا فعال نیست.',
      );
    }
  }

  const branchIds = [
    ...new Set(
      lines
        .map((line) => line.branchId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  if (branchIds.length > 0) {
    const branchResult = await client.query<{id: string}>(
      `
        SELECT id
        FROM branches
        WHERE company_id = $1
          AND id = ANY($2::uuid[])
          AND is_active = true
      `,
      [companyId, branchIds],
    );
    const valid = new Set(branchResult.rows.map((row) => row.id));
    if (branchIds.some((id) => !valid.has(id))) {
      throw new AppError(
        422,
        'INVALID_JOURNAL_BRANCH',
        'یکی از شعب ردیف‌های سند معتبر یا فعال نیست.',
      );
    }
  }
}

export async function createJournalEntry(
  client: PoolClient,
  input: CreateJournalInput,
): Promise<CreatedJournal> {
  validateJournalLines(input.lines);
  await validateJournalDimensions(client, input.companyId, input.lines);

  const branch = await client.query(
    'SELECT 1 FROM branches WHERE id = $1 AND company_id = $2',
    [input.branchId, input.companyId],
  );
  if (!branch.rowCount) {
    throw new AppError(422, 'INVALID_BRANCH', 'شعبه انتخاب‌شده معتبر نیست.');
  }

  const fiscalResult = await client.query<FiscalYearRow>(
    `
      SELECT id
      FROM fiscal_years
      WHERE company_id = $1
        AND $2::date BETWEEN starts_on AND ends_on
        AND status = 'open'
      ORDER BY starts_on DESC
      LIMIT 1
    `,
    [input.companyId, input.entryDate],
  );
  const fiscalYearId = fiscalResult.rows[0]?.id;
  if (!fiscalYearId) {
    throw new AppError(
      422,
      'NO_OPEN_FISCAL_YEAR',
      'تاریخ سند در سال مالی باز قرار ندارد.',
    );
  }

  const entryNumber = await nextSequence(
    client,
    input.companyId,
    'journal_entry',
    fiscalYearId,
  );

  const entryResult = await client.query<IdRow>(
    `
      INSERT INTO journal_entries (
        company_id,
        branch_id,
        fiscal_year_id,
        entry_number,
        entry_date,
        document_date,
        reference_number,
        description,
        source_type,
        source_id,
        reversal_of_id,
        created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
      RETURNING id
    `,
    [
      input.companyId,
      input.branchId,
      fiscalYearId,
      entryNumber.toString(),
      input.entryDate,
      input.documentDate ?? null,
      input.referenceNumber ?? null,
      input.description,
      input.sourceType,
      input.sourceId ?? null,
      input.reversalOfId ?? null,
      input.createdBy,
    ],
  );
  const entryId = entryResult.rows[0]?.id;
  if (!entryId) throw new Error('Journal insertion did not return an id');

  for (const [index, line] of input.lines.entries()) {
    await client.query(
      `
        INSERT INTO journal_lines (
          journal_entry_id,
          line_number,
          account_id,
          party_id,
          branch_id,
          description,
          debit_irr,
          credit_irr
        )
        SELECT
          $1,
          $2,
          account.id,
          $4,
          $5,
          $6,
          $7,
          $8
        FROM accounts account
        WHERE account.id = $3 AND account.company_id = $9
      `,
      [
        entryId,
        index + 1,
        line.accountId,
        line.partyId ?? null,
        line.branchId ?? null,
        line.description ?? null,
        line.debitIrr,
        line.creditIrr,
        input.companyId,
      ],
    );
  }

  const insertedLines = await client.query<{count: string}>(
    'SELECT count(*)::text AS count FROM journal_lines WHERE journal_entry_id = $1',
    [entryId],
  );
  if (Number(insertedLines.rows[0]?.count ?? 0) !== input.lines.length) {
    throw new AppError(
      422,
      'INVALID_ACCOUNT',
      'حساب یا طرف‌حساب انتخاب‌شده معتبر نیست.',
    );
  }

  if (input.post) {
    await client.query(
      `
        UPDATE journal_entries
        SET status = 'posted', posted_by = $2
        WHERE id = $1
      `,
      [entryId, input.createdBy],
    );
  }

  return {
    id: entryId,
    entryNumber: entryNumber.toString(),
    fiscalYearId,
    status: input.post ? 'posted' : 'draft',
  };
}

export async function reverseJournalEntry(
  client: PoolClient,
  companyId: string,
  entryId: string,
  userId: string,
  reversalDate: string,
  reason: string,
): Promise<CreatedJournal> {
  const entryResult = await client.query<OriginalEntryRow>(
    `
      SELECT
        id,
        company_id,
        branch_id,
        fiscal_year_id,
        entry_date::text,
        description,
        status
      FROM journal_entries
      WHERE id = $1 AND company_id = $2
      FOR UPDATE
    `,
    [entryId, companyId],
  );
  const original = entryResult.rows[0];
  if (!original) {
    throw new AppError(404, 'JOURNAL_NOT_FOUND', 'سند حسابداری پیدا نشد.');
  }
  if (original.status !== 'posted') {
    throw new AppError(
      409,
      'JOURNAL_NOT_POSTED',
      'فقط سند قطعی قابل برگشت است.',
    );
  }

  const lineResult = await client.query<OriginalLineRow>(
    `
      SELECT
        account_id,
        party_id,
        branch_id,
        description,
        debit_irr,
        credit_irr
      FROM journal_lines
      WHERE journal_entry_id = $1
      ORDER BY line_number
    `,
    [entryId],
  );

  const reversal = await createJournalEntry(client, {
    companyId,
    branchId: original.branch_id,
    entryDate: reversalDate,
    description: `برگشت سند: ${reason}`,
    referenceNumber: null,
    sourceType: 'journal_reversal',
    sourceId: original.id,
    reversalOfId: original.id,
    createdBy: userId,
    post: true,
    lines: lineResult.rows.map((line) => ({
      accountId: line.account_id,
      partyId: line.party_id,
      branchId: line.branch_id,
      description: line.description,
      debitIrr: line.credit_irr,
      creditIrr: line.debit_irr,
    })),
  });

  await client.query(
    `
      UPDATE journal_entries
      SET
        status = 'reversed',
        reversed_by = $2,
        reversed_at = now(),
        row_version = row_version + 1
      WHERE id = $1
    `,
    [entryId, userId],
  );

  return reversal;
}

export async function systemAccountIds(
  client: PoolClient,
  companyId: string,
  keys: readonly string[],
): Promise<Map<string, string>> {
  const result = await client.query<{id: string; system_key: string}>(
    `
      SELECT id, system_key
      FROM accounts
      WHERE company_id = $1 AND system_key = ANY($2::text[])
    `,
    [companyId, keys],
  );
  const map = new Map(
    result.rows.map((row) => [row.system_key, row.id] as const),
  );
  const missing = keys.filter((key) => !map.has(key));
  if (missing.length) {
    throw new AppError(
      409,
      'SYSTEM_ACCOUNT_MISSING',
      'حساب‌های سیستمی مورد نیاز تعریف نشده‌اند.',
      {missing},
    );
  }
  return map;
}
