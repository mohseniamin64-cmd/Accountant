import {Router} from 'express';
import {z} from 'zod';
import {PERMISSIONS} from '../../../shared/permissions.js';
import {currentUser} from '../../common/auth-context.js';
import {AppError, asyncRoute} from '../../common/errors.js';
import {
  identifierSchema,
  isoDateSchema,
  nonNegativeIrrSchema,
} from '../../common/values.js';
import {query, withTransaction} from '../../db/pool.js';
import {writeAudit} from '../../infrastructure/audit.js';
import {
  requireAuthentication,
  requirePermissions,
} from '../auth/middleware.js';
import {
  buildBalanceSheetReport,
  buildProfitLossReport,
  type StatementSourceRow,
} from './financial-report.calculations.js';
import {
  createJournalEntry,
  reverseJournalEntry,
  validateJournalDimensions,
  validateJournalLines,
} from './journal.service.js';

const lineSchema = z.object({
  accountId: identifierSchema,
  partyId: identifierSchema.nullable().optional(),
  branchId: identifierSchema.nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  debitIrr: nonNegativeIrrSchema,
  creditIrr: nonNegativeIrrSchema,
});

const journalSchema = z.object({
  branchId: identifierSchema,
  entryDate: isoDateSchema,
  documentDate: isoDateSchema.nullable().optional(),
  referenceNumber: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().min(2).max(2000),
  lines: z.array(lineSchema).min(2).max(200),
  postNow: z.boolean().default(false),
});

const rangeSchema = z
  .object({from: isoDateSchema, to: isoDateSchema})
  .refine((value) => value.from <= value.to, {
    path: ['to'],
    message: '\u062a\u0627\u0631\u06cc\u062e \u067e\u0627\u06cc\u0627\u0646 \u0628\u0627\u06cc\u062f \u0628\u0639\u062f \u0627\u0632 \u062a\u0627\u0631\u06cc\u062e \u0634\u0631\u0648\u0639 \u0628\u0627\u0634\u062f.',
  });

const asOfSchema = z.object({asOf: isoDateSchema});

export const accountingRouter = Router();
accountingRouter.use(
  requireAuthentication,
  requirePermissions(PERMISSIONS.ACCOUNTING_VIEW),
);

accountingRouter.get(
  '/options',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const [accounts, branches, parties, fiscalYears] = await Promise.all([
      query(
        `
          SELECT
            id,
            parent_id AS "parentId",
            code,
            name,
            account_level AS "accountLevel",
            account_type AS "accountType",
            normal_balance AS "normalBalance",
            allows_posting AS "allowsPosting",
            requires_party AS "requiresParty",
            requires_branch AS "requiresBranch"
          FROM accounts
          WHERE company_id = $1 AND is_active = true
          ORDER BY code
        `,
        [actor.companyId],
      ),
      query(
        `
          SELECT id, code, name, is_head_office AS "isHeadOffice"
          FROM branches
          WHERE company_id = $1 AND is_active = true
          ORDER BY is_head_office DESC, name
        `,
        [actor.companyId],
      ),
      query(
        `
          SELECT id, code, display_name AS "displayName"
          FROM parties
          WHERE company_id = $1 AND is_active = true
          ORDER BY display_name
        `,
        [actor.companyId],
      ),
      query(
        `
          SELECT
            id,
            title,
            starts_on::text AS "startsOn",
            ends_on::text AS "endsOn",
            status,
            closed_at AS "closedAt",
            row_version AS "rowVersion"
          FROM fiscal_years
          WHERE company_id = $1
          ORDER BY starts_on DESC
        `,
        [actor.companyId],
      ),
    ]);
    response.json({
      data: {
        accounts: accounts.rows,
        branches: branches.rows,
        parties: parties.rows,
        fiscalYears: fiscalYears.rows,
      },
    });
  }),
);

accountingRouter.get(
  '/accounts',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const result = await query(
      `
        SELECT
          id,
          parent_id AS "parentId",
          code,
          name,
          account_level AS "accountLevel",
          account_type AS "accountType",
          normal_balance AS "normalBalance",
          allows_posting AS "allowsPosting",
          requires_party AS "requiresParty",
          is_system AS "isSystem",
          is_active AS "isActive",
          row_version AS "rowVersion"
        FROM accounts
        WHERE company_id = $1
        ORDER BY code
      `,
      [actor.companyId],
    );
    response.json({data: result.rows});
  }),
);

