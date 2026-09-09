import {Router} from 'express';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {PERMISSIONS} from '../../../shared/permissions.js';
import {currentUser} from '../../common/auth-context.js';
import {AppError, asyncRoute} from '../../common/errors.js';
import {
  identifierSchema,
  isoDateSchema,
  positiveIrrSchema,
} from '../../common/values.js';
import {query, withTransaction} from '../../db/pool.js';
import {writeAudit} from '../../infrastructure/audit.js';
import {nextSequence} from '../../infrastructure/sequences.js';
import {
  createJournalEntry,
  reverseJournalEntry,
  systemAccountIds,
  type JournalLineInput,
} from '../accounting/journal.service.js';
import {
  requireAuthentication,
  requirePermissions,
} from '../auth/middleware.js';
import {
  chequeEventTypes,
  nextChequeStatus,
  type ChequeDirection,
  type ChequeStatus,
} from './cheque.lifecycle.js';

type DocumentType =
  | 'purchase_invoice'
  | 'sale_invoice'
  | 'service_order';

interface LockedDocument {
  partyId: string;
  totalIrr: bigint;
  settledIrr: bigint;
}

const allocationSchema = z.object({
  documentType: z.enum([
    'purchase_invoice',
    'sale_invoice',
    'service_order',
  ]),
  documentId: identifierSchema,
  amountIrr: positiveIrrSchema,
});

const chequeSchema = z.object({
  chequeNumber: z.string().trim().min(1).max(80),
  bankName: z.string().trim().max(160).nullable().default(null),
  branchName: z.string().trim().max(160).nullable().default(null),
  dueDate: isoDateSchema,
  bankAccountId: identifierSchema.nullable().default(null),
  currentHolder: z.string().trim().max(180).nullable().default(null),
  description: z.string().trim().max(2000).nullable().default(null),
});

export const chequeEventSchema = z
  .object({
    eventType: z.enum(chequeEventTypes),
    eventDate: isoDateSchema,
    bankAccountId: identifierSchema.nullable().default(null),
    notes: z.string().trim().max(2000).nullable().default(null),
  })
  .superRefine((value, context) => {
    if (
      (value.eventType === 'deposit' || value.eventType === 'clear') &&
      !value.bankAccountId
    ) {
      context.addIssue({
        code: 'custom',
        path: ['bankAccountId'],
        message:
          '\u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc \u0645\u0642\u0635\u062f \u0628\u0627\u06cc\u062f \u0627\u0646\u062a\u062e\u0627\u0628 \u0634\u0648\u062f.',
      });
    }
    if (
      value.eventType === 'bounce' &&
      (!value.notes || value.notes.length < 3)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['notes'],
        message: '\u062f\u0644\u06cc\u0644 \u0628\u0631\u06af\u0634\u062a \u0686\u06a9 \u0628\u0627\u06cc\u062f \u062b\u0628\u062a \u0634\u0648\u062f.',
      });
    }
  });

export const chequeEventReversalSchema = z.object({
  reversalDate: isoDateSchema,
  reason: z.string().trim().min(3).max(2000),
});

export const transactionSchema = z
  .object({
    branchId: identifierSchema,
    transactionDate: isoDateSchema,
    direction: z.enum(['receipt', 'payment']),
    paymentMethod: z.enum(['cash', 'bank', 'card', 'cheque']),
    cashboxId: identifierSchema.nullable().default(null),
    bankAccountId: identifierSchema.nullable().default(null),
    amountIrr: positiveIrrSchema,
    referenceNumber: z.string().trim().max(120).nullable().default(null),
    description: z.string().trim().min(2).max(2000),
    allocations: z.array(allocationSchema).min(1).max(100),
    cheque: chequeSchema.nullable().default(null),
  })
  .superRefine((value, context) => {
    const documentKeys = new Set<string>();
    value.allocations.forEach((allocation, index) => {
      const key = `${allocation.documentType}:${allocation.documentId}`;
      if (documentKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          path: ['allocations', index, 'documentId'],
          message: '\u0647\u0631 \u0633\u0646\u062f \u0641\u0642\u0637 \u06cc\u06a9\u200c\u0628\u0627\u0631 \u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u062f \u062f\u0631 \u06cc\u06a9 \u062a\u0631\u0627\u06a9\u0646\u0634 \u062a\u062e\u0635\u06cc\u0635 \u062f\u0627\u062f\u0647 \u0634\u0648\u062f.',
        });
      }
      documentKeys.add(key);
    });
    if (value.paymentMethod === 'cash' && !value.cashboxId) {
      context.addIssue({
        code: 'custom',
        path: ['cashboxId'],
        message: '\u0635\u0646\u062f\u0648\u0642 \u0628\u0627\u06cc\u062f \u0627\u0646\u062a\u062e\u0627\u0628 \u0634\u0648\u062f.',
      });
    }
    if (
      ['bank', 'card'].includes(value.paymentMethod) &&
      !value.bankAccountId
    ) {
      context.addIssue({
        code: 'custom',
        path: ['bankAccountId'],
        message: '\u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc \u0628\u0627\u06cc\u062f \u0627\u0646\u062a\u062e\u0627\u0628 \u0634\u0648\u062f.',
      });
    }
    if (value.paymentMethod === 'cheque' && !value.cheque) {
      context.addIssue({
        code: 'custom',
        path: ['cheque'],
        message: '\u0645\u0634\u062e\u0635\u0627\u062a \u0686\u06a9 \u0628\u0627\u06cc\u062f \u06a9\u0627\u0645\u0644 \u0634\u0648\u062f.',
      });
    }
    const allocated = value.allocations.reduce(
      (sum, allocation) => sum + BigInt(allocation.amountIrr),
      0n,
    );
    if (allocated !== BigInt(value.amountIrr)) {
      context.addIssue({
        code: 'custom',
        path: ['allocations'],
        message: '\u062c\u0645\u0639 \u062a\u062e\u0635\u06cc\u0635\u200c\u0647\u0627 \u0628\u0627\u06cc\u062f \u062f\u0642\u06cc\u0642\u0627\u064b \u0628\u0631\u0627\u0628\u0631 \u0645\u0628\u0644\u063a \u062f\u0631\u06cc\u0627\u0641\u062a \u06cc\u0627 \u067e\u0631\u062f\u0627\u062e\u062a \u0628\u0627\u0634\u062f.',
      });
    }
  });


