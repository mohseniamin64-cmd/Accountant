import {Router} from 'express';
import {z} from 'zod';
import {PERMISSIONS} from '../../../shared/permissions.js';
import {currentUser} from '../../common/auth-context.js';
import {AppError, asyncRoute} from '../../common/errors.js';
import {
  identifierSchema,
  isoDateSchema,
  nonNegativeIrrSchema,
  positiveQuantitySchema,
} from '../../common/values.js';
import {query, withTransaction} from '../../db/pool.js';
import {writeAudit} from '../../infrastructure/audit.js';
import {
  requireAuthentication,
  requirePermissions,
} from '../auth/middleware.js';
import {
  createPurchaseDraft,
  createSaleDraft,
  postPurchaseInvoice,
  postSaleInvoice,
} from './invoice.service.js';
import {
  returnPurchaseInvoice,
  returnSaleInvoice,
} from './return.service.js';

const invoiceLineSchema = z.object({
  productId: identifierSchema,
  warehouseId: identifierSchema,
  quantity: positiveQuantitySchema,
  unitPriceIrr: nonNegativeIrrSchema,
  discountIrr: nonNegativeIrrSchema.default('0'),
  taxIrr: nonNegativeIrrSchema.default('0'),
  description: z.string().trim().max(1000).nullable().default(null),
  serialNumbers: z.array(z.string().trim().min(1).max(160)).default([]),
});

const invoiceReturnLineSchema = z.object({
  originalLineId: identifierSchema,
  quantity: positiveQuantitySchema,
  serialNumbers: z
    .array(z.string().trim().min(1).max(160))
    .max(1000)
    .default([]),
});

const listSchema = z.object({
  status: z.enum(['draft', 'posted', 'reversed', 'all']).default('all'),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const availableSerialsSchema = z.object({
  productId: identifierSchema,
  warehouseId: identifierSchema,
  q: z.string().trim().max(160).default(''),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export const purchasesRouter = Router();
purchasesRouter.use(
  requireAuthentication,
  requirePermissions(PERMISSIONS.PURCHASE_VIEW),
);

purchasesRouter.get(
  '/',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = listSchema.parse(request.query);
    const result = await query(
      `
        SELECT
          invoice.id,
          invoice.invoice_number::text AS "invoiceNumber",
          invoice.supplier_invoice_number AS "supplierInvoiceNumber",
          invoice.invoice_date::text AS "invoiceDate",
          invoice.invoice_type AS "invoiceType",
          invoice.status,
          invoice.total_irr::text AS "totalIrr",
          invoice.returned_irr::text AS "returnedIrr",
          invoice.paid_irr::text AS "paidIrr",
          invoice.payment_status AS "paymentStatus",
          invoice.row_version AS "rowVersion",
          party.id AS "supplierId",
          party.display_name AS "supplierName"
        FROM purchase_invoices invoice
        JOIN parties party ON party.id = invoice.supplier_id
        WHERE invoice.company_id = $1
          AND ($2 = 'all' OR invoice.status = $2)
          AND ($3::date IS NULL OR invoice.invoice_date >= $3)
          AND ($4::date IS NULL OR invoice.invoice_date <= $4)
        ORDER BY invoice.invoice_date DESC, invoice.invoice_number DESC
        LIMIT $5 OFFSET $6
      `,
      [
        actor.companyId,
        input.status,
        input.from ?? null,
        input.to ?? null,
        input.limit,
        input.offset,
      ],
    );
    response.json({data: result.rows});
  }),
);

purchasesRouter.post(
  '/',
  requirePermissions(PERMISSIONS.PURCHASE_CREATE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        branchId: identifierSchema,
        supplierId: identifierSchema,
        invoiceDate: isoDateSchema,
        supplierInvoiceNumber: z
          .string()
          .trim()
          .max(120)
          .nullable()
          .default(null),
        otherCostsIrr: nonNegativeIrrSchema.default('0'),
        description: z.string().trim().max(2000).nullable().default(null),
        lines: z.array(invoiceLineSchema).min(1).max(200),
      })
      .parse(request.body);

    const created = await withTransaction(async (client) => {
      const invoice = await createPurchaseDraft(client, {
        companyId: actor.companyId,
        branchId: input.branchId,
        supplierId: input.supplierId,
        invoiceDate: input.invoiceDate,
        supplierInvoiceNumber: input.supplierInvoiceNumber,
        otherCostsIrr: input.otherCostsIrr,
        description: input.description,
        createdBy: actor.id,
        lines: input.lines,
      });
      await writeAudit(client, request, {
        action: 'purchase.create',
        entityType: 'purchase_invoice',
        entityId: invoice.id,
        after: invoice,
      });
      return invoice;
    });
    response.status(201).json({data: created});
  }),
);