accountingRouter.get(
  '/fiscal-years',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const result = await query(
      `
        SELECT
          id,
          title,
          starts_on::text AS "startsOn",
          ends_on::text AS "endsOn",
          status,
          closed_at AS "closedAt",
          row_version AS "rowVersion"
        FROM fiscal_years
        WHERE company_id = $1
        ORDER BY starts_on DESC
      `,
      [actor.companyId],
    );
    response.json({data: result.rows});
  }),
);

accountingRouter.post(
  '/fiscal-years',
  requirePermissions(PERMISSIONS.ACCOUNTING_CLOSE_PERIOD),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        title: z.string().trim().min(2).max(120),
        startsOn: isoDateSchema,
        endsOn: isoDateSchema,
      })
      .refine((value) => value.startsOn <= value.endsOn, {
        path: ['endsOn'],
        message: '\u067e\u0627\u06cc\u0627\u0646 \u0633\u0627\u0644 \u0645\u0627\u0644\u06cc \u0628\u0627\u06cc\u062f \u0628\u0639\u062f \u0627\u0632 \u0634\u0631\u0648\u0639 \u0622\u0646 \u0628\u0627\u0634\u062f.',
      })
      .parse(request.body);

    const overlap = await query(
      `
        SELECT 1
        FROM fiscal_years
        WHERE company_id = $1
          AND daterange(starts_on, ends_on, '[]')
            && daterange($2::date, $3::date, '[]')
        LIMIT 1
      `,
      [actor.companyId, input.startsOn, input.endsOn],
    );
    if (overlap.rowCount) {
      throw new AppError(
        409,
        'FISCAL_YEAR_OVERLAP',
        '\u0628\u0627\u0632\u0647 \u0633\u0627\u0644 \u0645\u0627\u0644\u06cc \u0628\u0627 \u0633\u0627\u0644 \u062f\u06cc\u06af\u0631\u06cc \u0647\u0645\u200c\u067e\u0648\u0634\u0627\u0646\u06cc \u062f\u0627\u0631\u062f.',
      );
    }

    const result = await query(
      `
        INSERT INTO fiscal_years (
          company_id,
          title,
          starts_on,
          ends_on
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          title,
          starts_on::text AS "startsOn",
          ends_on::text AS "endsOn",
          status,
          row_version AS "rowVersion"
      `,
      [actor.companyId, input.title, input.startsOn, input.endsOn],
    );
    response.status(201).json({data: result.rows[0]});
  }),
);