export function validateTransactionReversalDate(
  reversalDate: string,
  transactionDate: string,
): void {
  if (reversalDate < transactionDate) {
    throw new AppError(
      422,
      'REVERSAL_DATE_BEFORE_TRANSACTION',
      'تاریخ برگشت نمی‌تواند پیش از تاریخ تراکنش اصلی باشد.',
    );
  }
}

async function lockDocument(
  client: PoolClient,
  companyId: string,
  documentType: DocumentType,
  documentId: string,
): Promise<LockedDocument> {
  if (documentType === 'sale_invoice') {
    const result = await client.query<{
      party_id: string;
      total_irr: string;
      settled_irr: string;
    }>(
      `
        SELECT
          customer_id AS party_id,
          total_irr::text,
          (received_irr + returned_irr)::text AS settled_irr
        FROM sale_invoices
        WHERE id = $1 AND company_id = $2 AND status = 'posted'
        FOR UPDATE
      `,
      [documentId, companyId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError(
        422,
        'SALE_INVOICE_NOT_PAYABLE',
        '\u0641\u0627\u06a9\u062a\u0648\u0631 \u0641\u0631\u0648\u0634 \u0642\u0637\u0639\u06cc \u0648 \u0645\u0639\u062a\u0628\u0631\u06cc \u0628\u0631\u0627\u06cc \u062a\u062e\u0635\u06cc\u0635 \u062f\u0631\u06cc\u0627\u0641\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.',
      );
    }
    return {
      partyId: row.party_id,
      totalIrr: BigInt(row.total_irr),
      settledIrr: BigInt(row.settled_irr),
    };
  }
  if (documentType === 'purchase_invoice') {
    const result = await client.query<{
      party_id: string;
      total_irr: string;
      settled_irr: string;
    }>(
      `
        SELECT
          supplier_id AS party_id,
          total_irr::text,
          (paid_irr + returned_irr)::text AS settled_irr
        FROM purchase_invoices
        WHERE id = $1 AND company_id = $2 AND status = 'posted'
        FOR UPDATE
      `,
      [documentId, companyId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError(
        422,
        'PURCHASE_INVOICE_NOT_PAYABLE',
        '\u0641\u0627\u06a9\u062a\u0648\u0631 \u062e\u0631\u06cc\u062f \u0642\u0637\u0639\u06cc \u0648 \u0645\u0639\u062a\u0628\u0631\u06cc \u0628\u0631\u0627\u06cc \u062a\u062e\u0635\u06cc\u0635 \u067e\u0631\u062f\u0627\u062e\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.',
      );
    }
    return {
      partyId: row.party_id,
      totalIrr: BigInt(row.total_irr),
      settledIrr: BigInt(row.settled_irr),
    };
  }
  const result = await client.query<{
    party_id: string;
    total_irr: string;
    settled_irr: string;
  }>(
    `
      SELECT
        customer_id AS party_id,
        final_cost_irr::text AS total_irr,
        paid_irr::text AS settled_irr
      FROM service_orders
      WHERE id = $1
        AND company_id = $2
        AND status IN ('ready_delivery', 'delivered')
        AND final_cost_irr > 0
      FOR UPDATE
    `,
    [documentId, companyId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AppError(
      422,
      'SERVICE_ORDER_NOT_PAYABLE',
      '\u067e\u0631\u0648\u0646\u062f\u0647 \u062e\u062f\u0645\u0627\u062a \u0646\u0647\u0627\u06cc\u06cc\u200c\u0634\u062f\u0647 \u0648 \u0642\u0627\u0628\u0644 \u062a\u0633\u0648\u06cc\u0647 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.',
    );
  }
  return {
    partyId: row.party_id,
    totalIrr: BigInt(row.total_irr),
    settledIrr: BigInt(row.settled_irr),
  };
}

async function updateDocumentSettlement(
  client: PoolClient,
  documentType: DocumentType,
  documentId: string,
  delta: bigint,
): Promise<void> {
  if (documentType === 'sale_invoice') {
    await client.query(
      `
        UPDATE sale_invoices
        SET
          received_irr = received_irr + $2,
          payment_status = CASE
            WHEN received_irr + $2 + returned_irr = 0 THEN 'unpaid'
            WHEN received_irr + $2 + returned_irr >= total_irr THEN 'paid'
            ELSE 'partial'
          END,
          row_version = row_version + 1
        WHERE id = $1
      `,
      [documentId, delta.toString()],
    );
    return;
  }
  if (documentType === 'purchase_invoice') {
    await client.query(
      `
        UPDATE purchase_invoices
        SET
          paid_irr = paid_irr + $2,
          payment_status = CASE
            WHEN paid_irr + $2 + returned_irr = 0 THEN 'unpaid'
            WHEN paid_irr + $2 + returned_irr >= total_irr THEN 'paid'
            ELSE 'partial'
          END,
          row_version = row_version + 1
        WHERE id = $1
      `,
      [documentId, delta.toString()],
    );
    return;
  }
  await client.query(
    `
      UPDATE service_orders
      SET paid_irr = paid_irr + $2, row_version = row_version + 1
      WHERE id = $1
    `,
    [documentId, delta.toString()],
  );
}

async function paymentAccount(
  client: PoolClient,
  companyId: string,
  branchId: string,
  method: 'cash' | 'bank' | 'card' | 'cheque',
  direction: 'receipt' | 'payment',
  cashboxId: string | null,
  bankAccountId: string | null,
): Promise<string> {
  if (method === 'cash') {
    const result = await client.query<{account_id: string}>(
      `
        SELECT account_id
        FROM cashboxes
        WHERE id = $1
          AND company_id = $2
          AND branch_id = $3
          AND is_active = true
      `,
      [cashboxId, companyId, branchId],
    );
    const accountId = result.rows[0]?.account_id;
    if (!accountId) {
      throw new AppError(422, 'INVALID_CASHBOX', '\u0635\u0646\u062f\u0648\u0642 \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.');
    }
    return accountId;
  }
  if (method === 'bank' || method === 'card') {
    const result = await client.query<{account_id: string}>(
      `
        SELECT account_id
        FROM bank_accounts
        WHERE id = $1 AND company_id = $2 AND is_active = true
      `,
      [bankAccountId, companyId],
    );
    const accountId = result.rows[0]?.account_id;
    if (!accountId) {
      throw new AppError(
        422,
        'INVALID_BANK_ACCOUNT',
        '\u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.',
      );
    }
    return accountId;
  }
  const key =
    direction === 'receipt' ? 'cheques_receivable' : 'cheques_payable';
  const accounts = await systemAccountIds(client, companyId, [key]);
  return accounts.get(key) as string;
}

export const treasuryRouter = Router();
treasuryRouter.use(
  requireAuthentication,
  requirePermissions(PERMISSIONS.TREASURY_VIEW),
);

treasuryRouter.get(
  '/accounts',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const [banks, cashboxes] = await Promise.all([
      query(
        `
          SELECT
            bank.id,
            bank.bank_name AS "bankName",
            bank.branch_name AS "branchName",
            bank.account_number AS "accountNumber",
            bank.iban,
            bank.card_number AS "cardNumber",
            bank.is_active AS "isActive",
            branch.name AS "branch"
          FROM bank_accounts bank
          LEFT JOIN branches branch ON branch.id = bank.branch_id
          WHERE bank.company_id = $1
          ORDER BY bank.is_active DESC, bank.bank_name
        `,
        [actor.companyId],
      ),
      query(
        `
          SELECT
            cashbox.id,
            cashbox.code,
            cashbox.name,
            cashbox.is_active AS "isActive",
            branch.name AS "branch"
          FROM cashboxes cashbox
          JOIN branches branch ON branch.id = cashbox.branch_id
          WHERE cashbox.company_id = $1
          ORDER BY cashbox.is_active DESC, cashbox.code
        `,
        [actor.companyId],
      ),
    ]);
    response.json({
      data: {bankAccounts: banks.rows, cashboxes: cashboxes.rows},
    });
  }),
);

treasuryRouter.get(
  '/parties',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const result = await query(
      `
        SELECT
          id,
          code,
          display_name AS "displayName",
          is_customer AS "isCustomer",
          is_supplier AS "isSupplier"
        FROM parties
        WHERE company_id = $1
          AND is_active = true
          AND (is_customer = true OR is_supplier = true)
        ORDER BY display_name
        LIMIT 1000
      `,
      [actor.companyId],
    );
    response.json({data: result.rows});
  }),
);