purchasesRouter.post(
  '/:id/post',
  requirePermissions(PERMISSIONS.PURCHASE_POST),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const invoiceId = identifierSchema.parse(request.params.id);
    const posted = await withTransaction(async (client) => {
      const result = await postPurchaseInvoice(
        client,
        actor.companyId,
        invoiceId,
        actor.id,
      );
      await writeAudit(client, request, {
        action: 'purchase.post',
        entityType: 'purchase_invoice',
        entityId: invoiceId,
        after: result,
      });
      return result;
    });
    response.json({data: posted});
  }),
);

purchasesRouter.post(
  '/:id/cancel-draft',
  requirePermissions(PERMISSIONS.PURCHASE_VOID),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const invoiceId = identifierSchema.parse(request.params.id);
    const input = z
      .object({reason: z.string().trim().min(5).max(1000)})
      .parse(request.body);
    const result = await query(
      `
        UPDATE purchase_invoices
        SET
          status = 'reversed',
          description = concat_ws(E'\\n', description, $3),
          row_version = row_version + 1
        WHERE id = $1 AND company_id = $2 AND status = 'draft'
        RETURNING id
      `,
      [
        invoiceId,
        actor.companyId,
        `\u0644\u063a\u0648 \u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633: ${input.reason}`,
      ],
    );
    if (!result.rowCount) {
      throw new AppError(
        409,
        'PURCHASE_NOT_CANCELLABLE',
        '\u0641\u0642\u0637 \u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633 \u062e\u0631\u06cc\u062f \u0642\u0627\u0628\u0644 \u0644\u063a\u0648 \u0645\u0633\u062a\u0642\u06cc\u0645 \u0627\u0633\u062a.',
      );
    }
    response.status(204).end();
  }),
);

purchasesRouter.post(
  '/:id/return',
  requirePermissions(PERMISSIONS.PURCHASE_VOID),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const invoiceId = identifierSchema.parse(request.params.id);
    const input = z
      .object({
        returnDate: isoDateSchema,
        reason: z.string().trim().min(5).max(1000),
        rowVersion: z.number().int().positive(),
        lines: z.array(invoiceReturnLineSchema).min(1).max(200).optional(),
      })
      .parse(request.body);
    const returned = await withTransaction(async (client) => {
      const result = await returnPurchaseInvoice(
        client,
        actor.companyId,
        invoiceId,
        actor.id,
        input.returnDate,
        input.reason,
        input.rowVersion,
        input.lines ?? [],
      );
      await writeAudit(client, request, {
        action: 'purchase.return',
        entityType: 'purchase_invoice',
        entityId: invoiceId,
        after: result,
      });
      return result;
    });
    response.status(201).json({data: returned});
  }),
);

export const salesRouter = Router();
salesRouter.use(
  requireAuthentication,
  requirePermissions(PERMISSIONS.SALES_VIEW),
);