accountingRouter.post(
  '/fiscal-years/:id/status',
  requirePermissions(PERMISSIONS.ACCOUNTING_CLOSE_PERIOD),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const fiscalYearId = identifierSchema.parse(request.params.id);
    const input = z
      .object({
        status: z.enum(['open', 'soft_closed', 'final_closed']),
        rowVersion: z.number().int().positive(),
      })
      .parse(request.body);

    const updated = await withTransaction(async (client) => {
      const currentResult = await client.query<{
        status: 'open' | 'soft_closed' | 'final_closed';
      }>(
        `
          SELECT status
          FROM fiscal_years
          WHERE id = $1 AND company_id = $2
          FOR UPDATE
        `,
        [fiscalYearId, actor.companyId],
      );
      const current = currentResult.rows[0];
      if (!current) {
        throw new AppError(404, 'FISCAL_YEAR_NOT_FOUND', '\u0633\u0627\u0644 \u0645\u0627\u0644\u06cc \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
      }
      if (current.status === 'final_closed') {
        throw new AppError(
          409,
          'FINAL_CLOSE_IS_IMMUTABLE',
          '\u0633\u0627\u0644 \u0645\u0627\u0644\u06cc \u0646\u0647\u0627\u06cc\u06cc\u200c\u0634\u062f\u0647 \u0628\u0627 \u0648\u06cc\u0631\u0627\u06cc\u0634 \u0639\u0627\u062f\u06cc \u0642\u0627\u0628\u0644 \u0628\u0627\u0632\u06af\u0634\u0627\u06cc\u06cc \u0646\u06cc\u0633\u062a.',
        );
      }
      if (input.status === 'final_closed') {
        const drafts = await client.query(
          `
            SELECT 1
            FROM journal_entries
            WHERE fiscal_year_id = $1 AND status = 'draft'
            LIMIT 1
          `,
          [fiscalYearId],
        );
        if (drafts.rowCount) {
          throw new AppError(
            409,
            'DRAFT_JOURNALS_EXIST',
            '\u0628\u0631\u0627\u06cc \u0628\u0633\u062a\u0646 \u0646\u0647\u0627\u06cc\u06cc\u060c \u0627\u0628\u062a\u062f\u0627 \u0627\u0633\u0646\u0627\u062f \u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633 \u0631\u0627 \u062a\u0639\u06cc\u06cc\u0646 \u062a\u06a9\u0644\u06cc\u0641 \u06a9\u0646\u06cc\u062f.',
          );
        }
      }

      const result = await client.query(
        `
          UPDATE fiscal_years
          SET
            status = $4,
            closed_at = CASE WHEN $4 = 'open' THEN NULL ELSE now() END,
            closed_by = CASE WHEN $4 = 'open' THEN NULL ELSE $5 END,
            row_version = row_version + 1
          WHERE id = $1
            AND company_id = $2
            AND row_version = $3
          RETURNING
            id,
            title,
            starts_on::text AS "startsOn",
            ends_on::text AS "endsOn",
            status,
            closed_at AS "closedAt",
            row_version AS "rowVersion"
        `,
        [
          fiscalYearId,
          actor.companyId,
          input.rowVersion,
          input.status,
          actor.id,
        ],
      );
      const row = result.rows[0];
      if (!row) {
        throw new AppError(
          409,
          'CONCURRENT_UPDATE',
          '\u0633\u0627\u0644 \u0645\u0627\u0644\u06cc \u0647\u0645\u200c\u0632\u0645\u0627\u0646 \u062a\u0648\u0633\u0637 \u06a9\u0627\u0631\u0628\u0631 \u062f\u06cc\u06af\u0631\u06cc \u062a\u063a\u06cc\u06cc\u0631 \u06a9\u0631\u062f\u0647 \u0627\u0633\u062a.',
        );
      }
      await writeAudit(client, request, {
        action: 'fiscal_year.status.update',
        entityType: 'fiscal_year',
        entityId: fiscalYearId,
        before: current,
        after: row,
      });
      return row;
    });
    response.json({data: updated});
  }),
);

accountingRouter.get(
  '/journals',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        from: isoDateSchema.optional(),
        to: isoDateSchema.optional(),
        status: z.enum(['draft', 'posted', 'reversed', 'all']).default('all'),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(request.query);
    const result = await query(
      `
        SELECT
          entry.id,
          entry.entry_number::text AS "entryNumber",
          entry.entry_date::text AS "entryDate",
          entry.reference_number AS "referenceNumber",
          entry.description,
          entry.status,
          entry.source_type AS "sourceType",
          entry.row_version AS "rowVersion",
          creator.full_name AS "createdByName",
          poster.full_name AS "postedByName",
          totals.debit_irr::text AS "debitIrr",
          totals.credit_irr::text AS "creditIrr"
        FROM journal_entries entry
        JOIN users creator ON creator.id = entry.created_by
        LEFT JOIN users poster ON poster.id = entry.posted_by
        JOIN LATERAL (
          SELECT
            COALESCE(sum(debit_irr), 0) AS debit_irr,
            COALESCE(sum(credit_irr), 0) AS credit_irr
          FROM journal_lines
          WHERE journal_entry_id = entry.id
        ) totals ON true
        WHERE entry.company_id = $1
          AND ($2::date IS NULL OR entry.entry_date >= $2)
          AND ($3::date IS NULL OR entry.entry_date <= $3)
          AND ($4 = 'all' OR entry.status = $4)
        ORDER BY entry.entry_date DESC, entry.entry_number DESC
        LIMIT $5 OFFSET $6
      `,
      [
        actor.companyId,
        input.from ?? null,
        input.to ?? null,
        input.status,
        input.limit,
        input.offset,
      ],
    );
    response.json({data: result.rows});
  }),
);