treasuryRouter.post(
  '/bank-accounts',
  requirePermissions(PERMISSIONS.TREASURY_MANAGE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        branchId: identifierSchema.nullable().default(null),
        bankName: z.string().trim().min(2).max(160),
        branchName: z.string().trim().max(160).nullable().default(null),
        accountNumber: z.string().trim().max(80).nullable().default(null),
        iban: z.string().trim().max(40).nullable().default(null),
        cardNumber: z.string().trim().max(30).nullable().default(null),
      })
      .parse(request.body);
    const created = await withTransaction(async (client) => {
      const accounts = await systemAccountIds(client, actor.companyId, ['bank']);
      const result = await client.query<{id: string}>(
        `
          INSERT INTO bank_accounts (
            company_id,
            branch_id,
            account_id,
            bank_name,
            branch_name,
            account_number,
            iban,
            card_number
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `,
        [
          actor.companyId,
          input.branchId,
          accounts.get('bank'),
          input.bankName,
          input.branchName,
          input.accountNumber,
          input.iban,
          input.cardNumber,
        ],
      );
      const id = result.rows[0]?.id;
      if (!id) throw new Error('Bank account was not created');
      await writeAudit(client, request, {
        action: 'treasury.bank_account_create',
        entityType: 'bank_account',
        entityId: id,
        after: input,
      });
      return {id};
    });
    response.status(201).json({data: created});
  }),
);

treasuryRouter.post(
  '/cashboxes',
  requirePermissions(PERMISSIONS.TREASURY_MANAGE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        branchId: identifierSchema,
        code: z.string().trim().min(1).max(40),
        name: z.string().trim().min(2).max(120),
      })
      .parse(request.body);
    const created = await withTransaction(async (client) => {
      const accounts = await systemAccountIds(client, actor.companyId, ['cash']);
      const result = await client.query<{id: string}>(
        `
          INSERT INTO cashboxes (
            company_id,
            branch_id,
            account_id,
            code,
            name
          )
          SELECT $1, branch.id, $3, $4, $5
          FROM branches branch
          WHERE branch.id = $2
            AND branch.company_id = $1
            AND branch.is_active = true
          RETURNING id
        `,
        [
          actor.companyId,
          input.branchId,
          accounts.get('cash'),
          input.code,
          input.name,
        ],
      );
      const id = result.rows[0]?.id;
      if (!id) {
        throw new AppError(422, 'INVALID_BRANCH', '\u0634\u0639\u0628\u0647 \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.');
      }
      await writeAudit(client, request, {
        action: 'treasury.cashbox_create',
        entityType: 'cashbox',
        entityId: id,
        after: input,
      });
      return {id};
    });
    response.status(201).json({data: created});
  }),
);