salesRouter.get(
  '/options',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const [customers, products, branches, warehouses, balances] =
      await Promise.all([
        query(
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
            ORDER BY display_name
          `,
          [actor.companyId],
        ),
        query(
          `
            SELECT
              product.id,
              product.code,
              product.name,
              product.product_type AS "productType",
              product.tracking_type AS "trackingType",
              unit.name AS "unitName",
              product.default_sale_price_irr::text AS "defaultSalePriceIrr",
              product.tax_rate::text AS "taxRate"
            FROM products product
            JOIN units unit ON unit.id = product.base_unit_id
            WHERE product.company_id = $1
              AND product.is_sellable = true
              AND product.is_active = true
              AND unit.is_active = true
            ORDER BY product.name
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
            SELECT
              warehouse.id,
              warehouse.branch_id AS "branchId",
              branch.name AS "branchName",
              warehouse.code,
              warehouse.name
            FROM warehouses warehouse
            JOIN branches branch ON branch.id = warehouse.branch_id
            WHERE warehouse.company_id = $1
              AND warehouse.is_active = true
              AND branch.is_active = true
            ORDER BY branch.name, warehouse.name
          `,
          [actor.companyId],
        ),
        query(
          `
            SELECT
              balance.product_id AS "productId",
              balance.warehouse_id AS "warehouseId",
              balance.quantity::text,
              balance.reserved_quantity::text AS "reservedQuantity",
              (balance.quantity - balance.reserved_quantity)::text
                AS "availableQuantity"
            FROM inventory_balances balance
            JOIN products product ON product.id = balance.product_id
            JOIN warehouses warehouse ON warehouse.id = balance.warehouse_id
            JOIN branches branch ON branch.id = warehouse.branch_id
            WHERE balance.company_id = $1
              AND product.is_active = true
              AND product.is_sellable = true
              AND warehouse.is_active = true
              AND branch.is_active = true
          `,
          [actor.companyId],
        ),
      ]);
    response.json({
      data: {
        customers: customers.rows,
        products: products.rows,
        branches: branches.rows,
        warehouses: warehouses.rows,
        balances: balances.rows,
      },
    });
  }),
);

salesRouter.get(
  '/available-serials',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = availableSerialsSchema.parse(request.query);
    const result = await query(
      `
        SELECT
          serial.id,
          serial.serial_number AS "serialNumber",
          serial.acquired_on::text AS "acquiredOn"
        FROM serial_numbers serial
        JOIN products product ON product.id = serial.product_id
        JOIN warehouses warehouse ON warehouse.id = serial.warehouse_id
        JOIN branches branch ON branch.id = warehouse.branch_id
        WHERE serial.company_id = $1
          AND serial.product_id = $2
          AND serial.warehouse_id = $3
          AND serial.status = 'in_stock'
          AND product.is_active = true
          AND product.is_sellable = true
          AND product.tracking_type = 'serial'
          AND warehouse.is_active = true
          AND branch.is_active = true
          AND ($4 = '' OR serial.serial_number ILIKE '%' || $4 || '%')
        ORDER BY
          CASE WHEN lower(serial.serial_number) = lower($4) THEN 0 ELSE 1 END,
          serial.serial_number
        LIMIT $5
      `,
      [actor.companyId, input.productId, input.warehouseId, input.q, input.limit],
    );
    response.json({data: result.rows});
  }),
);
salesRouter.get(
  '/',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = listSchema.parse(request.query);
    const result = await query(
      `
        SELECT
          invoice.id,
          invoice.invoice_number::text AS "invoiceNumber",
          invoice.invoice_date::text AS "invoiceDate",
          invoice.invoice_type AS "invoiceType",
          invoice.status,
          invoice.total_irr::text AS "totalIrr",
          invoice.returned_irr::text AS "returnedIrr",
          invoice.received_irr::text AS "receivedIrr",
          invoice.payment_status AS "paymentStatus",
          invoice.official_invoice AS "officialInvoice",
          invoice.taxpayer_status AS "taxpayerStatus",
          invoice.row_version AS "rowVersion",
          party.id AS "customerId",
          party.display_name AS "customerName"
        FROM sale_invoices invoice
        JOIN parties party ON party.id = invoice.customer_id
        WHERE invoice.company_id = $1
          AND ($2 = 'all' OR invoice.status = $2)
          AND ($3::date IS NULL OR invoice.invoice_date >= $3)
          AND ($4::date IS NULL OR invoice.invoice_date <= $4)
        ORDER BY invoice.invoice_date DESC, invoice.invoice_number DESC
        LIMIT $5 OFFSET $6
      `,
      [
        actor.companyId,
        input.status,
        input.from ?? null,
        input.to ?? null,
        input.limit,
        input.offset,
      ],
    );
    response.json({data: result.rows});
  }),
);

salesRouter.post(
  '/',
  requirePermissions(PERMISSIONS.SALES_CREATE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        branchId: identifierSchema,
        customerId: identifierSchema,
        invoiceDate: isoDateSchema,
        officialInvoice: z.boolean().default(false),
        description: z.string().trim().max(2000).nullable().default(null),
        lines: z.array(invoiceLineSchema).min(1).max(200),
      })
      .parse(request.body);

    const created = await withTransaction(async (client) => {
      const invoice = await createSaleDraft(client, {
        companyId: actor.companyId,
        branchId: input.branchId,
        customerId: input.customerId,
        invoiceDate: input.invoiceDate,
        officialInvoice: input.officialInvoice,
        description: input.description,
        createdBy: actor.id,
        lines: input.lines,
      });
      await writeAudit(client, request, {
        action: 'sale.create',
        entityType: 'sale_invoice',
        entityId: invoice.id,
        after: invoice,
      });
      return invoice;
    });
    response.status(201).json({data: created});
  }),
);

salesRouter.post(
  '/:id/post',
  requirePermissions(PERMISSIONS.SALES_POST),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const invoiceId = identifierSchema.parse(request.params.id);
    const posted = await withTransaction(async (client) => {
      const result = await postSaleInvoice(
        client,
        actor.companyId,
        invoiceId,
        actor.id,
      );
      await writeAudit(client, request, {
        action: 'sale.post',
        entityType: 'sale_invoice',
        entityId: invoiceId,
        after: result,
      });
      return result;
    });
    response.json({data: posted});
  }),
);

salesRouter.post(
  '/:id/cancel-draft',
  requirePermissions(PERMISSIONS.SALES_VOID),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const invoiceId = identifierSchema.parse(request.params.id);
    const input = z
      .object({reason: z.string().trim().min(5).max(1000)})
      .parse(request.body);
    await withTransaction(async (client) => {
      const current = await client.query(
        `
          SELECT 1
          FROM sale_invoices
          WHERE id = $1 AND company_id = $2 AND status = 'draft'
          FOR UPDATE
        `,
        [invoiceId, actor.companyId],
      );
      if (!current.rowCount) {
        throw new AppError(
          409,
          'SALE_NOT_CANCELLABLE',
          '\u0641\u0642\u0637 \u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633 \u0641\u0631\u0648\u0634 \u0642\u0627\u0628\u0644 \u0644\u063a\u0648 \u0645\u0633\u062a\u0642\u06cc\u0645 \u0627\u0633\u062a.',
        );
      }
      await client.query(
        `
          UPDATE serial_numbers serial
          SET
            status = 'in_stock',
            row_version = row_version + 1
          FROM sale_invoice_serials link
          JOIN sale_invoice_lines line ON line.id = link.invoice_line_id
          WHERE line.invoice_id = $1
            AND serial.id = link.serial_id
            AND serial.status = 'reserved'
        `,
        [invoiceId],
      );
      await client.query(
        `
          UPDATE sale_invoices
          SET
            status = 'reversed',
            description = concat_ws(E'\\n', description, $2),
            row_version = row_version + 1
          WHERE id = $1
        `,
        [invoiceId, `\u0644\u063a\u0648 \u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633: ${input.reason}`],
      );
    });
    response.status(204).end();
  }),
);

salesRouter.post(
  '/:id/return',
  requirePermissions(PERMISSIONS.SALES_VOID),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const invoiceId = identifierSchema.parse(request.params.id);
    const input = z
      .object({
        returnDate: isoDateSchema,
        reason: z.string().trim().min(5).max(1000),
        rowVersion: z.number().int().positive(),
        lines: z.array(invoiceReturnLineSchema).min(1).max(200).optional(),
      })
      .parse(request.body);
    const returned = await withTransaction(async (client) => {
      const result = await returnSaleInvoice(
        client,
        actor.companyId,
        invoiceId,
        actor.id,
        input.returnDate,
        input.reason,
        input.rowVersion,
        input.lines ?? [],
      );
      await writeAudit(client, request, {
        action: 'sale.return',
        entityType: 'sale_invoice',
        entityId: invoiceId,
        after: result,
      });
      return result;
    });
    response.status(201).json({data: returned});
  }),
);

purchasesRouter.get(
  '/options',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const [suppliers, products, branches, warehouses] = await Promise.all([
      query(
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
          ORDER BY display_name
        `,
        [actor.companyId],
      ),
      query(
        `
          SELECT
            product.id,
            product.code,
            product.name,
            product.product_type AS "productType",
            product.tracking_type AS "trackingType",
            unit.name AS "unitName",
            product.default_purchase_price_irr::text AS "defaultPurchasePriceIrr",
            product.tax_rate::text AS "taxRate"
          FROM products product
          JOIN units unit ON unit.id = product.base_unit_id
          WHERE product.company_id = $1
            AND product.is_purchasable = true
            AND product.is_active = true
            AND unit.is_active = true
          ORDER BY product.name
        `,
        [actor.companyId],
      ),
      query(
        `
          SELECT
            id,
            code,
            name,
            is_head_office AS "isHeadOffice"
          FROM branches
          WHERE company_id = $1
            AND is_active = true
          ORDER BY is_head_office DESC, name
        `,
        [actor.companyId],
      ),
      query(
        `
          SELECT
            warehouse.id,
            warehouse.branch_id AS "branchId",
            branch.name AS "branchName",
            warehouse.code,
            warehouse.name
          FROM warehouses warehouse
          JOIN branches branch ON branch.id = warehouse.branch_id
          WHERE warehouse.company_id = $1
            AND warehouse.is_active = true
            AND branch.is_active = true
          ORDER BY branch.name, warehouse.name
        `,
        [actor.companyId],
      ),
    ]);
    response.json({
      data: {
        suppliers: suppliers.rows,
        products: products.rows,
        branches: branches.rows,
        warehouses: warehouses.rows,
      },
    });
  }),
);