accountingRouter.get(
  '/journals/:id',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const entryId = identifierSchema.parse(request.params.id);
    const [entry, lines] = await Promise.all([
      query(
        `
          SELECT
            id,
            branch_id AS "branchId",
            fiscal_year_id AS "fiscalYearId",
            entry_number::text AS "entryNumber",
            entry_date::text AS "entryDate",
            document_date::text AS "documentDate",
            reference_number AS "referenceNumber",
            description,
            status,
            source_type AS "sourceType",
            row_version AS "rowVersion"
          FROM journal_entries
          WHERE id = $1 AND company_id = $2
        `,
        [entryId, actor.companyId],
      ),
      query(
        `
          SELECT
            line.id,
            line.line_number AS "lineNumber",
            line.account_id AS "accountId",
            account.code AS "accountCode",
            account.name AS "accountName",
            line.party_id AS "partyId",
            party.display_name AS "partyName",
            line.branch_id AS "branchId",
            line.description,
            line.debit_irr::text AS "debitIrr",
            line.credit_irr::text AS "creditIrr"
          FROM journal_lines line
          JOIN accounts account ON account.id = line.account_id
          LEFT JOIN parties party ON party.id = line.party_id
          JOIN journal_entries entry ON entry.id = line.journal_entry_id
          WHERE line.journal_entry_id = $1 AND entry.company_id = $2
          ORDER BY line.line_number
        `,
        [entryId, actor.companyId],
      ),
    ]);
    const row = entry.rows[0];
    if (!row) {
      throw new AppError(404, 'JOURNAL_NOT_FOUND', '\u0633\u0646\u062f \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
    }
    response.json({data: {...row, lines: lines.rows}});
  }),
);

accountingRouter.post(
  '/journals',
  requirePermissions(PERMISSIONS.ACCOUNTING_CREATE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = journalSchema.parse(request.body);
    if (
      input.postNow &&
      !actor.permissions.includes(PERMISSIONS.ACCOUNTING_POST)
    ) {
      throw new AppError(
        403,
        'PERMISSION_DENIED',
        '\u0645\u062c\u0648\u0632 \u062a\u0623\u06cc\u06cc\u062f \u0633\u0646\u062f \u0628\u0647 \u0634\u0645\u0627 \u062f\u0627\u062f\u0647 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.',
      );
    }

    const created = await withTransaction(async (client) => {
      const journal = await createJournalEntry(client, {
        companyId: actor.companyId,
        branchId: input.branchId,
        entryDate: input.entryDate,
        documentDate: input.documentDate,
        referenceNumber: input.referenceNumber,
        description: input.description,
        sourceType: 'manual',
        createdBy: actor.id,
        lines: input.lines,
        post: input.postNow,
      });
      await writeAudit(client, request, {
        action: input.postNow ? 'journal.create_posted' : 'journal.create',
        entityType: 'journal_entry',
        entityId: journal.id,
        after: journal,
      });
      return journal;
    });
    response.status(201).json({data: created});
  }),
);

accountingRouter.put(
  '/journals/:id',
  requirePermissions(PERMISSIONS.ACCOUNTING_EDIT),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const entryId = identifierSchema.parse(request.params.id);
    const input = journalSchema
      .omit({postNow: true})
      .extend({rowVersion: z.number().int().positive()})
      .parse(request.body);
    validateJournalLines(input.lines);

    const updated = await withTransaction(async (client) => {
      await validateJournalDimensions(client, actor.companyId, input.lines);
      const result = await client.query(
        `
          UPDATE journal_entries
          SET
            branch_id = $4,
            entry_date = $5,
            document_date = $6,
            reference_number = $7,
            description = $8,
            row_version = row_version + 1
          WHERE id = $1
            AND company_id = $2
            AND row_version = $3
            AND status = 'draft'
          RETURNING id, row_version AS "rowVersion"
        `,
        [
          entryId,
          actor.companyId,
          input.rowVersion,
          input.branchId,
          input.entryDate,
          input.documentDate ?? null,
          input.referenceNumber ?? null,
          input.description,
        ],
      );
      const row = result.rows[0];
      if (!row) {
        throw new AppError(
          409,
          'JOURNAL_NOT_EDITABLE',
          '\u0633\u0646\u062f \u0642\u0637\u0639\u06cc\u200c\u0634\u062f\u0647\u060c \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f\u0647 \u06cc\u0627 \u0647\u0645\u200c\u0632\u0645\u0627\u0646 \u062a\u063a\u06cc\u06cc\u0631 \u06a9\u0631\u062f\u0647 \u0627\u0633\u062a.',
        );
      }

      await client.query(
        'DELETE FROM journal_lines WHERE journal_entry_id = $1',
        [entryId],
      );
      for (const [index, line] of input.lines.entries()) {
        const inserted = await client.query(
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
            SELECT $1, $2, account.id, $4, $5, $6, $7, $8
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
            actor.companyId,
          ],
        );
        if (!inserted.rowCount) {
          throw new AppError(
            422,
            'INVALID_ACCOUNT',
            `\u062d\u0633\u0627\u0628 \u0631\u062f\u06cc\u0641 ${index + 1} \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.`,
          );
        }
      }
      await writeAudit(client, request, {
        action: 'journal.update',
        entityType: 'journal_entry',
        entityId: entryId,
        after: {rowVersion: row.rowVersion},
      });
      return row;
    });
    response.json({data: updated});
  }),
);