treasuryRouter.get(
  '/open-documents',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        partyId: identifierSchema,
        direction: z.enum(['receipt', 'payment']),
      })
      .parse(request.query);
    const sql =
      input.direction === 'receipt'
        ? `
            SELECT
              id,
              'sale_invoice' AS "documentType",
              invoice_number::text AS "documentNumber",
              invoice_date AS "documentDate",
              total_irr::text AS "totalIrr",
              (received_irr + returned_irr)::text AS "settledIrr",
              (total_irr - received_irr - returned_irr)::text AS "remainingIrr"
            FROM sale_invoices
            WHERE company_id = $1
              AND customer_id = $2
              AND status = 'posted'
              AND received_irr + returned_irr < total_irr
            UNION ALL
            SELECT
              id,
              'service_order' AS "documentType",
              order_number::text AS "documentNumber",
              received_at::date AS "documentDate",
              final_cost_irr::text AS "totalIrr",
              paid_irr::text AS "settledIrr",
              (final_cost_irr - paid_irr)::text AS "remainingIrr"
            FROM service_orders
            WHERE company_id = $1
              AND customer_id = $2
              AND status IN ('ready_delivery', 'delivered')
              AND paid_irr < final_cost_irr
            ORDER BY "documentDate"
          `
        : `
            SELECT
              id,
              'purchase_invoice' AS "documentType",
              invoice_number::text AS "documentNumber",
              invoice_date AS "documentDate",
              total_irr::text AS "totalIrr",
              (paid_irr + returned_irr)::text AS "settledIrr",
              (total_irr - paid_irr - returned_irr)::text AS "remainingIrr"
            FROM purchase_invoices
            WHERE company_id = $1
              AND supplier_id = $2
              AND status = 'posted'
              AND paid_irr + returned_irr < total_irr
            ORDER BY invoice_date
          `;
    const result = await query(sql, [actor.companyId, input.partyId]);
    response.json({data: result.rows});
  }),
);

treasuryRouter.get(
  '/transactions',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        direction: z.enum(['receipt', 'payment']).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(request.query);
    const result = await query(
      `
        SELECT
          transaction.id,
          transaction.transaction_number::text AS "transactionNumber",
          transaction.transaction_date AS "transactionDate",
          transaction.direction,
          transaction.payment_method AS "paymentMethod",
          transaction.amount_irr::text AS "amountIrr",
          transaction.reference_number AS "referenceNumber",
          transaction.description,
          transaction.status,
          party.display_name AS "partyName",
          branch.name AS "branchName"
        FROM treasury_transactions transaction
        LEFT JOIN parties party ON party.id = transaction.party_id
        JOIN branches branch ON branch.id = transaction.branch_id
        WHERE transaction.company_id = $1
          AND ($2::text IS NULL OR transaction.direction = $2)
        ORDER BY transaction.transaction_date DESC, transaction.transaction_number DESC
        LIMIT $3 OFFSET $4
      `,
      [actor.companyId, input.direction ?? null, input.limit, input.offset],
    );
    response.json({data: result.rows});
  }),
);