async function invoiceDetail(
  companyId: string,
  invoiceId: string,
  kind: 'purchase' | 'sale',
): Promise<unknown> {
  const headerTable =
    kind === 'purchase' ? 'purchase_invoices' : 'sale_invoices';
  const lineTable =
    kind === 'purchase' ? 'purchase_invoice_lines' : 'sale_invoice_lines';
  const serialLinkTable =
    kind === 'purchase' ? 'purchase_invoice_serials' : 'sale_invoice_serials';
  const serialNumbersExpression =
    kind === 'purchase'
      ? `
          (
            SELECT coalesce(
              jsonb_agg(serial_link.serial_number ORDER BY serial_link.serial_number),
              '[]'::jsonb
            )
            FROM purchase_invoice_serials serial_link
            WHERE serial_link.invoice_line_id = line.id
          )
        `
      : `
          (
            SELECT coalesce(
              jsonb_agg(serial.serial_number ORDER BY serial.serial_number),
              '[]'::jsonb
            )
            FROM sale_invoice_serials serial_link
            JOIN serial_numbers serial ON serial.id = serial_link.serial_id
            WHERE serial_link.invoice_line_id = line.id
          )
        `;
  const returnedQuantityExpression = `
    (
      SELECT coalesce(sum(return_line.quantity), 0)
      FROM ${lineTable} return_line
      JOIN ${headerTable} return_invoice
        ON return_invoice.id = return_line.invoice_id
      WHERE return_line.original_line_id = line.id
        AND return_invoice.return_of_id = $1
        AND return_invoice.invoice_type = 'return'
        AND return_invoice.status = 'posted'
    )
  `;
  const returnableSerialsExpression =
    kind === 'purchase'
      ? `
          (
            SELECT coalesce(
              jsonb_agg(serial.serial_number ORDER BY serial.serial_number),
              '[]'::jsonb
            )
            FROM purchase_invoice_serials original_link
            JOIN serial_numbers serial ON serial.id = original_link.serial_id
            WHERE original_link.invoice_line_id = line.id
              AND serial.status = 'in_stock'
              AND serial.product_id = line.product_id
              AND serial.warehouse_id = line.warehouse_id
              AND NOT EXISTS (
                SELECT 1
                FROM purchase_invoice_serials prior_link
                JOIN purchase_invoice_lines prior_line
                  ON prior_line.id = prior_link.invoice_line_id
                JOIN purchase_invoices prior_invoice
                  ON prior_invoice.id = prior_line.invoice_id
                WHERE prior_line.original_line_id = line.id
                  AND prior_invoice.return_of_id = $1
                  AND prior_invoice.invoice_type = 'return'
                  AND prior_invoice.status = 'posted'
                  AND prior_link.serial_id = serial.id
              )
          )
        `
      : `
          (
            SELECT coalesce(
              jsonb_agg(serial.serial_number ORDER BY serial.serial_number),
              '[]'::jsonb
            )
            FROM sale_invoice_serials original_link
            JOIN serial_numbers serial ON serial.id = original_link.serial_id
            WHERE original_link.invoice_line_id = line.id
              AND serial.status = 'sold'
              AND serial.product_id = line.product_id
              AND NOT EXISTS (
                SELECT 1
                FROM sale_invoice_serials prior_link
                JOIN sale_invoice_lines prior_line
                  ON prior_line.id = prior_link.invoice_line_id
                JOIN sale_invoices prior_invoice
                  ON prior_invoice.id = prior_line.invoice_id
                WHERE prior_line.original_line_id = line.id
                  AND prior_invoice.return_of_id = $1
                  AND prior_invoice.invoice_type = 'return'
                  AND prior_invoice.status = 'posted'
                  AND prior_link.serial_id = serial.id
              )
          )
        `;
  const header = await query(
    `
      SELECT *
      FROM ${headerTable}
      WHERE id = $1 AND company_id = $2
    `,
    [invoiceId, companyId],
  );
  if (!header.rows[0]) {
    throw new AppError(404, 'INVOICE_NOT_FOUND', 'فاکتور پیدا نشد.');
  }
  const lines = await query(
    `
      SELECT
        line.id,
        line.line_number AS "lineNumber",
        line.product_id AS "productId",
        line.warehouse_id AS "warehouseId",
        line.quantity::text,
        (${returnedQuantityExpression})::text AS "returnedQuantity",
        greatest(
          line.quantity - (${returnedQuantityExpression}),
          0
        )::text AS "remainingQuantity",
        line.unit_price_irr::text AS "unitPriceIrr",
        line.discount_irr::text AS "discountIrr",
        line.tax_irr::text AS "taxIrr",
        line.line_total_irr::text AS "lineTotalIrr",
        line.description,
        product.code AS "productCode",
        product.name AS "productName",
        product.tracking_type AS "trackingType",
        warehouse.name AS "warehouseName",
        ${serialNumbersExpression} AS "serialNumbers",
        ${returnableSerialsExpression} AS "returnableSerialNumbers",
        (
          SELECT count(*)::int
          FROM ${serialLinkTable} serial_link
          WHERE serial_link.invoice_line_id = line.id
        ) AS "serialCount"
      FROM ${lineTable} line
      JOIN products product ON product.id = line.product_id
      JOIN warehouses warehouse ON warehouse.id = line.warehouse_id
      WHERE line.invoice_id = $1
      ORDER BY line.line_number
    `,
    [invoiceId],
  );
  return {...header.rows[0], lines: lines.rows};
}

purchasesRouter.get(
  '/:id',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    response.json({data: await invoiceDetail(actor.companyId, id, 'purchase')});
  }),
);

salesRouter.get(
  '/:id',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    response.json({data: await invoiceDetail(actor.companyId, id, 'sale')});
  }),
);