accountingRouter.post(
  '/journals/:id/post',
  requirePermissions(PERMISSIONS.ACCOUNTING_POST),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const entryId = identifierSchema.parse(request.params.id);
    const input = z
      .object({rowVersion: z.number().int().positive()})
      .parse(request.body);
    const posted = await withTransaction(async (client) => {
      const result = await client.query(
        `
          UPDATE journal_entries
          SET
            status = 'posted',
            posted_by = $4,
            row_version = row_version + 1
          WHERE id = $1
            AND company_id = $2
            AND status = 'draft'
            AND row_version = $3
          RETURNING
            id,
            entry_number::text AS "entryNumber",
            status,
            row_version AS "rowVersion"
        `,
        [entryId, actor.companyId, input.rowVersion, actor.id],
      );
      const row = result.rows[0];
      if (!row) {
        throw new AppError(
          409,
          'JOURNAL_NOT_POSTABLE',
          'سند پیدا نشد، قبلاً قطعی شده یا توسط کاربر دیگری تغییر کرده است.',
        );
      }
      await writeAudit(client, request, {
        action: 'journal.post',
        entityType: 'journal_entry',
        entityId: entryId,
        after: row,
      });
      return row;
    });
    response.json({data: posted});
  }),
);

accountingRouter.post(
  '/journals/:id/reverse',
  requirePermissions(PERMISSIONS.ACCOUNTING_VOID),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const entryId = identifierSchema.parse(request.params.id);
    const input = z
      .object({
        reversalDate: isoDateSchema,
        reason: z.string().trim().min(5).max(1000),
      })
      .parse(request.body);
    const reversal = await withTransaction((client) =>
      reverseJournalEntry(
        client,
        actor.companyId,
        entryId,
        actor.id,
        input.reversalDate,
        input.reason,
      ),
    );
    response.status(201).json({data: reversal});
  }),
);

accountingRouter.get(
  '/reports/journal',
  requirePermissions(PERMISSIONS.REPORTS_VIEW),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = rangeSchema.parse(request.query);
    const result = await query(
      `
        SELECT
          entry.id AS "entryId",
          entry.entry_number::text AS "entryNumber",
          entry.entry_date::text AS "entryDate",
          entry.reference_number AS "referenceNumber",
          entry.description AS "entryDescription",
          line.line_number AS "lineNumber",
          account.code AS "accountCode",
          account.name AS "accountName",
          party.display_name AS "partyName",
          branch.name AS "branchName",
          line.description,
          line.debit_irr::text AS "debitIrr",
          line.credit_irr::text AS "creditIrr"
        FROM journal_entries entry
        JOIN journal_lines line ON line.journal_entry_id = entry.id
        JOIN accounts account ON account.id = line.account_id
        LEFT JOIN parties party ON party.id = line.party_id
        LEFT JOIN branches branch ON branch.id = COALESCE(line.branch_id, entry.branch_id)
        WHERE entry.company_id = $1
          AND entry.status IN ('posted', 'reversed')
          AND entry.entry_date BETWEEN $2 AND $3
        ORDER BY entry.entry_date, entry.entry_number, line.line_number
      `,
      [actor.companyId, input.from, input.to],
    );
    response.json({data: result.rows});
  }),
);