treasuryRouter.post(
  '/transactions',
  requirePermissions(PERMISSIONS.TREASURY_MANAGE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = transactionSchema.parse(request.body);
    const created = await withTransaction(async (client) => {
      const lockedDocuments: Array<{
        type: DocumentType;
        id: string;
        amount: bigint;
        document: LockedDocument;
      }> = [];
      let partyId: string | null = null;
      for (const allocation of input.allocations) {
        const expectedDirection =
          allocation.documentType === 'purchase_invoice'
            ? 'payment'
            : 'receipt';
        if (expectedDirection !== input.direction) {
          throw new AppError(
            422,
            'DOCUMENT_DIRECTION_MISMATCH',
            '\u0646\u0648\u0639 \u0633\u0646\u062f \u0628\u0627 \u062f\u0631\u06cc\u0627\u0641\u062a \u06cc\u0627 \u067e\u0631\u062f\u0627\u062e\u062a \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0633\u0627\u0632\u06af\u0627\u0631 \u0646\u06cc\u0633\u062a.',
          );
        }
        const document = await lockDocument(
          client,
          actor.companyId,
          allocation.documentType,
          allocation.documentId,
        );
        if (partyId && partyId !== document.partyId) {
          throw new AppError(
            422,
            'MULTIPLE_PARTIES_NOT_ALLOWED',
            '\u0647\u0645\u0647 \u0627\u0633\u0646\u0627\u062f \u06cc\u06a9 \u062a\u0631\u0627\u06a9\u0646\u0634 \u0628\u0627\u06cc\u062f \u0645\u062a\u0639\u0644\u0642 \u0628\u0647 \u06cc\u06a9 \u0637\u0631\u0641\u200c\u062d\u0633\u0627\u0628 \u0628\u0627\u0634\u0646\u062f.',
          );
        }
        partyId = document.partyId;
        const amount = BigInt(allocation.amountIrr);
        if (amount > document.totalIrr - document.settledIrr) {
          throw new AppError(
            422,
            'ALLOCATION_EXCEEDS_BALANCE',
            '\u0645\u0628\u0644\u063a \u062a\u062e\u0635\u06cc\u0635 \u0627\u0632 \u0645\u0627\u0646\u062f\u0647 \u0633\u0646\u062f \u0628\u06cc\u0634\u062a\u0631 \u0627\u0633\u062a.',
          );
        }
        lockedDocuments.push({
          type: allocation.documentType,
          id: allocation.documentId,
          amount,
          document,
        });
      }
      if (!partyId) throw new Error('Transaction has no party');

      const accountId = await paymentAccount(
        client,
        actor.companyId,
        input.branchId,
        input.paymentMethod,
        input.direction,
        input.cashboxId,
        input.bankAccountId,
      );

      let chequeId: string | null = null;
      if (input.paymentMethod === 'cheque' && input.cheque) {
        if (input.cheque.bankAccountId) {
          const bankAccount = await client.query(
            `
              SELECT 1
              FROM bank_accounts
              WHERE id = $1
                AND company_id = $2
                AND is_active = true
            `,
            [input.cheque.bankAccountId, actor.companyId],
          );
          if (!bankAccount.rowCount) {
            throw new AppError(
              422,
              'INVALID_CHEQUE_BANK_ACCOUNT',
              '\u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc \u0645\u0631\u062a\u0628\u0637 \u0628\u0627 \u0686\u06a9 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.',
            );
          }
        }
        const chequeResult = await client.query<{id: string}>(
          `
            INSERT INTO cheques (
              company_id,
              party_id,
              bank_account_id,
              cheque_number,
              bank_name,
              branch_name,
              due_date,
              amount_irr,
              direction,
              status,
              current_holder,
              description
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9,
              $10, $11, $12
            )
            RETURNING id
          `,
          [
            actor.companyId,
            partyId,
            input.cheque.bankAccountId,
            input.cheque.chequeNumber,
            input.cheque.bankName,
            input.cheque.branchName,
            input.cheque.dueDate,
            input.amountIrr,
            input.direction === 'receipt' ? 'receivable' : 'payable',
            input.direction === 'receipt' ? 'received' : 'issued',
            input.cheque.currentHolder,
            input.cheque.description,
          ],
        );
        chequeId = chequeResult.rows[0]?.id ?? null;
        if (!chequeId) throw new Error('Cheque was not created');
      }

      const number = await nextSequence(
        client,
        actor.companyId,
        'treasury_transaction',
        input.branchId,
      );
      const transactionResult = await client.query<{id: string}>(
        `
          INSERT INTO treasury_transactions (
            company_id,
            branch_id,
            transaction_number,
            transaction_date,
            direction,
            payment_method,
            party_id,
            cashbox_id,
            bank_account_id,
            cheque_id,
            amount_irr,
            reference_number,
            description,
            status,
            created_by,
            posted_by,
            posted_at
          )
          SELECT
            $1, branch.id, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, 'posted', $14, $14, now()
          FROM branches branch
          WHERE branch.id = $2
            AND branch.company_id = $1
            AND branch.is_active = true
          RETURNING id
        `,
        [
          actor.companyId,
          input.branchId,
          number.toString(),
          input.transactionDate,
          input.direction,
          input.paymentMethod,
          partyId,
          input.paymentMethod === 'cash' ? input.cashboxId : null,
          ['bank', 'card'].includes(input.paymentMethod)
            ? input.bankAccountId
            : null,
          chequeId,
          input.amountIrr,
          input.referenceNumber,
          input.description,
          actor.id,
        ],
      );
      const transactionId = transactionResult.rows[0]?.id;
      if (!transactionId) {
        throw new AppError(422, 'INVALID_BRANCH', '\u0634\u0639\u0628\u0647 \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.');
      }

      for (const allocation of lockedDocuments) {
        await client.query(
          `
            INSERT INTO payment_allocations (
              treasury_transaction_id,
              document_type,
              document_id,
              amount_irr
            )
            VALUES ($1, $2, $3, $4)
          `,
          [
            transactionId,
            allocation.type,
            allocation.id,
            allocation.amount.toString(),
          ],
        );
        await updateDocumentSettlement(
          client,
          allocation.type,
          allocation.id,
          allocation.amount,
        );
      }

      const counterKey =
        input.direction === 'receipt'
          ? 'accounts_receivable'
          : 'accounts_payable';
      const accounts = await systemAccountIds(client, actor.companyId, [
        counterKey,
      ]);
      const counterAccountId = accounts.get(counterKey) as string;
      const lines: JournalLineInput[] =
        input.direction === 'receipt'
          ? [
              {
                accountId,
                debitIrr: input.amountIrr,
                creditIrr: '0',
              },
              {
                accountId: counterAccountId,
                partyId,
                debitIrr: '0',
                creditIrr: input.amountIrr,
              },
            ]
          : [
              {
                accountId: counterAccountId,
                partyId,
                debitIrr: input.amountIrr,
                creditIrr: '0',
              },
              {
                accountId,
                debitIrr: '0',
                creditIrr: input.amountIrr,
              },
            ];
      const journal = await createJournalEntry(client, {
        companyId: actor.companyId,
        branchId: input.branchId,
        entryDate: input.transactionDate,
        referenceNumber: input.referenceNumber,
        description: input.description,
        sourceType: 'treasury_transaction',
        sourceId: transactionId,
        createdBy: actor.id,
        lines,
        post: true,
      });
      await client.query(
        `
          UPDATE treasury_transactions
          SET journal_entry_id = $2
          WHERE id = $1
        `,
        [transactionId, journal.id],
      );
      await writeAudit(client, request, {
        action: 'treasury.transaction_post',
        entityType: 'treasury_transaction',
        entityId: transactionId,
        after: {
          transactionNumber: number.toString(),
          direction: input.direction,
          amountIrr: input.amountIrr,
          allocations: input.allocations,
        },
      });
      return {
        id: transactionId,
        transactionNumber: number.toString(),
        journalEntryId: journal.id,
      };
    });
    response.status(201).json({data: created});
  }),
);