accountingRouter.get(
  '/reports/general-ledger',
  requirePermissions(PERMISSIONS.REPORTS_VIEW),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = rangeSchema.parse(request.query);
    const result = await query(
      `
        WITH RECURSIVE descendants AS (
          SELECT account.id AS ancestor_id, account.id AS descendant_id
          FROM accounts account
          WHERE account.company_id = $1
          UNION ALL
          SELECT tree.ancestor_id, child.id
          FROM descendants tree
          JOIN accounts child ON child.parent_id = tree.descendant_id
          WHERE child.company_id = $1
        )
        SELECT
          general.id AS "accountId",
          general.code AS "accountCode",
          general.name AS "accountName",
          COALESCE(
            sum(line.debit_irr) FILTER (WHERE entry.id IS NOT NULL),
            0
          )::text AS "debitIrr",
          COALESCE(
            sum(line.credit_irr) FILTER (WHERE entry.id IS NOT NULL),
            0
          )::text AS "creditIrr",
          (
            COALESCE(
              sum(line.debit_irr) FILTER (WHERE entry.id IS NOT NULL),
              0
            ) -
            COALESCE(
              sum(line.credit_irr) FILTER (WHERE entry.id IS NOT NULL),
              0
            )
          )::text AS "balanceIrr"
        FROM accounts general
        LEFT JOIN descendants tree ON tree.ancestor_id = general.id
        LEFT JOIN journal_lines line ON line.account_id = tree.descendant_id
        LEFT JOIN journal_entries entry
          ON entry.id = line.journal_entry_id
          AND entry.status IN ('posted', 'reversed')
          AND entry.entry_date BETWEEN $2 AND $3
        WHERE general.company_id = $1
          AND general.account_level = 'general'
          AND general.is_active = true
        GROUP BY general.id
        ORDER BY general.code
      `,
      [actor.companyId, input.from, input.to],
    );
    response.json({data: result.rows});
  }),
);

accountingRouter.get(
  '/reports/trial-balance',
  requirePermissions(PERMISSIONS.REPORTS_VIEW),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = rangeSchema.parse(request.query);
    const result = await query(
      `
        SELECT
          account.id AS "accountId",
          account.code AS "accountCode",
          account.name AS "accountName",
          COALESCE(
            sum(line.debit_irr) FILTER (WHERE entry.id IS NOT NULL),
            0
          )::text AS "debitIrr",
          COALESCE(
            sum(line.credit_irr) FILTER (WHERE entry.id IS NOT NULL),
            0
          )::text AS "creditIrr",
          (
            COALESCE(
              sum(line.debit_irr) FILTER (WHERE entry.id IS NOT NULL),
              0
            )
            - COALESCE(
              sum(line.credit_irr) FILTER (WHERE entry.id IS NOT NULL),
              0
            )
          )::text AS "balanceIrr"
        FROM accounts account
        LEFT JOIN journal_lines line ON line.account_id = account.id
        LEFT JOIN journal_entries entry
          ON entry.id = line.journal_entry_id
          AND entry.status IN ('posted', 'reversed')
          AND entry.entry_date BETWEEN $2 AND $3
        WHERE account.company_id = $1 AND account.allows_posting = true
        GROUP BY account.id
        ORDER BY account.code
      `,
      [actor.companyId, input.from, input.to],
    );
    response.json({data: result.rows});
  }),
);

accountingRouter.get(
  '/reports/profit-loss',
  requirePermissions(PERMISSIONS.REPORTS_VIEW),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = rangeSchema.parse(request.query);
    const result = await query<StatementSourceRow>(
      `
        SELECT
          account.id AS "accountId",
          account.code AS "accountCode",
          account.name AS "accountName",
          account.account_type AS "accountType",
          COALESCE(
            sum(
              CASE
                WHEN account.account_type = 'income'
                  THEN line.credit_irr - line.debit_irr
                ELSE line.debit_irr - line.credit_irr
              END
            ) FILTER (WHERE entry.id IS NOT NULL),
            0
          )::text AS "amountIrr"
        FROM accounts account
        LEFT JOIN journal_lines line ON line.account_id = account.id
        LEFT JOIN journal_entries entry
          ON entry.id = line.journal_entry_id
          AND entry.status IN ('posted', 'reversed')
          AND entry.entry_date BETWEEN $2 AND $3
        WHERE account.company_id = $1
          AND account.allows_posting = true
          AND account.account_type IN ('income', 'expense')
        GROUP BY account.id
        ORDER BY account.code
      `,
      [actor.companyId, input.from, input.to],
    );
    response.json({
      data: buildProfitLossReport(result.rows, input.from, input.to),
    });
  }),
);