treasuryRouter.post(
  '/transactions/:id/reverse',
  requirePermissions(PERMISSIONS.TREASURY_MANAGE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    const input = z
      .object({
        reversalDate: isoDateSchema,
        reason: z.string().trim().min(3).max(2000),
      })
      .parse(request.body);
    const reversal = await withTransaction(async (client) => {
      const transactionResult = await client.query<{
        journal_entry_id: string;
        transaction_date: string;
        status: string;
        direction: 'receipt' | 'payment';
        cheque_id: string | null;
        cheque_status: ChequeStatus | null;
      }>(
        `
          SELECT
            transaction.journal_entry_id,
            transaction.transaction_date::text,
            transaction.status,
            transaction.direction,
            transaction.cheque_id,
            cheque.status AS cheque_status
          FROM treasury_transactions transaction
          LEFT JOIN cheques cheque ON cheque.id = transaction.cheque_id
          WHERE transaction.id = $1 AND transaction.company_id = $2
          FOR UPDATE OF transaction
        `,
        [id, actor.companyId],
      );
      const transaction = transactionResult.rows[0];
      if (!transaction) {
        throw new AppError(
          404,
          'TREASURY_TRANSACTION_NOT_FOUND',
          '\u062a\u0631\u0627\u06a9\u0646\u0634 \u062e\u0632\u0627\u0646\u0647 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.',
        );
      }
      if (transaction.status !== 'posted' || !transaction.journal_entry_id) {
        throw new AppError(
          409,
          'TREASURY_TRANSACTION_NOT_REVERSIBLE',
          '\u0627\u06cc\u0646 \u062a\u0631\u0627\u06a9\u0646\u0634 \u0642\u0627\u0628\u0644 \u0628\u0631\u06af\u0634\u062a \u0646\u06cc\u0633\u062a.',
        );
      }
      validateTransactionReversalDate(
        input.reversalDate,
        transaction.transaction_date,
      );
      if (transaction.cheque_id) {
        const initialStatus =
          transaction.direction === 'receipt' ? 'received' : 'issued';
        if (transaction.cheque_status !== initialStatus) {
          throw new AppError(
            409,
            'CHEQUE_LIFECYCLE_ALREADY_STARTED',
            '\u0628\u0631\u0627\u06cc \u0628\u0631\u06af\u0634\u062a \u0627\u06cc\u0646 \u062a\u0631\u0627\u06a9\u0646\u0634\u060c \u0627\u0628\u062a\u062f\u0627 \u0628\u0627\u06cc\u062f \u0622\u062e\u0631\u06cc\u0646 \u0639\u0645\u0644\u06cc\u0627\u062a \u0686\u06a9 \u0628\u0631\u06af\u0634\u062a \u062f\u0627\u062f\u0647 \u0634\u0648\u062f.',
          );
        }
      }
      const allocations = await client.query<{
        document_type: DocumentType;
        document_id: string;
        amount_irr: string;
      }>(
        `
          SELECT document_type, document_id, amount_irr::text
          FROM payment_allocations
          WHERE treasury_transaction_id = $1
          FOR UPDATE
        `,
        [id],
      );
      for (const allocation of allocations.rows) {
        await updateDocumentSettlement(
          client,
          allocation.document_type,
          allocation.document_id,
          -BigInt(allocation.amount_irr),
        );
      }
      const journal = await reverseJournalEntry(
        client,
        actor.companyId,
        transaction.journal_entry_id,
        actor.id,
        input.reversalDate,
        input.reason,
      );
      await client.query(
        `
          UPDATE treasury_transactions
          SET status = 'reversed', row_version = row_version + 1
          WHERE id = $1
        `,
        [id],
      );
      if (transaction.cheque_id) {
        await client.query(
          `
            UPDATE cheques
            SET status = 'cancelled', row_version = row_version + 1
            WHERE id = $1
              AND status IN ('received', 'issued')
          `,
          [transaction.cheque_id],
        );
      }
      await writeAudit(client, request, {
        action: 'treasury.transaction_reverse',
        entityType: 'treasury_transaction',
        entityId: id,
        after: {reason: input.reason, reversalJournalId: journal.id},
      });
      return {journalEntryId: journal.id};
    });
    response.json({data: reversal});
  }),
);

treasuryRouter.get(
  '/cheques',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const result = await query(
      `
        SELECT
          cheque.id,
          cheque.cheque_number AS "chequeNumber",
          cheque.bank_name AS "bankName",
          cheque.due_date AS "dueDate",
          cheque.amount_irr::text AS "amountIrr",
          cheque.direction,
          cheque.status,
          cheque.current_holder AS "currentHolder",
          party.display_name AS "partyName",
          latest_event.id AS "latestEventId",
          latest_event.event_type AS "latestEventType"
        FROM cheques cheque
        LEFT JOIN parties party ON party.id = cheque.party_id
        LEFT JOIN LATERAL (
          SELECT event.id, event.event_type
          FROM cheque_events event
          WHERE event.cheque_id = cheque.id
            AND event.company_id = cheque.company_id
            AND event.reversed_at IS NULL
          ORDER BY event.created_at DESC, event.id DESC
          LIMIT 1
        ) latest_event ON true
        WHERE cheque.company_id = $1
        ORDER BY cheque.due_date, cheque.created_at
      `,
      [actor.companyId],
    );
    response.json({data: result.rows});
  }),
);

treasuryRouter.get(
  '/cheques/:id/events',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const chequeId = identifierSchema.parse(request.params.id);
    const result = await query(
      `
        SELECT
          event.id,
          event.event_type AS "eventType",
          event.event_date AS "eventDate",
          event.from_status AS "fromStatus",
          event.to_status AS "toStatus",
          event.notes,
          event.created_at AS "createdAt",
          event.reversed_at AS "reversedAt",
          event.reversal_date AS "reversalDate",
          event.reversal_reason AS "reversalReason",
          bank.bank_name AS "bankName",
          creator.full_name AS "createdByName",
          reverser.full_name AS "reversedByName",
          journal.entry_number::text AS "journalEntryNumber",
          reversal_journal.entry_number::text AS "reversalJournalEntryNumber"
        FROM cheque_events event
        JOIN cheques cheque ON cheque.id = event.cheque_id
        LEFT JOIN bank_accounts bank
          ON bank.id = event.bank_account_id
          AND bank.company_id = event.company_id
        JOIN users creator
          ON creator.id = event.created_by
          AND creator.company_id = event.company_id
        LEFT JOIN users reverser
          ON reverser.id = event.reversed_by
          AND reverser.company_id = event.company_id
        LEFT JOIN journal_entries journal
          ON journal.id = event.journal_entry_id
          AND journal.company_id = event.company_id
        LEFT JOIN journal_entries reversal_journal
          ON reversal_journal.id = event.reversal_journal_entry_id
          AND reversal_journal.company_id = event.company_id
        WHERE event.cheque_id = $1
          AND event.company_id = $2
          AND cheque.company_id = $2
        ORDER BY event.created_at DESC, event.id DESC
      `,
      [chequeId, actor.companyId],
    );
    response.json({data: result.rows});
  }),
);

treasuryRouter.post(
  '/cheques/:id/events',
  requirePermissions(PERMISSIONS.TREASURY_MANAGE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const chequeId = identifierSchema.parse(request.params.id);
    const input = chequeEventSchema.parse(request.body);
    const created = await withTransaction(async (client) => {
      const chequeResult = await client.query<{
        id: string;
        cheque_number: string;
        direction: ChequeDirection;
        status: ChequeStatus;
        amount_irr: string;
        party_id: string | null;
        bank_account_id: string | null;
        current_holder: string | null;
      }>(
        `
          SELECT
            id,
            cheque_number,
            direction,
            status,
            amount_irr::text,
            party_id,
            bank_account_id,
            current_holder
          FROM cheques
          WHERE id = $1 AND company_id = $2
          FOR UPDATE
        `,
        [chequeId, actor.companyId],
      );
      const cheque = chequeResult.rows[0];
      if (!cheque) {
        throw new AppError(
          404,
          'CHEQUE_NOT_FOUND',
          '\u0686\u06a9 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.',
        );
      }
      const nextStatus = nextChequeStatus(
        cheque.direction,
        cheque.status,
        input.eventType,
      );
      if (!nextStatus) {
        throw new AppError(
          409,
          'INVALID_CHEQUE_TRANSITION',
          '\u0627\u06cc\u0646 \u0639\u0645\u0644\u06cc\u0627\u062a \u0628\u0627 \u0648\u0636\u0639\u06cc\u062a \u0641\u0639\u0644\u06cc \u0686\u06a9 \u0633\u0627\u0632\u06af\u0627\u0631 \u0646\u06cc\u0633\u062a.',
        );
      }

      const sourceTransaction = await client.query<{branch_id: string}>(
        `
          SELECT branch_id
          FROM treasury_transactions
          WHERE company_id = $1
            AND cheque_id = $2
            AND status = 'posted'
          ORDER BY created_at
          LIMIT 1
        `,
        [actor.companyId, chequeId],
      );
      const branchId = sourceTransaction.rows[0]?.branch_id;
      if (!branchId) {
        throw new AppError(
          409,
          'CHEQUE_SOURCE_TRANSACTION_MISSING',
          '\u062a\u0631\u0627\u06a9\u0646\u0634 \u0645\u0628\u062f\u0623 \u0686\u06a9 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.',
        );
      }

      let bankAccount: {
        account_id: string;
        bank_name: string;
      } | null = null;
      if (input.bankAccountId) {
        const bankResult = await client.query<{
          account_id: string;
          bank_name: string;
        }>(
          `
            SELECT account_id, bank_name
            FROM bank_accounts
            WHERE id = $1
              AND company_id = $2
              AND is_active = true
          `,
          [input.bankAccountId, actor.companyId],
        );
        bankAccount = bankResult.rows[0] ?? null;
        if (!bankAccount) {
          throw new AppError(
            422,
            'INVALID_BANK_ACCOUNT',
            '\u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.',
          );
        }
      }

      const eventResult = await client.query<{id: string}>(
        `
          INSERT INTO cheque_events (
            company_id,
            cheque_id,
            event_type,
            event_date,
            from_status,
            to_status,
            bank_account_id,
            previous_bank_account_id,
            previous_holder,
            notes,
            created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
        `,
        [
          actor.companyId,
          chequeId,
          input.eventType,
          input.eventDate,
          cheque.status,
          nextStatus,
          input.bankAccountId,
          cheque.bank_account_id,
          cheque.current_holder,
          input.notes,
          actor.id,
        ],
      );
      const eventId = eventResult.rows[0]?.id;
      if (!eventId) throw new Error('Cheque event was not created');

      let journalEntryId: string | null = null;
      if (input.eventType === 'clear') {
        if (!bankAccount) {
          throw new AppError(
            422,
            'BANK_ACCOUNT_REQUIRED',
            '\u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc \u0628\u0631\u0627\u06cc \u0648\u0635\u0648\u0644 \u06cc\u0627 \u067e\u0627\u0633 \u0686\u06a9 \u0627\u0644\u0632\u0627\u0645\u06cc \u0627\u0633\u062a.',
          );
        }
        const chequeAccountKey =
          cheque.direction === 'receivable'
            ? 'cheques_receivable'
            : 'cheques_payable';
        const accounts = await systemAccountIds(client, actor.companyId, [
          chequeAccountKey,
        ]);
        const chequeAccountId = accounts.get(chequeAccountKey) as string;
        const lines: JournalLineInput[] =
          cheque.direction === 'receivable'
            ? [
                {
                  accountId: bankAccount.account_id,
                  debitIrr: cheque.amount_irr,
                  creditIrr: '0',
                },
                {
                  accountId: chequeAccountId,
                  partyId: cheque.party_id,
                  debitIrr: '0',
                  creditIrr: cheque.amount_irr,
                },
              ]
            : [
                {
                  accountId: chequeAccountId,
                  partyId: cheque.party_id,
                  debitIrr: cheque.amount_irr,
                  creditIrr: '0',
                },
                {
                  accountId: bankAccount.account_id,
                  debitIrr: '0',
                  creditIrr: cheque.amount_irr,
                },
              ];
        const description =
          cheque.direction === 'receivable'
            ? `\u0648\u0635\u0648\u0644 \u0686\u06a9 ${cheque.cheque_number}`
            : `\u067e\u0627\u0633 \u0686\u06a9 \u067e\u0631\u062f\u0627\u062e\u062a\u0646\u06cc ${cheque.cheque_number}`;
        const journal = await createJournalEntry(client, {
          companyId: actor.companyId,
          branchId,
          entryDate: input.eventDate,
          referenceNumber: cheque.cheque_number,
          description,
          sourceType: 'cheque_event',
          sourceId: eventId,
          createdBy: actor.id,
          lines,
          post: true,
        });
        journalEntryId = journal.id;
        await client.query(
          'UPDATE cheque_events SET journal_entry_id = $2 WHERE id = $1',
          [eventId, journalEntryId],
        );
      }

      await client.query(
        `
          UPDATE cheques
          SET
            status = $2,
            bank_account_id = COALESCE($3, bank_account_id),
            current_holder = CASE
              WHEN $4 = 'bounce' THEN NULL
              WHEN $5::text IS NOT NULL THEN $5
              ELSE current_holder
            END,
            row_version = row_version + 1
          WHERE id = $1
        `,
        [
          chequeId,
          nextStatus,
          input.bankAccountId,
          input.eventType,
          bankAccount?.bank_name ?? null,
        ],
      );
      await writeAudit(client, request, {
        action: `treasury.cheque_${input.eventType}`,
        entityType: 'cheque',
        entityId: chequeId,
        before: {status: cheque.status},
        after: {
          status: nextStatus,
          eventId,
          journalEntryId,
          bankAccountId: input.bankAccountId,
          notes: input.notes,
        },
      });
      return {id: eventId, status: nextStatus, journalEntryId};
    });
    response.status(201).json({data: created});
  }),
);