accountingRouter.get(
  '/reports/balance-sheet',
  requirePermissions(PERMISSIONS.REPORTS_VIEW),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = asOfSchema.parse(request.query);
    const result = await query<StatementSourceRow>(
      `
        SELECT
          account.id AS "accountId",
          account.code AS "accountCode",
          account.name AS "accountName",
          account.account_type AS "accountType",
          COALESCE(
            sum(
              CASE
                WHEN account.account_type IN ('asset', 'expense')
                  THEN line.debit_irr - line.credit_irr
                ELSE line.credit_irr - line.debit_irr
              END
            ) FILTER (WHERE entry.id IS NOT NULL),
            0
          )::text AS "amountIrr"
        FROM accounts account
        LEFT JOIN journal_lines line ON line.account_id = account.id
        LEFT JOIN journal_entries entry
          ON entry.id = line.journal_entry_id
          AND entry.status IN ('posted', 'reversed')
          AND entry.entry_date <= $2
        WHERE account.company_id = $1
          AND account.allows_posting = true
          AND account.account_type IN (
            'asset',
            'liability',
            'equity',
            'income',
            'expense'
          )
        GROUP BY account.id
        ORDER BY account.code
      `,
      [actor.companyId, input.asOf],
    );
    response.json({
      data: buildBalanceSheetReport(result.rows, input.asOf),
    });
  }),
);

accountingRouter.get(
  '/reports/ledger/:accountId',
  requirePermissions(PERMISSIONS.REPORTS_VIEW),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const accountId = identifierSchema.parse(request.params.accountId);
    const input = rangeSchema.parse(request.query);
    const [accountResult, openingResult] = await Promise.all([
      query(
        `
          SELECT id, code, name
          FROM accounts
          WHERE id = $1 AND company_id = $2 AND allows_posting = true
        `,
        [accountId, actor.companyId],
      ),
      query(
        `
          SELECT
            COALESCE(sum(line.debit_irr - line.credit_irr), 0)::text AS balance
          FROM journal_lines line
          JOIN journal_entries entry ON entry.id = line.journal_entry_id
          WHERE line.account_id = $1
            AND entry.company_id = $2
            AND entry.status IN ('posted', 'reversed')
            AND entry.entry_date < $3
        `,
        [accountId, actor.companyId, input.from],
      ),
    ]);
    const account = accountResult.rows[0];
    if (!account) {
      throw new AppError(
        404,
        'ACCOUNT_NOT_FOUND',
        'حساب تفصیلی انتخاب‌شده پیدا نشد.',
      );
    }
    const openingBalanceIrr = String(openingResult.rows[0]?.balance ?? '0');
    const lineResult = await query(
      `
        SELECT
          entry.id AS "entryId",
          entry.entry_number::text AS "entryNumber",
          entry.entry_date::text AS "entryDate",
          entry.reference_number AS "referenceNumber",
          entry.description AS "entryDescription",
          party.display_name AS "partyName",
          branch.name AS "branchName",
          line.description,
          line.debit_irr::text AS "debitIrr",
          line.credit_irr::text AS "creditIrr",
          ($5::bigint + sum(line.debit_irr - line.credit_irr)
            OVER (
              ORDER BY entry.entry_date, entry.entry_number, line.line_number
            ))::text AS "runningBalanceIrr"
        FROM journal_lines line
        JOIN journal_entries entry ON entry.id = line.journal_entry_id
        JOIN accounts account ON account.id = line.account_id
        LEFT JOIN parties party ON party.id = line.party_id
        LEFT JOIN branches branch
          ON branch.id = COALESCE(line.branch_id, entry.branch_id)
        WHERE account.id = $1
          AND account.company_id = $2
          AND entry.status IN ('posted', 'reversed')
          AND entry.entry_date BETWEEN $3 AND $4
        ORDER BY entry.entry_date, entry.entry_number, line.line_number
      `,
      [
        accountId,
        actor.companyId,
        input.from,
        input.to,
        openingBalanceIrr,
      ],
    );
    response.json({
      data: {
        account,
        openingBalanceIrr,
        lines: lineResult.rows,
      },
    });
  }),
);