treasuryRouter.post(
  '/cheques/:id/events/:eventId/reverse',
  requirePermissions(PERMISSIONS.TREASURY_MANAGE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const chequeId = identifierSchema.parse(request.params.id);
    const eventId = identifierSchema.parse(request.params.eventId);
    const input = chequeEventReversalSchema.parse(request.body);
    const reversed = await withTransaction(async (client) => {
      const chequeResult = await client.query<{status: ChequeStatus}>(
        `
          SELECT status
          FROM cheques
          WHERE id = $1 AND company_id = $2
          FOR UPDATE
        `,
        [chequeId, actor.companyId],
      );
      const cheque = chequeResult.rows[0];
      if (!cheque) {
        throw new AppError(
          404,
          'CHEQUE_NOT_FOUND',
          '\u0686\u06a9 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.',
        );
      }

      const eventResult = await client.query<{
        from_status: ChequeStatus;
        to_status: ChequeStatus;
        journal_entry_id: string | null;
        previous_bank_account_id: string | null;
        previous_holder: string | null;
      }>(
        `
          SELECT
            event.from_status,
            event.to_status,
            event.journal_entry_id,
            event.previous_bank_account_id,
            event.previous_holder
          FROM cheque_events event
          WHERE event.id = $1
            AND event.cheque_id = $2
            AND event.company_id = $3
            AND event.reversed_at IS NULL
            AND event.id = (
              SELECT latest.id
              FROM cheque_events latest
              WHERE latest.cheque_id = $2
                AND latest.company_id = $3
                AND latest.reversed_at IS NULL
              ORDER BY latest.created_at DESC, latest.id DESC
              LIMIT 1
            )
          FOR UPDATE
        `,
        [eventId, chequeId, actor.companyId],
      );
      const chequeEvent = eventResult.rows[0];
      if (!chequeEvent) {
        throw new AppError(
          409,
          'CHEQUE_EVENT_NOT_LATEST',
          '\u0641\u0642\u0637 \u0622\u062e\u0631\u06cc\u0646 \u0639\u0645\u0644\u06cc\u0627\u062a \u0641\u0639\u0627\u0644 \u0686\u06a9 \u0642\u0627\u0628\u0644 \u0628\u0631\u06af\u0634\u062a \u0627\u0633\u062a.',
        );
      }
      if (cheque.status !== chequeEvent.to_status) {
        throw new AppError(
          409,
          'CHEQUE_STATUS_CHANGED',
          '\u0648\u0636\u0639\u06cc\u062a \u0686\u06a9 \u062a\u063a\u06cc\u06cc\u0631 \u06a9\u0631\u062f\u0647 \u0627\u0633\u062a\u061b \u0627\u0637\u0644\u0627\u0639\u0627\u062a \u0635\u0641\u062d\u0647 \u0631\u0627 \u0646\u0648\u0633\u0627\u0632\u06cc \u06a9\u0646\u06cc\u062f.',
        );
      }

      let reversalJournalEntryId: string | null = null;
      if (chequeEvent.journal_entry_id) {
        const journal = await reverseJournalEntry(
          client,
          actor.companyId,
          chequeEvent.journal_entry_id,
          actor.id,
          input.reversalDate,
          input.reason,
        );
        reversalJournalEntryId = journal.id;
      }

      await client.query(
        `
          UPDATE cheque_events
          SET
            reversed_at = now(),
            reversal_date = $2,
            reversed_by = $3,
            reversal_reason = $4,
            reversal_journal_entry_id = $5
          WHERE id = $1
        `,
        [
          eventId,
          input.reversalDate,
          actor.id,
          input.reason,
          reversalJournalEntryId,
        ],
      );
      await client.query(
        `
          UPDATE cheques
          SET
            status = $2,
            bank_account_id = $3,
            current_holder = $4,
            row_version = row_version + 1
          WHERE id = $1
        `,
        [
          chequeId,
          chequeEvent.from_status,
          chequeEvent.previous_bank_account_id,
          chequeEvent.previous_holder,
        ],
      );
      await writeAudit(client, request, {
        action: 'treasury.cheque_event_reverse',
        entityType: 'cheque_event',
        entityId: eventId,
        before: {status: chequeEvent.to_status},
        after: {
          status: chequeEvent.from_status,
          reason: input.reason,
          reversalJournalEntryId,
        },
      });
      return {
        id: eventId,
        status: chequeEvent.from_status,
        reversalJournalEntryId,
      };
    });
    response.json({data: reversed});
  }),
);
