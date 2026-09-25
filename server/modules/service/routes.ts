import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {mkdir, unlink, writeFile} from 'node:fs/promises';
import path from 'node:path';
import Decimal from 'decimal.js';
import {Router} from 'express';
import multer from 'multer';
import type {PoolClient} from 'pg';
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
import {config} from '../../config.js';
import {query, withTransaction} from '../../db/pool.js';
import {writeAudit} from '../../infrastructure/audit.js';
import {nextSequence} from '../../infrastructure/sequences.js';
import {
  createJournalEntry,
  systemAccountIds,
  type JournalLineInput,
} from '../accounting/journal.service.js';
import {
  requireAuthentication,
  requirePermissions,
} from '../auth/middleware.js';
import {queueSmsIfEnabled} from '../sms/service.js';
import {applyInventoryMovement} from '../inventory/inventory.service.js';

type ServiceStatus =
  | 'received'
  | 'diagnosis'
  | 'waiting_customer'
  | 'waiting_part'
  | 'repairing'
  | 'final_test'
  | 'ready_delivery'
  | 'delivered'
  | 'cancelled';

type ServicePriority = 'low' | 'normal' | 'high' | 'urgent';

const servicePrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
const inspectionTypeSchema = z.enum(['diagnosis', 'final_test']);
const inspectionResultSchema = z.enum(['passed', 'failed', 'conditional']);
const inspectionChecklistSchema = z
  .record(
    z.string().trim().min(1).max(100),
    z.enum(['passed', 'failed', 'not_checked', 'not_applicable']),
  )
  .refine((value) => Object.keys(value).length <= 60, {
    message: 'حداکثر ۶۰ مورد در چک‌لیست بررسی قابل ثبت است.',
  });

const serviceOutputSettingsSchema = z.object({
  intakePrintEnabled: z.boolean(),
  paperSize: z.enum(['A4', '80mm']),
  printReceipt: z.boolean(),
  printDeviceLabel: z.boolean(),
});

type ServiceOutputSettings = z.infer<typeof serviceOutputSettingsSchema>;

const defaultServiceOutputSettings: ServiceOutputSettings = {
  intakePrintEnabled: false,
  paperSize: 'A4',
  printReceipt: true,
  printDeviceLabel: true,
};

function parseServiceOutputSettings(value: unknown): ServiceOutputSettings {
  const parsed = serviceOutputSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultServiceOutputSettings;
}

async function getServiceOutputSettings(
  client: Pick<PoolClient, 'query'>,
  companyId: string,
): Promise<ServiceOutputSettings> {
  const result = await client.query<{setting_value: unknown}>(
    `
      SELECT setting_value
      FROM app_settings
      WHERE company_id = $1
        AND scope_type = 'company'
        AND scope_id = $1
        AND setting_key = 'service.output'
    `,
    [companyId],
  );
  return parseServiceOutputSettings(result.rows[0]?.setting_value);
}

const activeStatuses: readonly ServiceStatus[] = [
  'received',
  'diagnosis',
  'waiting_customer',
  'waiting_part',
  'repairing',
  'final_test',
  'ready_delivery',
];

const allowedTransitions: Readonly<Record<ServiceStatus, readonly ServiceStatus[]>> = {
  received: ['diagnosis', 'cancelled'],
  diagnosis: ['waiting_customer', 'waiting_part', 'repairing', 'cancelled'],
  waiting_customer: ['diagnosis', 'repairing', 'cancelled'],
  waiting_part: ['repairing', 'cancelled'],
  repairing: ['waiting_part', 'final_test'],
  final_test: ['repairing'],
  ready_delivery: [],
  delivered: [],
  cancelled: [],
};

const serviceStatusSchema = z.enum([
  'received',
  'diagnosis',
  'waiting_customer',
  'waiting_part',
  'repairing',
  'final_test',
  'ready_delivery',
  'delivered',
  'cancelled',
]);

const serviceReportRangeSchema = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    branchId: identifierSchema.optional(),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    {
      path: ['to'],
      message: 'تاریخ پایان گزارش باید بعد از تاریخ شروع باشد.',
    },
  );

const optionalText = z.string().trim().max(2000).nullable().default(null);

const serviceAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 5 * 1024 * 1024, files: 1},
  fileFilter: (_request, file, callback) => {
    const allowed = new Set([
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/pdf',
    ]);
    if (allowed.has(file.mimetype)) callback(null, true);
    else callback(new Error('UNSUPPORTED_SERVICE_ATTACHMENT'));
  },
});

const serviceAttachmentTypeSchema = z.enum([
  'intake',
  'diagnosis',
  'warranty_evidence',
  'repair',
  'delivery',
]);

function trackingCode(): string {
  return `SRV-${randomBytes(8).toString('hex').toUpperCase()}`;
}

function hashTrackingCode(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

async function insertEvent(
  client: PoolClient,
  input: {
    serviceOrderId: string;
    eventType: string;
    fromStatus?: ServiceStatus | null;
    toStatus?: ServiceStatus | null;
    description: string;
    metadata?: Readonly<Record<string, unknown>>;
    createdBy: string;
  },
): Promise<void> {
  await client.query(
    `
      INSERT INTO service_events (
        service_order_id,
        event_type,
        from_status,
        to_status,
        description,
        metadata,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      input.serviceOrderId,
      input.eventType,
      input.fromStatus ?? null,
      input.toStatus ?? null,
      input.description,
      JSON.stringify(input.metadata ?? {}),
      input.createdBy,
    ],
  );
}

const publicOrderSelect = `
  SELECT
    service.id,
    service.tracking_code AS "trackingCode",
    service.received_at AS "receivedAt",
    service.status,
    service.warranty_decision AS "warrantyDecision",
    service.estimated_cost_irr::text AS "estimatedCostIrr",
    service.estimate_status AS "estimateStatus",
    service.final_cost_irr::text AS "finalCostIrr",
    service.paid_irr::text AS "paidIrr",
    service.delivered_at AS "deliveredAt",
    product.name AS "productName",
    serial.serial_number AS "serialNumber"
  FROM service_orders service
  JOIN serial_numbers serial ON serial.id = service.serial_id
  JOIN products product ON product.id = serial.product_id
`;

export const servicePublicRouter = Router();

servicePublicRouter.get(
  '/track/:trackingCode',
  asyncRoute(async (request, response) => {
    const code = z.string().trim().min(12).max(40).parse(request.params.trackingCode);
    const result = await query(
      `
        ${publicOrderSelect}
        WHERE service.tracking_code = $1
          AND service.tracking_token_hash = $2
      `,
      [code.toUpperCase(), hashTrackingCode(code.toUpperCase())],
    );
    const order = result.rows[0];
    if (!order) {
      throw new AppError(
        404,
        'SERVICE_TRACKING_NOT_FOUND',
        '\u067e\u0631\u0648\u0646\u062f\u0647\u200c\u0627\u06cc \u0628\u0627 \u0627\u06cc\u0646 \u06a9\u062f \u067e\u06cc\u06af\u06cc\u0631\u06cc \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.',
      );
    }
    const events = await query(
      `
        SELECT
          event_type AS "eventType",
          to_status AS "toStatus",
          created_at AS "createdAt"
        FROM service_events
        WHERE service_order_id = $1
        ORDER BY created_at, id
      `,
      [order.id],
    );
    response.json({data: {...order, events: events.rows}});
  }),
);

export const serviceRouter = Router();
serviceRouter.use(
  requireAuthentication,
  requirePermissions(PERMISSIONS.SERVICE_VIEW),
);

serviceRouter.get(
  '/options',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const [branches, warehouses, products, balances, technicians, outputSettingsResult] = await Promise.all([
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
            warehouse.name,
            warehouse.warehouse_type AS "warehouseType"
          FROM warehouses warehouse
          JOIN branches branch ON branch.id = warehouse.branch_id
          WHERE warehouse.company_id = $1
            AND warehouse.is_active = true
            AND branch.is_active = true
          ORDER BY
            CASE WHEN warehouse.warehouse_type = 'service' THEN 0 ELSE 1 END,
            branch.name,
            warehouse.name
        `,
        [actor.companyId],
      ),
      query(
        `
          SELECT
            product.id,
            product.code,
            product.name,
            product.tracking_type AS "trackingType",
            unit.name AS "unitName"
          FROM products product
          JOIN units unit ON unit.id = product.base_unit_id
          WHERE product.company_id = $1
            AND product.is_active = true
            AND product.product_type <> 'service'
          ORDER BY product.name
        `,
        [actor.companyId],
      ),
      query(
        `
          SELECT
            balance.warehouse_id AS "warehouseId",
            balance.product_id AS "productId",
            balance.quantity::text,
            balance.reserved_quantity::text AS "reservedQuantity",
            (balance.quantity - balance.reserved_quantity)::text AS "availableQuantity"
          FROM inventory_balances balance
          JOIN warehouses warehouse ON warehouse.id = balance.warehouse_id
          JOIN products product ON product.id = balance.product_id
          WHERE balance.company_id = $1
            AND warehouse.is_active = true
            AND product.is_active = true
        `,
        [actor.companyId],
      ),
      query(
        `
          SELECT DISTINCT
            app_user.id,
            app_user.full_name AS "fullName",
            app_user.username,
            COALESCE(active_work.active_count, 0)::text AS "activeCount"
          FROM users app_user
          JOIN user_roles user_role ON user_role.user_id = app_user.id
          JOIN roles role
            ON role.id = user_role.role_id
            AND role.company_id = app_user.company_id
            AND role.is_active = true
          JOIN role_permissions role_permission
            ON role_permission.role_id = role.id
            AND role_permission.permission_code = $2
          LEFT JOIN LATERAL (
            SELECT count(*) AS active_count
            FROM service_orders service
            WHERE service.company_id = app_user.company_id
              AND service.assigned_to = app_user.id
              AND service.status = ANY($3::text[])
          ) active_work ON true
          WHERE app_user.company_id = $1
            AND app_user.is_active = true
          ORDER BY app_user.full_name, app_user.username
        `,
        [actor.companyId, PERMISSIONS.SERVICE_REPAIR, activeStatuses],
      ),
      query<{setting_value: unknown}>(
        `
          SELECT setting_value
          FROM app_settings
          WHERE company_id = $1
            AND scope_type = 'company'
            AND scope_id = $1
            AND setting_key = 'service.output'
        `,
        [actor.companyId],
      ),
    ]);
    response.json({
      data: {
        branches: branches.rows,
        warehouses: warehouses.rows,
        products: products.rows,
        balances: balances.rows,
        technicians: technicians.rows,
        outputSettings: parseServiceOutputSettings(
          outputSettingsResult.rows[0]?.setting_value,
        ),
      },
    });
  }),
);

serviceRouter.get(
  '/dashboard',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const [statusResult, queueResult] = await Promise.all([
      query<{status: ServiceStatus; count: string}>(
        `
          SELECT status, count(*)::text AS count
          FROM service_orders
          WHERE company_id = $1
          GROUP BY status
        `,
        [actor.companyId],
      ),
      query<{
        activeCount: string;
        assignedToMe: string;
        unassigned: string;
        overdue: string;
        highPriority: string;
      }>(
        `
          SELECT
            count(*) FILTER (WHERE status = ANY($2::text[]))::text AS "activeCount",
            count(*) FILTER (
              WHERE status = ANY($2::text[]) AND assigned_to = $3
            )::text AS "assignedToMe",
            count(*) FILTER (
              WHERE status = ANY($2::text[]) AND assigned_to IS NULL
            )::text AS "unassigned",
            count(*) FILTER (
              WHERE status = ANY($2::text[]) AND due_at < now()
            )::text AS overdue,
            count(*) FILTER (
              WHERE status = ANY($2::text[]) AND priority IN ('high', 'urgent')
            )::text AS "highPriority"
          FROM service_orders
          WHERE company_id = $1
        `,
        [actor.companyId, activeStatuses, actor.id],
      ),
    ]);
    const statusCounts = Object.fromEntries(
      serviceStatusSchema.options.map((status) => [status, 0]),
    ) as Record<ServiceStatus, number>;
    for (const row of statusResult.rows) statusCounts[row.status] = Number(row.count);
    response.json({
      data: {
        statusCounts,
        ...(queueResult.rows[0] ?? {
          activeCount: '0',
          assignedToMe: '0',
          unassigned: '0',
          overdue: '0',
          highPriority: '0',
        }),
      },
    });
  }),
);

serviceRouter.get(
  '/report',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = serviceReportRangeSchema.parse(request.query);
    const filters = [
      actor.companyId,
      input.from ?? null,
      input.to ?? null,
      input.branchId ?? null,
    ];
    const [summaryResult, statusResult, partsResult, costsResult, technicianResult] = await Promise.all([
      query<{
        totalReceived: string;
        inWarranty: string;
        outOfWarranty: string;
        delivered: string;
        receivedServiceIncomeIrr: string;
        averageCompletionHours: string | null;
      }>(
        `
          SELECT
            count(*)::text AS "totalReceived",
            count(*) FILTER (WHERE warranty_decision = 'in_warranty')::text AS "inWarranty",
            count(*) FILTER (WHERE warranty_decision = 'out_of_warranty')::text AS "outOfWarranty",
            count(*) FILTER (WHERE status = 'delivered')::text AS "delivered",
            COALESCE(sum(paid_irr) FILTER (WHERE warranty_decision = 'out_of_warranty'), 0)::text AS "receivedServiceIncomeIrr",
            avg(extract(epoch FROM (delivered_at - received_at)) / 3600) FILTER (WHERE delivered_at IS NOT NULL)::text AS "averageCompletionHours"
          FROM service_orders service
          WHERE service.company_id = $1
            AND ($2::date IS NULL OR service.received_at::date >= $2::date)
            AND ($3::date IS NULL OR service.received_at::date <= $3::date)
            AND ($4::uuid IS NULL OR service.branch_id = $4)
        `,
        filters,
      ),
      query<{status: ServiceStatus; count: string}>(
        `
          SELECT status, count(*)::text AS count
          FROM service_orders service
          WHERE service.company_id = $1
            AND ($2::date IS NULL OR service.received_at::date >= $2::date)
            AND ($3::date IS NULL OR service.received_at::date <= $3::date)
            AND ($4::uuid IS NULL OR service.branch_id = $4)
          GROUP BY status
        `,
        filters,
      ),
      query<{
        installedQuantity: string;
        chargeablePartsValueIrr: string;
        partsCostIrr: string;
      }>(
        `
          SELECT
            COALESCE(sum(part.quantity) FILTER (WHERE part.is_reversed = false), 0)::text AS "installedQuantity",
            COALESCE(sum(part.quantity * part.unit_price_irr) FILTER (
              WHERE part.is_chargeable AND part.is_reversed = false
            ), 0)::text AS "chargeablePartsValueIrr",
            COALESCE(sum(part.quantity * part.unit_cost_irr) FILTER (
              WHERE part.is_reversed = false
            ), 0)::text AS "partsCostIrr"
          FROM service_parts part
          JOIN service_orders service ON service.id = part.service_order_id
          WHERE service.company_id = $1
            AND part.usage_type = 'installed'
            AND ($2::date IS NULL OR service.received_at::date >= $2::date)
            AND ($3::date IS NULL OR service.received_at::date <= $3::date)
            AND ($4::uuid IS NULL OR service.branch_id = $4)
        `,
        filters,
      ),
      query<{directServiceCostsIrr: string}>(
        `
          SELECT COALESCE(sum(cost.amount_irr), 0)::text AS "directServiceCostsIrr"
          FROM service_costs cost
          JOIN service_orders service ON service.id = cost.service_order_id
          WHERE cost.company_id = $1
            AND service.company_id = $1
            AND ($2::date IS NULL OR service.received_at::date >= $2::date)
            AND ($3::date IS NULL OR service.received_at::date <= $3::date)
            AND ($4::uuid IS NULL OR service.branch_id = $4)
        `,
        filters,
      ),
      query<{
        technicianId: string;
        technicianName: string;
        assignedCount: string;
        deliveredCount: string;
        averageCompletionHours: string | null;
      }>(
        `
          SELECT
            app_user.id AS "technicianId",
            app_user.full_name AS "technicianName",
            count(service.id)::text AS "assignedCount",
            count(service.id) FILTER (WHERE service.status = 'delivered')::text AS "deliveredCount",
            avg(extract(epoch FROM (service.delivered_at - service.received_at)) / 3600)
              FILTER (WHERE service.delivered_at IS NOT NULL)::text AS "averageCompletionHours"
          FROM service_orders service
          JOIN users app_user
            ON app_user.id = service.assigned_to
            AND app_user.company_id = service.company_id
          WHERE service.company_id = $1
            AND ($2::date IS NULL OR service.received_at::date >= $2::date)
            AND ($3::date IS NULL OR service.received_at::date <= $3::date)
            AND ($4::uuid IS NULL OR service.branch_id = $4)
          GROUP BY app_user.id, app_user.full_name
          ORDER BY count(service.id) FILTER (WHERE service.status = 'delivered') DESC,
            app_user.full_name
        `,
        filters,
      ),
    ]);
    const statusCounts = Object.fromEntries(
      serviceStatusSchema.options.map((status) => [status, 0]),
    ) as Record<ServiceStatus, number>;
    for (const row of statusResult.rows) statusCounts[row.status] = Number(row.count);
    const partsCostIrr = partsResult.rows[0]?.partsCostIrr ?? '0';
    const directServiceCostsIrr =
      costsResult.rows[0]?.directServiceCostsIrr ?? '0';
    const [frequentParts, recurrentFaults] = await Promise.all([
      query(`SELECT product.name AS "productName", sum(part.quantity)::text AS quantity
        FROM service_parts part JOIN products product ON product.id = part.product_id
        JOIN service_orders service ON service.id = part.service_order_id
        WHERE service.company_id = $1 AND part.usage_type = 'installed' AND part.is_reversed = false
          AND ($2::date IS NULL OR service.received_at::date >= $2::date)
          AND ($3::date IS NULL OR service.received_at::date <= $3::date)
          AND ($4::uuid IS NULL OR service.branch_id = $4)
        GROUP BY product.id, product.name ORDER BY sum(part.quantity) DESC, product.name LIMIT 10`, filters),
      query(`SELECT inspection.observed_fault AS fault, count(*)::text AS count
        FROM service_inspections inspection JOIN service_orders service ON service.id = inspection.service_order_id
        WHERE service.company_id = $1 AND inspection.inspection_type = 'diagnosis'
          AND ($2::date IS NULL OR service.received_at::date >= $2::date)
          AND ($3::date IS NULL OR service.received_at::date <= $3::date)
          AND ($4::uuid IS NULL OR service.branch_id = $4)
        GROUP BY inspection.observed_fault ORDER BY count(*) DESC, inspection.observed_fault LIMIT 10`, filters),
    ]);
    response.json({
      data: {
        from: input.from ?? null,
        to: input.to ?? null,
        branchId: input.branchId ?? null,
        ...summaryResult.rows[0],
        ...partsResult.rows[0],
        directServiceCostsIrr,
        actualServiceCostIrr: new Decimal(partsCostIrr)
          .plus(directServiceCostsIrr)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
          .toFixed(0),
        technicianPerformance: technicianResult.rows,
        frequentParts: frequentParts.rows,
        recurrentFaults: recurrentFaults.rows,
        statusCounts,
      },
    });
  }),
);

serviceRouter.get(
  '/serial-lookup/:serialNumber',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const serialNumber = z
      .string()
      .trim()
      .min(1)
      .max(160)
      .parse(request.params.serialNumber);
    const result = await query(
      `
        SELECT
          serial.id AS "serialId",
          serial.serial_number AS "serialNumber",
          serial.status AS "serialStatus",
          product.id AS "productId",
          product.code AS "productCode",
          product.name AS "productName",
          sale.id AS "saleInvoiceId",
          sale.invoice_number::text AS "saleInvoiceNumber",
          sale.invoice_date AS "saleDate",
          party.id AS "customerId",
          party.display_name AS "customerName",
          party.mobile AS "customerMobile",
          warranty.id AS "warrantyId",
          warranty.starts_on AS "warrantyStartsOn",
          warranty.ends_on AS "warrantyEndsOn",
          service_warranty.id AS "serviceWarrantyId",
          service_warranty.service_order_id AS "sourceServiceOrderId",
          service_warranty.starts_on AS "serviceWarrantyStartsOn",
          service_warranty.ends_on AS "serviceWarrantyEndsOn",
          CASE
            WHEN warranty.id IS NOT NULL THEN 'sale_warranty'
            WHEN service_warranty.id IS NOT NULL THEN 'service_warranty'
            ELSE 'none'
          END AS "coverageSource",
          COALESCE(warranty.starts_on, service_warranty.starts_on)
            AS "coverageStartsOn",
          COALESCE(warranty.ends_on, service_warranty.ends_on)
            AS "coverageEndsOn",
          CASE
            WHEN COALESCE(warranty.ends_on, service_warranty.ends_on) IS NULL THEN 0
            ELSE GREATEST(
              COALESCE(warranty.ends_on, service_warranty.ends_on) - current_date,
              0
            )
          END AS "warrantyRemainingDays",
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', history.id,
                  'orderNumber', history.order_number::text,
                  'status', history.status,
                  'receivedAt', history.received_at,
                  'deliveredAt', history.delivered_at
                )
                ORDER BY history.received_at DESC
              )
              FROM service_orders history
              WHERE history.serial_id = serial.id
            ),
            '[]'::jsonb
          ) AS "serviceHistory",
          CASE
            WHEN warranty.id IS NOT NULL OR service_warranty.id IS NOT NULL THEN true
            ELSE false
          END AS "isInWarranty"
        FROM serial_numbers serial
        JOIN products product ON product.id = serial.product_id
        JOIN service_serial_sales sold_serial ON sold_serial.serial_id = serial.id
        JOIN sale_invoice_lines sale_line ON sale_line.id = sold_serial.invoice_line_id
        JOIN sale_invoices sale
          ON sale.id = sale_line.invoice_id
          AND sale.status = 'posted'
        JOIN parties party ON party.id = sale.customer_id
        LEFT JOIN LATERAL (
          SELECT candidate.*
          FROM warranties candidate
          WHERE candidate.serial_id = serial.id
            AND candidate.sale_invoice_id = sale.id
            AND candidate.status = 'active'
            AND current_date BETWEEN candidate.starts_on AND candidate.ends_on
          ORDER BY candidate.ends_on DESC, candidate.created_at DESC
          LIMIT 1
        ) warranty ON true
        LEFT JOIN LATERAL (
          SELECT candidate.*
          FROM service_warranties candidate
          WHERE candidate.company_id = serial.company_id
            AND candidate.serial_id = serial.id
            AND candidate.status = 'active'
            AND current_date BETWEEN candidate.starts_on AND candidate.ends_on
          ORDER BY candidate.ends_on DESC, candidate.created_at DESC
          LIMIT 1
        ) service_warranty ON true
        WHERE serial.company_id = $1
          AND serial.serial_number = $2
        LIMIT 1
      `,
      [actor.companyId, serialNumber],
    );
    const found = result.rows[0];
    if (!found) {
      throw new AppError(
        404,
        'SOLD_SERIAL_NOT_FOUND',
        '\u0627\u06cc\u0646 \u0634\u0645\u0627\u0631\u0647 \u0633\u0631\u06cc\u0627\u0644 \u062f\u0631 \u0641\u0631\u0648\u0634\u200c\u0647\u0627\u06cc \u0642\u0637\u0639\u06cc \u0633\u0627\u0645\u0627\u0646\u0647 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.',
      );
    }
    response.json({data: found});
  }),
);

serviceRouter.get(
  '/available-part-serials',
  requirePermissions(PERMISSIONS.SERVICE_REPAIR),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        productId: identifierSchema,
        warehouseId: identifierSchema,
      })
      .parse(request.query);
    const result = await query(
      `
        SELECT id, serial_number AS "serialNumber"
        FROM serial_numbers
        WHERE company_id = $1
          AND product_id = $2
          AND warehouse_id = $3
          AND status = 'in_stock'
        ORDER BY serial_number
        LIMIT 200
      `,
      [actor.companyId, input.productId, input.warehouseId],
    );
    response.json({data: result.rows});
  }),
);

serviceRouter.get(
  '/orders',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        status: z.union([serviceStatusSchema, z.literal('archive')]).optional(),
        search: z.string().trim().max(160).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(request.query);
    const result = await query(
      `
        SELECT
          service.id,
          service.order_number::text AS "orderNumber",
          service.tracking_code AS "trackingCode",
          service.received_at AS "receivedAt",
          service.status,
          service.warranty_decision AS "warrantyDecision",
          service.coverage_source AS "coverageSource",
          service.coverage_ends_on AS "coverageEndsOn",
          service.estimate_status AS "estimateStatus",
          service.final_cost_irr::text AS "finalCostIrr",
          service.paid_irr::text AS "paidIrr",
          service.assigned_to AS "assignedTo",
          assignee.full_name AS "assignedToName",
          service.priority,
          service.due_at AS "dueAt",
          service.row_version AS "rowVersion",
          serial.serial_number AS "serialNumber",
          product.name AS "productName",
          party.display_name AS "customerName",
          party.mobile AS "customerMobile"
        FROM service_orders service
        JOIN serial_numbers serial ON serial.id = service.serial_id
        JOIN products product ON product.id = serial.product_id
        JOIN parties party ON party.id = service.customer_id
        LEFT JOIN users assignee
          ON assignee.id = service.assigned_to
          AND assignee.company_id = service.company_id
        WHERE service.company_id = $1
          AND ($2::text IS NULL OR service.status = $2 OR ($2 = 'archive' AND service.status IN ('delivered', 'cancelled')))
          AND (
            $3::text IS NULL
            OR serial.serial_number ILIKE '%' || $3 || '%'
            OR service.tracking_code ILIKE '%' || $3 || '%'
            OR party.display_name ILIKE '%' || $3 || '%'
          )
       ORDER BY
         CASE WHEN service.status = ANY($4::text[]) THEN 0 ELSE 1 END,
          CASE WHEN service.due_at IS NOT NULL AND service.due_at < now() THEN 0 ELSE 1 END,
          CASE service.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
          service.due_at NULLS LAST,
         service.received_at DESC
        LIMIT $5 OFFSET $6
      `,
      [
        actor.companyId,
        input.status ?? null,
        input.search || null,
        activeStatuses,
        input.limit,
        input.offset,
      ],
    );
    response.json({data: result.rows});
  }),
);

serviceRouter.post(
  '/orders',
  requirePermissions(PERMISSIONS.SERVICE_RECEPTION),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        branchId: identifierSchema,
        serialNumber: z.string().trim().min(1).max(160),
        complaint: z.string().trim().min(3).max(4000),
        intakeCondition: optionalText,
        receivedAccessories: optionalText,
      })
      .parse(request.body);

    const created = await withTransaction(async (client) => {
      const serialResult = await client.query<{
        serial_id: string;
        serial_status: string;
        product_name: string;
        customer_id: string;
        customer_name: string;
        customer_mobile: string | null;
        warranty_id: string | null;
        service_warranty_id: string | null;
        source_service_order_id: string | null;
        coverage_source: 'sale_warranty' | 'service_warranty' | 'none';
        coverage_starts_on: string | null;
        coverage_ends_on: string | null;
        is_in_warranty: boolean;
      }>(
        `
          SELECT
            serial.id AS serial_id,
            serial.status AS serial_status,
            product.name AS product_name,
            sale.customer_id,
            customer.display_name AS customer_name,
            customer.mobile AS customer_mobile,
            warranty.id AS warranty_id,
            service_warranty.id AS service_warranty_id,
            service_warranty.service_order_id AS source_service_order_id,
            CASE
              WHEN warranty.id IS NOT NULL THEN 'sale_warranty'
              WHEN service_warranty.id IS NOT NULL THEN 'service_warranty'
              ELSE 'none'
            END AS coverage_source,
            COALESCE(
              warranty.starts_on,
              service_warranty.starts_on
            ) AS coverage_starts_on,
            COALESCE(
              warranty.ends_on,
              service_warranty.ends_on
            ) AS coverage_ends_on,
            CASE
              WHEN warranty.id IS NOT NULL OR service_warranty.id IS NOT NULL THEN true
              ELSE false
            END AS is_in_warranty
          FROM serial_numbers serial
          JOIN products product ON product.id = serial.product_id
          JOIN service_serial_sales sold_serial ON sold_serial.serial_id = serial.id
          JOIN sale_invoice_lines sale_line ON sale_line.id = sold_serial.invoice_line_id
          JOIN sale_invoices sale
            ON sale.id = sale_line.invoice_id
            AND sale.status = 'posted'
          JOIN parties customer ON customer.id = sale.customer_id
          LEFT JOIN LATERAL (
            SELECT candidate.*
            FROM warranties candidate
            WHERE candidate.serial_id = serial.id
              AND candidate.status = 'active'
              AND current_date BETWEEN candidate.starts_on AND candidate.ends_on
            ORDER BY candidate.ends_on DESC, candidate.created_at DESC
            LIMIT 1
          ) warranty ON true
          LEFT JOIN LATERAL (
            SELECT candidate.*
            FROM service_warranties candidate
            WHERE candidate.company_id = serial.company_id
              AND candidate.serial_id = serial.id
              AND candidate.status = 'active'
              AND current_date BETWEEN candidate.starts_on AND candidate.ends_on
            ORDER BY candidate.ends_on DESC, candidate.created_at DESC
            LIMIT 1
          ) service_warranty ON true
          WHERE serial.company_id = $1
            AND serial.serial_number = $2
          FOR UPDATE OF serial
        `,
        [actor.companyId, input.serialNumber],
      );
      const serial = serialResult.rows[0];
      if (!serial) {
        throw new AppError(
          404,
          'SOLD_SERIAL_NOT_FOUND',
          '\u067e\u0630\u06cc\u0631\u0634 \u0641\u0642\u0637 \u0628\u0631\u0627\u06cc \u062f\u0633\u062a\u06af\u0627\u0647\u06cc \u0645\u062c\u0627\u0632 \u0627\u0633\u062a \u06a9\u0647 \u0641\u0631\u0648\u0634 \u0642\u0637\u0639\u06cc \u0622\u0646 \u062f\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u062b\u0628\u062a \u0634\u062f\u0647 \u0628\u0627\u0634\u062f.',
        );
      }
      if (serial.serial_status !== 'sold') {
        throw new AppError(
          409,
          'SERIAL_NOT_AVAILABLE_FOR_SERVICE',
          '\u0627\u06cc\u0646 \u062f\u0633\u062a\u06af\u0627\u0647 \u062f\u0631 \u0648\u0636\u0639\u06cc\u062a \u0642\u0627\u0628\u0644 \u067e\u0630\u06cc\u0631\u0634 \u0628\u0631\u0627\u06cc \u062e\u062f\u0645\u0627\u062a \u0642\u0631\u0627\u0631 \u0646\u062f\u0627\u0631\u062f.',
        );
      }
      const branch = await client.query<{branch_name: string; company_name: string}>(
        `
          SELECT branch.name AS branch_name, company.name_fa AS company_name
          FROM branches branch
          JOIN companies company ON company.id = branch.company_id
          WHERE branch.id = $1
            AND branch.company_id = $2
            AND branch.is_active = true
        `,
        [input.branchId, actor.companyId],
      );
      if (!branch.rowCount) {
        throw new AppError(422, 'INVALID_BRANCH', '\u0634\u0639\u0628\u0647 \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.');
      }

      const orderNumber = await nextSequence(
        client,
        actor.companyId,
        'service_order',
        input.branchId,
      );
      const code = trackingCode();
      const orderResult = await client.query<{id: string; received_at: Date}>(
        `
          INSERT INTO service_orders (
            company_id,
            branch_id,
            order_number,
            tracking_code,
            tracking_token_hash,
            serial_id,
            customer_id,
            warranty_id,
            service_warranty_id,
            source_service_order_id,
            coverage_source,
            coverage_starts_on,
            coverage_ends_on,
            coverage_checked_at,
            received_by,
            complaint,
            intake_condition,
            received_accessories,
            warranty_decision,
            estimate_status
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
            $13, now(), $14, $15, $16, $17, $18, $19
          )
          RETURNING id, received_at
        `,
        [
          actor.companyId,
          input.branchId,
          orderNumber.toString(),
          code,
          hashTrackingCode(code),
          serial.serial_id,
          serial.customer_id,
          serial.warranty_id,
          serial.service_warranty_id,
          serial.source_service_order_id,
          serial.coverage_source,
          serial.coverage_starts_on,
          serial.coverage_ends_on,
          actor.id,
          input.complaint,
          input.intakeCondition,
          input.receivedAccessories,
          serial.is_in_warranty ? 'in_warranty' : 'out_of_warranty',
          serial.is_in_warranty ? 'not_required' : 'pending',
        ],
      );
      const orderId = orderResult.rows[0]?.id;
      if (!orderId) throw new Error('Service order was not created');
      await client.query(
        `
          UPDATE serial_numbers
          SET status = 'in_service', row_version = row_version + 1
          WHERE id = $1
        `,
        [serial.serial_id],
      );
      await insertEvent(client, {
        serviceOrderId: orderId,
        eventType: 'received',
        toStatus: 'received',
        description: '\u062f\u0633\u062a\u06af\u0627\u0647 \u062f\u0631 \u0648\u0627\u062d\u062f \u062e\u062f\u0645\u0627\u062a \u067e\u0630\u06cc\u0631\u0634 \u0634\u062f.',
        metadata: {
          warrantyDecision: serial.is_in_warranty ? 'in_warranty' : 'out_of_warranty',
          coverageSource: serial.coverage_source,
          coverageStartsOn: serial.coverage_starts_on,
          coverageEndsOn: serial.coverage_ends_on,
          sourceServiceOrderId: serial.source_service_order_id,
        },
        createdBy: actor.id,
      });
      const outputSettings = await getServiceOutputSettings(client, actor.companyId);
      const smsId = outputSettings.intakePrintEnabled
        ? null
        : await queueSmsIfEnabled(client, {
            companyId: actor.companyId,
            recipient: serial.customer_mobile,
            messageText: `\u067e\u0630\u06cc\u0631\u0634 \u062f\u0633\u062a\u06af\u0627\u0647 \u0634\u0645\u0627 \u062b\u0628\u062a \u0634\u062f. \u06a9\u062f \u067e\u06cc\u06af\u06cc\u0631\u06cc: ${code}`,
            messageType: 'service_received',
            relatedEntityType: 'service_order',
            relatedEntityId: orderId,
          });
      await writeAudit(client, request, {
        action: 'service.receive',
        entityType: 'service_order',
        entityId: orderId,
        after: {orderNumber: orderNumber.toString(), trackingCode: code},
      });
      return {
        id: orderId,
        orderNumber: orderNumber.toString(),
        trackingCode: code,
        printIntent: outputSettings.intakePrintEnabled,
        smsQueued: smsId !== null,
        printSnapshot: outputSettings.intakePrintEnabled
          ? {
              companyName: branch.rows[0]?.company_name ?? '',
              branchName: branch.rows[0]?.branch_name ?? '',
              orderNumber: orderNumber.toString(),
              trackingCode: code,
              receivedAt: orderResult.rows[0]?.received_at,
              customerName: serial.customer_name,
              customerMobile: serial.customer_mobile,
              productName: serial.product_name,
              serialNumber: input.serialNumber,
              complaint: input.complaint,
              intakeCondition: input.intakeCondition,
              receivedAccessories: input.receivedAccessories,
              coverageSource: serial.coverage_source,
              coverageEndsOn: serial.coverage_ends_on,
              paperSize: outputSettings.paperSize,
              printReceipt: outputSettings.printReceipt,
              printDeviceLabel: outputSettings.printDeviceLabel,
            }
          : null,
      };
    });
    response.status(201).json({data: created});
  }),
);

serviceRouter.get(
  '/orders/:id',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    const orderResult = await query(
      `
        SELECT
          service.id,
          service.branch_id AS "branchId",
          branch.name AS "branchName",
          service.order_number::text AS "orderNumber",
          service.tracking_code AS "trackingCode",
          service.received_at AS "receivedAt",
          service.complaint,
          (SELECT name_fa FROM companies WHERE id=service.company_id) AS company_name,
          service.intake_condition AS "intakeCondition",
          service.received_accessories AS "receivedAccessories",
          service.status,
          service.coverage_source AS "coverageSource",
          service.service_warranty_id AS "serviceWarrantyId",
          service.source_service_order_id AS "sourceServiceOrderId",
          service.coverage_starts_on AS "coverageStartsOn",
          service.coverage_ends_on AS "coverageEndsOn",
          service.coverage_checked_at AS "coverageCheckedAt",
          service.assigned_to AS "assignedTo",
          assignee.full_name AS "assignedToName",
          service.priority,
          service.due_at AS "dueAt",
          service.warranty_decision AS "warrantyDecision",
          service.warranty_rejection_reason AS "warrantyRejectionReason",
          service.warranty_rejection_evidence AS "warrantyRejectionEvidence",
          service.estimated_cost_irr::text AS "estimatedCostIrr",
          service.estimate_status AS "estimateStatus",
          service.final_cost_irr::text AS "finalCostIrr",
          service.paid_irr::text AS "paidIrr",
          service.delivered_at AS "deliveredAt",
          service.delivered_to_name AS "deliveredToName",
          service.delivered_to_mobile AS "deliveredToMobile",
          service.delivery_confirmation AS "deliveryConfirmation",
          service.row_version AS "rowVersion",
          serial.serial_number AS "serialNumber",
          product.code AS "productCode",
          product.name AS "productName",
          party.id AS "customerId",
          party.display_name AS "customerName",
          party.mobile AS "customerMobile",
          warranty.starts_on AS "warrantyStartsOn",
          warranty.ends_on AS "warrantyEndsOn",
          CASE
            WHEN warranty.ends_on IS NULL THEN 0
            ELSE GREATEST(warranty.ends_on - current_date, 0)
          END AS "warrantyRemainingDays"
        FROM service_orders service
        JOIN branches branch ON branch.id = service.branch_id
        JOIN serial_numbers serial ON serial.id = service.serial_id
        JOIN products product ON product.id = serial.product_id
        JOIN parties party ON party.id = service.customer_id
        LEFT JOIN users assignee
          ON assignee.id = service.assigned_to
          AND assignee.company_id = service.company_id
        LEFT JOIN warranties warranty ON warranty.id = service.warranty_id
        WHERE service.id = $1 AND service.company_id = $2
      `,
      [id, actor.companyId],
    );
    const order = orderResult.rows[0];
    if (!order) {
      throw new AppError(404, 'SERVICE_ORDER_NOT_FOUND', '\u067e\u0631\u0648\u0646\u062f\u0647 \u062e\u062f\u0645\u0627\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
    }
    const [
      events,
      parts,
      warranty,
      attachments,
      assignments,
      inspections,
      costs,
      replacement,
    ] = await Promise.all([
      query(
        `
          SELECT
            event_type AS "eventType",
            from_status AS "fromStatus",
            to_status AS "toStatus",
            description,
            metadata,
            created_at AS "createdAt"
          FROM service_events
          WHERE service_order_id = $1
          ORDER BY created_at, id
        `,
        [id],
      ),
      query(
        `
          SELECT
            part.id,
            part.quantity::text,
            part.usage_type AS "usageType",
            part.is_chargeable AS "isChargeable",
            part.unit_price_irr::text AS "unitPriceIrr",
            part.unit_cost_irr::text AS "unitCostIrr",
            part.is_reversed AS "isReversed",
            part.removed_disposition AS "removedDisposition",
            part.created_at AS "createdAt",
            product.code AS "productCode",
            product.name AS "productName",
            warehouse.name AS "warehouseName",
            serial.serial_number AS "serialNumber"
          FROM service_parts part
          JOIN products product ON product.id = part.product_id
          LEFT JOIN warehouses warehouse ON warehouse.id = part.warehouse_id
          LEFT JOIN serial_numbers serial ON serial.id = part.serial_id
          WHERE part.service_order_id = $1
          ORDER BY part.created_at, part.id
        `,
        [id],
      ),
      query(
        `
          SELECT
            duration_months AS "durationMonths",
            starts_on AS "startsOn",
            ends_on AS "endsOn",
            description
          FROM service_warranties
          WHERE service_order_id = $1
        `,
        [id],
      ),
      query(
        `
          SELECT
            file.id,
            file.original_name AS "originalName",
            file.mime_type AS "mimeType",
            file.byte_size::text AS "byteSize",
            attachment.attachment_type AS "attachmentType",
            attachment.caption,
            attachment.created_at AS "createdAt"
          FROM service_attachments attachment
          JOIN uploaded_files file ON file.id = attachment.uploaded_file_id
          WHERE attachment.service_order_id = $1
          ORDER BY attachment.created_at, file.id
        `,
        [id],
      ),
      query(
        `
          SELECT
            assignment.id,
            assignment.previous_assigned_to AS "previousAssignedTo",
            previous_user.full_name AS "previousAssignedToName",
            assignment.assigned_to AS "assignedTo",
            assigned_user.full_name AS "assignedToName",
            assignment.priority,
            assignment.due_at AS "dueAt",
            assignment.note,
            assignment.created_at AS "createdAt"
          FROM service_assignments assignment
          JOIN service_orders service ON service.id = assignment.service_order_id
          JOIN users assigned_user ON assigned_user.id = assignment.assigned_to
          LEFT JOIN users previous_user ON previous_user.id = assignment.previous_assigned_to
          WHERE assignment.service_order_id = $1
            AND assignment.company_id = $2
            AND service.company_id = $2
          ORDER BY assignment.created_at, assignment.id
        `,
        [id, actor.companyId],
      ),
      query(
        `
          SELECT
            inspection.id,
            inspection.inspection_type AS "inspectionType",
            inspection.result_status AS "resultStatus",
            inspection.observed_fault AS "observedFault",
            inspection.fault_cause AS "faultCause",
            inspection.action_taken AS "actionTaken",
            inspection.test_result AS "testResult",
            inspection.checklist,
            app_user.full_name AS "recordedByName",
            inspection.created_at AS "createdAt"
          FROM service_inspections inspection
          JOIN service_orders service ON service.id = inspection.service_order_id
          JOIN users app_user ON app_user.id = inspection.recorded_by
          WHERE inspection.service_order_id = $1
            AND inspection.company_id = $2
            AND service.company_id = $2
          ORDER BY inspection.created_at, inspection.id
        `,
        [id, actor.companyId],
      ),
      query(
        `
          SELECT
            cost.id,
            cost.cost_type AS "costType",
            cost.amount_irr::text AS "amountIrr",
            cost.description,
            app_user.full_name AS "recordedByName",
            cost.created_at AS "createdAt"
          FROM service_costs cost
          JOIN service_orders service ON service.id = cost.service_order_id
          JOIN users app_user ON app_user.id = cost.recorded_by
          WHERE cost.service_order_id = $1
            AND cost.company_id = $2
            AND service.company_id = $2
          ORDER BY cost.created_at, cost.id
        `,
        [id, actor.companyId],
      ),
      query(
        `
          SELECT
            replacement.id,
            old_serial.serial_number AS "oldSerialNumber",
            new_serial.serial_number AS "newSerialNumber",
            replacement.coverage_ends_on AS "coverageEndsOn",
            replacement.old_serial_disposition AS "oldSerialDisposition",
            replacement.reason,
            replacement.created_at AS "createdAt"
          FROM service_replacements replacement
          JOIN service_orders service ON service.id = replacement.service_order_id
          JOIN serial_numbers old_serial ON old_serial.id = replacement.old_serial_id
          JOIN serial_numbers new_serial ON new_serial.id = replacement.new_serial_id
          WHERE replacement.service_order_id = $1
            AND replacement.company_id = $2
            AND service.company_id = $2
        `,
        [id, actor.companyId],
      ),
    ]);
    response.json({
      data: {
        ...order,
        events: events.rows,
        parts: parts.rows,
        serviceWarranty: warranty.rows[0] ?? null,
        attachments: attachments.rows,
        assignments: assignments.rows,
        inspections: inspections.rows,
        costs: costs.rows,
        replacement: replacement.rows[0] ?? null,
      },
    });
  }),
);


serviceRouter.post(
  '/orders/:id/attachments',
  serviceAttachmentUpload.single('file'),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    if (
      !actor.permissions.includes(PERMISSIONS.SERVICE_RECEPTION) &&
      !actor.permissions.includes(PERMISSIONS.SERVICE_REPAIR)
    ) {
      throw new AppError(
        403,
        'PERMISSION_DENIED',
        'مجوز افزودن مستند به پرونده خدمات صادر نشده است.',
      );
    }
    const id = identifierSchema.parse(request.params.id);
    const input = z
      .object({
        attachmentType: serviceAttachmentTypeSchema,
        caption: z.string().trim().max(1000).nullable().default(null),
      })
      .parse({
        attachmentType: request.body.attachmentType,
        caption: String(request.body.caption ?? '').trim() || null,
      });
    const file = request.file;
    if (!file) {
      throw new AppError(
        422,
        'SERVICE_ATTACHMENT_REQUIRED',
        'فایل مستند انتخاب نشده است.',
      );
    }
    const extensionByType: Readonly<Record<string, string>> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    const extension = extensionByType[file.mimetype];
    if (!extension) {
      throw new AppError(
        422,
        'UNSUPPORTED_SERVICE_ATTACHMENT',
        'فرمت فایل باید PNG، JPEG، WebP یا PDF باشد.',
      );
    }

    await mkdir(config.uploadsDir, {recursive: true});
    const storedName = 'service-' + randomUUID() + extension;
    const storagePath = path.join(config.uploadsDir, storedName);
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    await writeFile(storagePath, file.buffer, {flag: 'wx'});
    try {
      const created = await withTransaction(async (client) => {
        const order = await client.query(
          `
            SELECT 1
            FROM service_orders
            WHERE id = $1 AND company_id = $2
            FOR UPDATE
          `,
          [id, actor.companyId],
        );
        if (!order.rowCount) {
          throw new AppError(
            404,
            'SERVICE_ORDER_NOT_FOUND',
            'پرونده خدمات پیدا نشد.',
          );
        }
        const uploaded = await client.query<{id: string}>(
          `
            INSERT INTO uploaded_files (
              company_id,
              uploaded_by,
              storage_path,
              original_name,
              mime_type,
              byte_size,
              sha256,
              purpose
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'service_attachment')
            RETURNING id
          `,
          [
            actor.companyId,
            actor.id,
            storedName,
            file.originalname,
            file.mimetype,
            file.size,
            sha256,
          ],
        );
        const fileId = uploaded.rows[0]?.id;
        if (!fileId) throw new Error('Service attachment was not created');
        await client.query(
          `
            INSERT INTO service_attachments (
              service_order_id,
              uploaded_file_id,
              attachment_type,
              caption
            )
            VALUES ($1, $2, $3, $4)
          `,
          [id, fileId, input.attachmentType, input.caption],
        );
        await insertEvent(client, {
          serviceOrderId: id,
          eventType: 'attachment_added',
          description: 'مستند جدید به پرونده افزوده شد.',
          metadata: {
            fileId,
            attachmentType: input.attachmentType,
            caption: input.caption,
          },
          createdBy: actor.id,
        });
        await writeAudit(client, request, {
          action: 'service.attachment.add',
          entityType: 'uploaded_file',
          entityId: fileId,
          after: {
            serviceOrderId: id,
            attachmentType: input.attachmentType,
            originalName: file.originalname,
            mimeType: file.mimetype,
            byteSize: file.size,
            sha256,
          },
        });
        return {id: fileId};
      });
      response.status(201).json({data: created});
    } catch (caught) {
      await unlink(storagePath).catch(() => undefined);
      throw caught;
    }
  }),
);

serviceRouter.get(
  '/attachments/:fileId',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const fileId = identifierSchema.parse(request.params.fileId);
    const result = await query<{
      storage_path: string;
      original_name: string;
      mime_type: string;
    }>(
      `
        SELECT
          file.storage_path,
          file.original_name,
          file.mime_type
        FROM uploaded_files file
        JOIN service_attachments attachment
          ON attachment.uploaded_file_id = file.id
        JOIN service_orders service
          ON service.id = attachment.service_order_id
        WHERE file.id = $1
          AND file.company_id = $2
          AND service.company_id = $2
      `,
      [fileId, actor.companyId],
    );
    const found = result.rows[0];
    if (!found || path.basename(found.storage_path) !== found.storage_path) {
      throw new AppError(
        404,
        'SERVICE_ATTACHMENT_NOT_FOUND',
        'فایل مستند پیدا نشد.',
      );
    }
    response.type(found.mime_type);
    response.setHeader(
      'Content-Disposition',
      'inline; filename="' + encodeURIComponent(found.original_name) + '"',
    );
    response.sendFile(path.join(config.uploadsDir, found.storage_path));
  }),
);

serviceRouter.post(
  '/orders/:id/assignment',
  requirePermissions(PERMISSIONS.SERVICE_REPAIR),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    const input = z
      .object({
        technicianId: identifierSchema.optional(),
        assignedTo: identifierSchema.optional(),
        priority: servicePrioritySchema.default('normal'),
        dueAt: z
          .string()
          .trim()
          .refine((value) => !Number.isNaN(Date.parse(value)), {
            message: 'موعد انجام معتبر نیست.',
          })
          .nullable()
          .default(null),
        note: z.string().trim().max(2000).nullable().default(null),
        rowVersion: z.number().int().positive(),
      })
      .refine((value) => Boolean(value.technicianId ?? value.assignedTo), {
        path: ['technicianId'],
        message: 'انتخاب تعمیرکار الزامی است.',
      })
      .transform((value) => ({
        ...value,
        technicianId: value.technicianId ?? value.assignedTo!,
      }))
      .parse(request.body);
    const created = await withTransaction(async (client) => {
      const orderResult = await client.query<{
        status: ServiceStatus;
        assigned_to: string | null;
        row_version: number;
      }>(
        `
          SELECT status, assigned_to, row_version
          FROM service_orders
          WHERE id = $1 AND company_id = $2
          FOR UPDATE
        `,
        [id, actor.companyId],
      );
      const order = orderResult.rows[0];
      if (!order) {
        throw new AppError(404, 'SERVICE_ORDER_NOT_FOUND', 'پرونده خدمات پیدا نشد.');
      }
      if (!activeStatuses.includes(order.status)) {
        throw new AppError(409, 'SERVICE_ORDER_FINALIZED', 'پرونده نهایی‌شده قابل تخصیص نیست.');
      }
      if (order.row_version !== input.rowVersion) {
        throw new AppError(409, 'STALE_DATA', 'پرونده توسط کاربر دیگری تغییر کرده است.');
      }
      const eligible = await client.query(
        `
          SELECT 1
          FROM users app_user
          JOIN user_roles user_role ON user_role.user_id = app_user.id
          JOIN roles role
            ON role.id = user_role.role_id
            AND role.company_id = app_user.company_id
            AND role.is_active = true
          JOIN role_permissions role_permission
            ON role_permission.role_id = role.id
            AND role_permission.permission_code = $3
          WHERE app_user.id = $1
            AND app_user.company_id = $2
            AND app_user.is_active = true
          LIMIT 1
        `,
        [input.technicianId, actor.companyId, PERMISSIONS.SERVICE_REPAIR],
      );
      if (!eligible.rowCount) {
        throw new AppError(422, 'INVALID_SERVICE_TECHNICIAN', 'تعمیرکار انتخاب‌شده فعال یا دارای مجوز تعمیر نیست.');
      }
      const updated = await client.query<{row_version: number}>(
        `
          UPDATE service_orders
          SET
            assigned_to = $3,
            priority = $4,
            due_at = $5,
            row_version = row_version + 1
          WHERE id = $1 AND company_id = $2 AND row_version = $6
          RETURNING row_version
        `,
        [id, actor.companyId, input.technicianId, input.priority, input.dueAt, input.rowVersion],
      );
      const newVersion = updated.rows[0]?.row_version;
      if (!newVersion) {
        throw new AppError(409, 'STALE_DATA', 'پرونده هم‌زمان تغییر کرده است.');
      }
      await client.query(
        `
          UPDATE service_assignments
          SET released_at = now(), released_by = $3
          WHERE service_order_id = $1
            AND company_id = $2
            AND released_at IS NULL
        `,
        [id, actor.companyId, actor.id],
      );
      const assignment = await client.query<{id: string}>(
        `
          INSERT INTO service_assignments (
            company_id, service_order_id, previous_assigned_to, assigned_to,
            assigned_by, priority, due_at, note
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `,
        [
          actor.companyId,
          id,
          order.assigned_to,
          input.technicianId,
          actor.id,
          input.priority,
          input.dueAt,
          input.note,
        ],
      );
      const assignmentId = assignment.rows[0]?.id;
      if (!assignmentId) throw new Error('Service assignment was not created');
      await insertEvent(client, {
        serviceOrderId: id,
        eventType: 'assigned',
        description: input.note ?? 'مسئول پرونده خدمات تعیین شد.',
        metadata: {
          assignmentId,
          previousAssignedTo: order.assigned_to,
          assignedTo: input.technicianId,
          priority: input.priority,
          dueAt: input.dueAt,
        },
        createdBy: actor.id,
      });
      await writeAudit(client, request, {
        action: 'service.assignment.create',
        entityType: 'service_assignment',
        entityId: assignmentId,
        before: {assignedTo: order.assigned_to},
        after: {
          technicianId: input.technicianId,
          priority: input.priority,
          dueAt: input.dueAt,
          note: input.note,
          rowVersion: input.rowVersion,
        },
      });
      return {id: assignmentId, rowVersion: newVersion};
    });
    response.status(201).json({data: created});
  }),
);

serviceRouter.post(
  '/orders/:id/location',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    if (!actor.permissions.includes(PERMISSIONS.SERVICE_RECEPTION) && !actor.permissions.includes(PERMISSIONS.SERVICE_REPAIR)) throw new AppError(403, 'PERMISSION_DENIED', 'مجوز ثبت محل دستگاه را ندارید.');
    const id = identifierSchema.parse(request.params.id);
    const input = z.object({location: z.string().trim().min(2).max(300), rowVersion: z.number().int().positive()}).parse(request.body);
    await withTransaction(async client => {
      const updated = await client.query(
        "UPDATE service_orders SET row_version = row_version + 1 WHERE id=$1 AND company_id=$2 AND row_version=$3 AND status NOT IN ('delivered','cancelled') RETURNING id",
        [id, actor.companyId, input.rowVersion]);
      if (!updated.rowCount) throw new AppError(409, 'STALE_DATA', 'پرونده تغییر کرده یا بسته شده است؛ آن را دوباره باز کنید.');
      await insertEvent(client, {serviceOrderId:id, eventType:'location_changed', description:input.location, metadata:{location:input.location}, createdBy:actor.id});
      await writeAudit(client, request, {action:'service.location', entityType:'service_order', entityId:id, after:input});
    });
    response.status(204).end();
  }),
);

serviceRouter.post(
  '/orders/:id/return-unrepaired',
  requirePermissions(PERMISSIONS.SERVICE_DELIVER),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    const input = z.object({
      reason:z.string().trim().min(3).max(2000),
      receiver:z.string().trim().min(2).max(180),
      mobile:z.string().trim().max(30),
      rowVersion:z.number().int().positive(),
    }).parse(request.body);
    await withTransaction(async client => {
      const result = await client.query("SELECT status, row_version, serial_id, final_cost_irr::text, paid_irr::text FROM service_orders WHERE id=$1 AND company_id=$2 FOR UPDATE", [id, actor.companyId]);
      const order=result.rows[0];
      if(!order || order.row_version!==input.rowVersion) throw new AppError(409,'STALE_DATA','پرونده تغییر کرده است؛ دوباره باز کنید.');
      if(!['received','diagnosis','waiting_customer','waiting_part','repairing','final_test','cancelled'].includes(order.status)) throw new AppError(409,'INVALID_EXIT','خروج بدون تعمیر در این مرحله مجاز نیست.');
      const blocked = await client.query(
        "SELECT 1 FROM service_parts WHERE service_order_id=$1 AND usage_type='installed' AND is_reversed=false UNION ALL SELECT 1 FROM service_replacements WHERE service_order_id=$1 UNION ALL SELECT 1 FROM service_orders WHERE id=$1 AND delivered_at IS NOT NULL",
        [id]);
      if(blocked.rowCount || order.final_cost_irr!=='0' || order.paid_irr!=='0') throw new AppError(409,'EXIT_REQUIRES_CORRECTION','پیش از خروج بدون تعمیر، قطعات مصرفی و مبالغ دریافت‌شده باید با عملیات اصلاحی تعیین تکلیف شوند.');
      await client.query("UPDATE service_orders SET status='cancelled', delivered_at=now(), delivered_by=$2, delivered_to_name=$3, delivered_to_mobile=$4, delivery_confirmation=$5, row_version=row_version+1 WHERE id=$1",[id,actor.id,input.receiver,input.mobile||null,input.reason]);
      await client.query("UPDATE serial_numbers SET status='sold', row_version=row_version+1 WHERE id=$1 AND company_id=$2 AND status='in_service'",[order.serial_id,actor.companyId]);
      await insertEvent(client,{serviceOrderId:id,eventType:'returned_unrepaired',fromStatus:order.status,toStatus:'cancelled',description:input.reason,metadata:{receiver:input.receiver,mobile:input.mobile},createdBy:actor.id});
      await writeAudit(client,request,{action:'service.return_unrepaired',entityType:'service_order',entityId:id,after:input});
    });
    response.status(204).end();
  }),
);


serviceRouter.post(
  '/orders/:id/inspections',
  requirePermissions(PERMISSIONS.SERVICE_REPAIR),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    const input = z
      .object({
        inspectionType: inspectionTypeSchema,
        resultStatus: inspectionResultSchema,
        observedFault: z.string().trim().min(2).max(4000),
        faultCause: z.string().trim().max(4000).nullable().default(null),
        actionTaken: z.string().trim().max(4000).nullable().default(null),
        testResult: z.string().trim().max(4000).nullable().default(null),
        checklist: inspectionChecklistSchema.default({}),
        rowVersion: z.number().int().positive(),
      })
      .parse(request.body);
    const created = await withTransaction(async (client) => {
      const orderResult = await client.query<{status: ServiceStatus; row_version: number}>(
        `
          SELECT status, row_version
          FROM service_orders
          WHERE id = $1 AND company_id = $2
          FOR UPDATE
        `,
        [id, actor.companyId],
      );
      const order = orderResult.rows[0];
      if (!order) throw new AppError(404, 'SERVICE_ORDER_NOT_FOUND', 'پرونده خدمات پیدا نشد.');
      if (order.row_version !== input.rowVersion) {
        throw new AppError(409, 'STALE_DATA', 'پرونده توسط کاربر دیگری تغییر کرده است.');
      }
      const allowed = input.inspectionType === 'diagnosis'
        ? ['received', 'diagnosis', 'waiting_customer', 'waiting_part']
        : ['repairing', 'final_test'];
      if (!allowed.includes(order.status)) {
        throw new AppError(409, 'SERVICE_INSPECTION_NOT_ALLOWED', 'این نوع بررسی در مرحله فعلی پرونده قابل ثبت نیست.');
      }
      const inspection = await client.query<{id: string}>(
        `
          INSERT INTO service_inspections (
            company_id, service_order_id, inspection_type, result_status,
            observed_fault, fault_cause, action_taken, test_result,
            checklist, recorded_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
          RETURNING id
        `,
        [
          actor.companyId,
          id,
          input.inspectionType,
          input.resultStatus,
          input.observedFault,
          input.faultCause,
          input.actionTaken,
          input.testResult,
          JSON.stringify(input.checklist),
          actor.id,
        ],
      );
      const inspectionId = inspection.rows[0]?.id;
      if (!inspectionId) throw new Error('Service inspection was not created');
      const updated = await client.query<{row_version: number}>(
        `
          UPDATE service_orders
          SET row_version = row_version + 1
          WHERE id = $1 AND company_id = $2 AND row_version = $3
          RETURNING row_version
        `,
        [id, actor.companyId, input.rowVersion],
      );
      const newVersion = updated.rows[0]?.row_version;
      if (!newVersion) throw new AppError(409, 'STALE_DATA', 'پرونده هم‌زمان تغییر کرده است.');
      await insertEvent(client, {
        serviceOrderId: id,
        eventType: input.inspectionType === 'diagnosis' ? 'diagnosis_recorded' : 'final_test_recorded',
        description: input.observedFault,
        metadata: {
          inspectionId,
          inspectionType: input.inspectionType,
          resultStatus: input.resultStatus,
          checklist: input.checklist,
        },
        createdBy: actor.id,
      });
      await writeAudit(client, request, {
        action: `service.inspection.${input.inspectionType}`,
        entityType: 'service_inspection',
        entityId: inspectionId,
        after: input,
      });
      return {id: inspectionId, rowVersion: newVersion};
    });
    response.status(201).json({data: created});
  }),
);

serviceRouter.post(
  '/orders/:id/costs',
  requirePermissions(PERMISSIONS.SERVICE_REPAIR),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    const input = z
      .object({
        costType: z.enum(['labor', 'outsourcing', 'transport', 'other']),
        amountIrr: z.coerce.bigint().positive().transform(String),
        description: z.string().trim().min(2).max(2000),
      })
      .parse(request.body);
    const created = await withTransaction(async (client) => {
      const order = await client.query<{status: ServiceStatus}>(
        `
          SELECT status FROM service_orders
          WHERE id = $1 AND company_id = $2
          FOR UPDATE
        `,
        [id, actor.companyId],
      );
      const row = order.rows[0];
      if (!row) throw new AppError(404, 'SERVICE_ORDER_NOT_FOUND', 'پرونده خدمات پیدا نشد.');
      if (!activeStatuses.includes(row.status) || row.status === 'ready_delivery') {
        throw new AppError(409, 'SERVICE_ORDER_FINALIZED', 'برای پرونده نهایی‌شده هزینه جدید ثبت نمی‌شود.');
      }
      const result = await client.query<{id: string}>(
        `
          INSERT INTO service_costs (
            company_id, service_order_id, cost_type, amount_irr,
            description, recorded_by
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `,
        [actor.companyId, id, input.costType, input.amountIrr, input.description, actor.id],
      );
      const costId = result.rows[0]?.id;
      if (!costId) throw new Error('Service cost was not created');
      await client.query(
        `UPDATE service_orders SET row_version = row_version + 1 WHERE id = $1`,
        [id],
      );
      await insertEvent(client, {
        serviceOrderId: id,
        eventType: 'cost_recorded',
        description: input.description,
        metadata: {costId, costType: input.costType, amountIrr: input.amountIrr},
        createdBy: actor.id,
      });
      await writeAudit(client, request, {
        action: 'service.cost.create',
        entityType: 'service_cost',
        entityId: costId,
        after: input,
      });
      return {id: costId};
    });
    response.status(201).json({data: created});
  }),
);

serviceRouter.post(
  '/orders/:id/warranty-decision',
  requirePermissions(PERMISSIONS.SERVICE_REPAIR),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    const input = z
      .discriminatedUnion('decision', [
        z.object({decision: z.literal('in_warranty')}),
        z.object({decision: z.literal('out_of_warranty')}),
        z.object({
          decision: z.literal('rejected'),
          reason: z.string().trim().min(3).max(2000),
          evidence: z.string().trim().min(3).max(4000),
        }),
      ])
      .parse(request.body);
    if (
      input.decision === 'rejected' &&
      !actor.permissions.includes(PERMISSIONS.SERVICE_REJECT_WARRANTY)
    ) {
      throw new AppError(
        403,
        'PERMISSION_DENIED',
        '\u0645\u062c\u0648\u0632 \u0631\u062f \u06af\u0627\u0631\u0627\u0646\u062a\u06cc \u0628\u0631\u0627\u06cc \u0627\u06cc\u0646 \u06a9\u0627\u0631\u0628\u0631 \u0635\u0627\u062f\u0631 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.',
      );
    }

    await withTransaction(async (client) => {
      const result = await client.query<{
        status: ServiceStatus;
        warranty_id: string | null;
        coverage_source: 'sale_warranty' | 'service_warranty' | 'none';
        warranty_valid: boolean;
      }>(
        `
          SELECT
            service.status,
            service.warranty_id,
            service.coverage_source,
            (service.coverage_source <> 'none') AS warranty_valid
          FROM service_orders service
          WHERE service.id = $1 AND service.company_id = $2
          FOR UPDATE OF service
        `,
        [id, actor.companyId],
      );
      const order = result.rows[0];
      if (!order) {
        throw new AppError(404, 'SERVICE_ORDER_NOT_FOUND', '\u067e\u0631\u0648\u0646\u062f\u0647 \u062e\u062f\u0645\u0627\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
      }
      if (!activeStatuses.includes(order.status)) {
        throw new AppError(409, 'SERVICE_ORDER_FINALIZED', '\u0627\u06cc\u0646 \u067e\u0631\u0648\u0646\u062f\u0647 \u0642\u0627\u0628\u0644 \u062a\u063a\u06cc\u06cc\u0631 \u0646\u06cc\u0633\u062a.');
      }
      if (input.decision === 'in_warranty' && !order.warranty_valid) {
        throw new AppError(
          422,
          'WARRANTY_NOT_VALID',
          '\u06af\u0627\u0631\u0627\u0646\u062a\u06cc \u0641\u0639\u0627\u0644 \u0648 \u0645\u0639\u062a\u0628\u0631 \u0628\u0631\u0627\u06cc \u0627\u06cc\u0646 \u062f\u0633\u062a\u06af\u0627\u0647 \u0648\u062c\u0648\u062f \u0646\u062f\u0627\u0631\u062f.',
        );
      }
      const reason = input.decision === 'rejected' ? input.reason : null;
      const evidence = input.decision === 'rejected' ? input.evidence : null;
      const estimateStatus =
        input.decision === 'in_warranty' ? 'not_required' : 'pending';
      await client.query(
        `
          UPDATE service_orders
          SET
            warranty_decision = $2,
            warranty_rejection_reason = $3,
            warranty_rejection_evidence = $4,
            estimate_status = $5,
            row_version = row_version + 1
          WHERE id = $1
        `,
        [id, input.decision, reason, evidence, estimateStatus],
      );
      await insertEvent(client, {
        serviceOrderId: id,
        eventType: 'warranty_decision',
        description:
          input.decision === 'in_warranty'
            ? '\u067e\u0648\u0634\u0634 \u06af\u0627\u0631\u0627\u0646\u062a\u06cc \u062a\u0623\u06cc\u06cc\u062f \u0634\u062f.'
            : input.decision === 'rejected'
              ? '\u062f\u0631\u062e\u0648\u0627\u0633\u062a \u06af\u0627\u0631\u0627\u0646\u062a\u06cc \u0628\u0627 \u062b\u0628\u062a \u062f\u0644\u06cc\u0644 \u0648 \u0645\u0633\u062a\u0646\u062f\u0627\u062a \u0631\u062f \u0634\u062f.'
              : '\u067e\u0631\u0648\u0646\u062f\u0647 \u062e\u0627\u0631\u062c \u0627\u0632 \u06af\u0627\u0631\u0627\u0646\u062a\u06cc \u062a\u0634\u062e\u06cc\u0635 \u062f\u0627\u062f\u0647 \u0634\u062f.',
        metadata: {
          decision: input.decision,
          reason,
          evidence,
          coverageSource: order.coverage_source,
        },
        createdBy: actor.id,
      });
      await writeAudit(client, request, {
        action: 'service.warranty_decision',
        entityType: 'service_order',
        entityId: id,
        after: {decision: input.decision, reason},
      });
    });
    response.status(204).end();
  }),
);

serviceRouter.post(
  '/orders/:id/estimate',
  requirePermissions(PERMISSIONS.SERVICE_REPAIR),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    const input = z
      .object({
        estimatedCostIrr: nonNegativeIrrSchema,
        status: z.enum(['pending', 'approved', 'rejected']),
        note: z.string().trim().min(2).max(2000),
      })
      .parse(request.body);
    await withTransaction(async (client) => {
      const result = await client.query<{
        status: ServiceStatus;
        warranty_decision: string;
        tracking_code: string;
        customer_mobile: string | null;
      }>(
        `
          SELECT
            service.status,
            service.warranty_decision,
            service.tracking_code,
            party.mobile AS customer_mobile
          FROM service_orders service
          JOIN parties party ON party.id = service.customer_id
          WHERE service.id = $1 AND service.company_id = $2
          FOR UPDATE OF service
        `,
        [id, actor.companyId],
      );
      const order = result.rows[0];
      if (!order) {
        throw new AppError(404, 'SERVICE_ORDER_NOT_FOUND', '\u067e\u0631\u0648\u0646\u062f\u0647 \u062e\u062f\u0645\u0627\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
      }
      if (order.warranty_decision === 'in_warranty') {
        throw new AppError(
          422,
          'ESTIMATE_NOT_REQUIRED',
          '\u0628\u0631\u0627\u06cc \u062a\u0639\u0645\u06cc\u0631 \u062a\u062d\u062a \u06af\u0627\u0631\u0627\u0646\u062a\u06cc \u0628\u0631\u0622\u0648\u0631\u062f \u0647\u0632\u06cc\u0646\u0647 \u0627\u0632 \u0645\u0634\u062a\u0631\u06cc \u062f\u0631\u06cc\u0627\u0641\u062a \u0646\u0645\u06cc\u200c\u0634\u0648\u062f.',
        );
      }
      await client.query(
        `
          UPDATE service_orders
          SET
            estimated_cost_irr = $2,
            estimate_status = $3,
            estimate_responded_at =
              CASE WHEN $3 IN ('approved', 'rejected') THEN now() ELSE NULL END,
            row_version = row_version + 1
          WHERE id = $1
        `,
        [id, input.estimatedCostIrr, input.status],
      );
      const smsId = input.status === 'pending'
        ? await queueSmsIfEnabled(client, {
            companyId: actor.companyId,
            recipient: order.customer_mobile,
            messageText: `برآورد هزینه پرونده ${order.tracking_code} مبلغ ${input.estimatedCostIrr} ریال ثبت شد. نتیجه بررسی را با واحد خدمات هماهنگ کنید.`,
            messageType: 'service_estimate',
            relatedEntityType: 'service_order',
            relatedEntityId: id,
          })
        : null;
      await insertEvent(client, {
        serviceOrderId: id,
        eventType: 'estimate',
        description: input.note,
        metadata: {
          estimatedCostIrr: input.estimatedCostIrr,
          status: input.status,
          smsQueued: smsId !== null,
        },
        createdBy: actor.id,
      });
      await writeAudit(client, request, {
        action: 'service.estimate',
        entityType: 'service_order',
        entityId: id,
        after: input,
      });
    });
    response.status(204).end();
  }),
);

serviceRouter.post(
  '/orders/:id/status',
  requirePermissions(PERMISSIONS.SERVICE_REPAIR),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    const input = z
      .object({
        status: serviceStatusSchema.exclude(['delivered']),
        description: z.string().trim().min(2).max(2000),
        rowVersion: z.number().int().positive(),
      })
      .parse(request.body);
    await withTransaction(async (client) => {
      const result = await client.query<{
        status: ServiceStatus;
        estimate_status: string;
        row_version: number;
        serial_id: string;
      }>(
        `
          SELECT status, estimate_status, row_version, serial_id
          FROM service_orders
          WHERE id = $1 AND company_id = $2
          FOR UPDATE
        `,
        [id, actor.companyId],
      );
      const order = result.rows[0];
      if (!order) {
        throw new AppError(404, 'SERVICE_ORDER_NOT_FOUND', '\u067e\u0631\u0648\u0646\u062f\u0647 \u062e\u062f\u0645\u0627\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
      }
      if (order.row_version !== input.rowVersion) {
        throw new AppError(
          409,
          'STALE_DATA',
          '\u067e\u0631\u0648\u0646\u062f\u0647 \u062a\u0648\u0633\u0637 \u06a9\u0627\u0631\u0628\u0631 \u062f\u06cc\u06af\u0631\u06cc \u062a\u063a\u06cc\u06cc\u0631 \u06a9\u0631\u062f\u0647 \u0627\u0633\u062a\u061b \u0635\u0641\u062d\u0647 \u0631\u0627 \u062a\u0627\u0632\u0647\u200c\u0633\u0627\u0632\u06cc \u06a9\u0646\u06cc\u062f.',
        );
      }
      if (!allowedTransitions[order.status].includes(input.status)) {
        throw new AppError(
          422,
          'INVALID_SERVICE_TRANSITION',
          '\u062a\u063a\u06cc\u06cc\u0631 \u0648\u0636\u0639\u06cc\u062a \u062f\u0631\u062e\u0648\u0627\u0633\u062a\u200c\u0634\u062f\u0647 \u0628\u0627 \u0631\u0648\u0646\u062f \u062e\u062f\u0645\u0627\u062a \u0633\u0627\u0632\u06af\u0627\u0631 \u0646\u06cc\u0633\u062a.',
          {from: order.status, to: input.status},
        );
      }
      if (
        input.status === 'repairing' &&
        !['not_required', 'approved'].includes(order.estimate_status)
      ) {
        throw new AppError(
          409,
          'ESTIMATE_NOT_APPROVED',
          '\u067e\u06cc\u0634 \u0627\u0632 \u0634\u0631\u0648\u0639 \u062a\u0639\u0645\u06cc\u0631\u060c \u0628\u0631\u0622\u0648\u0631\u062f \u0647\u0632\u06cc\u0646\u0647 \u0628\u0627\u06cc\u062f \u062a\u0623\u06cc\u06cc\u062f \u0634\u0648\u062f.',
        );
      }
      if (input.status === 'cancelled') {
        const installed = await client.query(
          `
            SELECT 1 FROM service_parts
            WHERE service_order_id = $1 AND usage_type = 'installed' AND is_reversed = false
            LIMIT 1
          `,
          [id],
        );
        if (installed.rowCount) {
          throw new AppError(
            409,
            'SERVICE_HAS_INSTALLED_PARTS',
            '\u067e\u0633 \u0627\u0632 \u0645\u0635\u0631\u0641 \u0642\u0637\u0639\u0647\u060c \u0644\u063a\u0648 \u0645\u0633\u062a\u0642\u06cc\u0645 \u067e\u0631\u0648\u0646\u062f\u0647 \u0645\u062c\u0627\u0632 \u0646\u06cc\u0633\u062a \u0648 \u0628\u0627\u06cc\u062f \u0639\u0645\u0644\u06cc\u0627\u062a \u0627\u0635\u0644\u0627\u062d\u06cc \u0627\u0646\u062c\u0627\u0645 \u0634\u0648\u062f.',
          );
        }
      }
      const updated = await client.query(
        `
          UPDATE service_orders
          SET status = $2, row_version = row_version + 1
          WHERE id = $1 AND row_version = $3
        `,
        [id, input.status, input.rowVersion],
      );
      if (!updated.rowCount) {
        throw new AppError(409, 'STALE_DATA', '\u067e\u0631\u0648\u0646\u062f\u0647 \u0647\u0645\u200c\u0632\u0645\u0627\u0646 \u062a\u063a\u06cc\u06cc\u0631 \u06a9\u0631\u062f\u0647 \u0627\u0633\u062a.');
      }
      if (input.status === 'cancelled') {
        const replacement = await client.query(
          'SELECT 1 FROM service_replacements WHERE service_order_id = $1 AND company_id = $2',
          [id, actor.companyId],
        );
        if (replacement.rowCount) {
          throw new AppError(409, 'SERVICE_HAS_REPLACEMENT', 'پرونده دارای تعویض دستگاه را نمی‌توان مستقیماً لغو کرد.');
        }
        await client.query(
          `
            UPDATE serial_numbers
            SET status = 'sold', row_version = row_version + 1
            WHERE id = $1 AND status = 'in_service'
          `,
          [order.serial_id],
        );
      }
      await insertEvent(client, {
        serviceOrderId: id,
        eventType: 'status_changed',
        fromStatus: order.status,
        toStatus: input.status,
        description: input.description,
        createdBy: actor.id,
      });
      await writeAudit(client, request, {
        action: 'service.status_change',
        entityType: 'service_order',
        entityId: id,
        before: {status: order.status},
        after: {status: input.status},
      });
    });
    response.status(204).end();
  }),
);

serviceRouter.post(
  '/orders/:id/parts',
  requirePermissions(PERMISSIONS.SERVICE_REPAIR),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    const input = z
      .discriminatedUnion('usageType', [
        z.object({
          usageType: z.literal('installed'),
          productId: identifierSchema,
          warehouseId: identifierSchema,
          quantity: positiveQuantitySchema,
          serialId: identifierSchema.nullable().default(null),
          isChargeable: z.boolean().default(false),
          unitPriceIrr: nonNegativeIrrSchema,
        }),
        z.object({
          usageType: z.literal('removed'),
          productId: identifierSchema,
          quantity: positiveQuantitySchema,
          removedDisposition: z.enum([
            'returned_customer',
            'supplier_warranty',
            'repaired_reused',
            'scrapped',
          ]),
        }),
      ])
      .parse(request.body);
    const partId = await withTransaction(async (client) => {
      const orderResult = await client.query<{
        status: ServiceStatus;
        warranty_decision: string;
      }>(
        `
          SELECT status, warranty_decision
          FROM service_orders
          WHERE id = $1 AND company_id = $2
          FOR UPDATE
        `,
        [id, actor.companyId],
      );
      const order = orderResult.rows[0];
      if (!order) {
        throw new AppError(404, 'SERVICE_ORDER_NOT_FOUND', '\u067e\u0631\u0648\u0646\u062f\u0647 \u062e\u062f\u0645\u0627\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
      }
      if (!['diagnosis', 'waiting_part', 'repairing'].includes(order.status)) {
        throw new AppError(
          409,
          'SERVICE_PART_NOT_ALLOWED',
          '\u062f\u0631 \u0648\u0636\u0639\u06cc\u062a \u0641\u0639\u0644\u06cc \u067e\u0631\u0648\u0646\u062f\u0647 \u0627\u0645\u06a9\u0627\u0646 \u062b\u0628\u062a \u0642\u0637\u0639\u0647 \u0648\u062c\u0648\u062f \u0646\u062f\u0627\u0631\u062f.',
        );
      }
      if (
        order.warranty_decision === 'in_warranty' &&
        input.usageType === 'installed' &&
        input.isChargeable
      ) {
        throw new AppError(
          422,
          'WARRANTY_PART_CANNOT_BE_CHARGED',
          '\u0642\u0637\u0639\u0647 \u0645\u0635\u0631\u0641\u06cc \u062a\u0639\u0645\u06cc\u0631 \u062a\u062d\u062a \u06af\u0627\u0631\u0627\u0646\u062a\u06cc \u0646\u0628\u0627\u06cc\u062f \u0627\u0632 \u0645\u0634\u062a\u0631\u06cc \u062f\u0631\u06cc\u0627\u0641\u062a \u0634\u0648\u062f.',
        );
      }

      let movementId: string | null = null;
      let warehouseId: string | null = null;
      let unitCostIrr = '0';
      if (input.usageType === 'installed') {
        warehouseId = input.warehouseId;
        const productResult = await client.query<{tracking_type: string}>(
          `
            SELECT tracking_type
            FROM products
            WHERE id = $1 AND company_id = $2 AND is_active = true
          `,
          [input.productId, actor.companyId],
        );
        const product = productResult.rows[0];
        if (!product) {
          throw new AppError(422, 'INVALID_SERVICE_PART', 'قطعه انتخاب‌شده معتبر نیست.');
        }
        if (product.tracking_type === 'serial') {
          if (!new Decimal(input.quantity).equals(1) || !input.serialId) {
            throw new AppError(422, 'SERVICE_PART_SERIAL_REQUIRED', 'برای قطعه سریالی باید دقیقاً یک شماره سریال موجود انتخاب شود.');
          }
          const serialResult = await client.query(
            `
              SELECT 1
              FROM serial_numbers
              WHERE id = $1
                AND company_id = $2
                AND product_id = $3
                AND warehouse_id = $4
                AND status = 'in_stock'
              FOR UPDATE
            `,
            [input.serialId, actor.companyId, input.productId, input.warehouseId],
          );
          if (!serialResult.rowCount) {
            throw new AppError(409, 'SERVICE_PART_SERIAL_NOT_AVAILABLE', 'شماره سریال قطعه در این انبار موجود یا قابل مصرف نیست.');
          }
        } else if (input.serialId) {
          throw new AppError(422, 'SERVICE_PART_SERIAL_NOT_ALLOWED', 'برای قطعه غیرسریالی نباید شماره سریال ثبت شود.');
        }
        const movement = await applyInventoryMovement(client, {
          companyId: actor.companyId,
          warehouseId: input.warehouseId,
          productId: input.productId,
          serialId: input.serialId,
          movementType: 'service_issue',
          quantityDelta: new Decimal(input.quantity).negated(),
          incomingUnitCost: 0,
          sourceType: 'service_order',
          sourceId: id,
          userId: actor.id,
        });
        movementId = movement.id;
        unitCostIrr = new Decimal(movement.unitCostIrr)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
          .toFixed(0);
        if (input.serialId) {
          await client.query(
            `
              UPDATE serial_numbers
              SET status = 'in_service', warehouse_id = NULL, row_version = row_version + 1
              WHERE id = $1
            `,
            [input.serialId],
          );
        }
      }
      const result = await client.query<{id: string}>(
        `
          INSERT INTO service_parts (
            service_order_id,
            product_id,
            warehouse_id,
            quantity,
            usage_type,
            is_chargeable,
            unit_price_irr,
            unit_cost_irr,
            removed_disposition,
            inventory_movement_id,
            serial_id,
            recorded_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id
        `,
        [
          id,
          input.productId,
          warehouseId,
          input.quantity,
          input.usageType,
          input.usageType === 'installed' ? input.isChargeable : false,
          input.usageType === 'installed' ? input.unitPriceIrr : '0',
          unitCostIrr,
          input.usageType === 'removed' ? input.removedDisposition : null,
          movementId,
          input.usageType === 'installed' ? input.serialId : null,
          actor.id,
        ],
      );
      const createdId = result.rows[0]?.id;
      if (!createdId) throw new Error('Service part was not created');
      await insertEvent(client, {
        serviceOrderId: id,
        eventType: 'part_recorded',
        description:
          input.usageType === 'installed'
            ? '\u0642\u0637\u0639\u0647 \u0645\u0635\u0631\u0641\u06cc \u062a\u0639\u0645\u06cc\u0631 \u0627\u0632 \u0627\u0646\u0628\u0627\u0631 \u06a9\u0633\u0631 \u0634\u062f.'
            : '\u0642\u0637\u0639\u0647 \u0628\u0627\u0632\u0634\u062f\u0647 \u0627\u0632 \u062f\u0633\u062a\u06af\u0627\u0647 \u062b\u0628\u062a \u0634\u062f.',
        metadata: {partId: createdId, ...input},
        createdBy: actor.id,
      });
      await writeAudit(client, request, {
        action: 'service.part_record',
        entityType: 'service_part',
        entityId: createdId,
        after: input,
      });
      return createdId;
    });
    response.status(201).json({data: {id: partId}});
  }),
);

serviceRouter.post(
  '/orders/:id/parts/:partId/reverse',
  requirePermissions(PERMISSIONS.SERVICE_REPAIR),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    const partId = identifierSchema.parse(request.params.partId);
    const input = z
      .object({
        returnWarehouseId: identifierSchema,
        reason: z.string().trim().min(3).max(2000),
      })
      .parse(request.body);
    const created = await withTransaction(async (client) => {
      const partResult = await client.query<{
        usage_type: 'installed' | 'removed';
        is_reversed: boolean;
        product_id: string;
        serial_id: string | null;
        quantity: string;
        unit_cost_irr: string;
        inventory_movement_id: string | null;
        order_status: ServiceStatus;
      }>(
        `
          SELECT
            part.usage_type,
            part.is_reversed,
            part.product_id,
            part.serial_id,
            part.quantity::text,
            part.unit_cost_irr::text,
            part.inventory_movement_id,
            service.status AS order_status
          FROM service_parts part
          JOIN service_orders service ON service.id = part.service_order_id
          WHERE part.id = $1
            AND part.service_order_id = $2
            AND service.company_id = $3
          FOR UPDATE OF part, service
        `,
        [partId, id, actor.companyId],
      );
      const part = partResult.rows[0];
      if (!part) throw new AppError(404, 'SERVICE_PART_NOT_FOUND', 'قطعه ثبت‌شده پیدا نشد.');
      if (!activeStatuses.includes(part.order_status) || part.order_status === 'ready_delivery') {
        throw new AppError(409, 'SERVICE_ORDER_FINALIZED', 'اصلاح قطعه پرونده نهایی‌شده مجاز نیست.');
      }
      if (part.usage_type !== 'installed' || !part.inventory_movement_id) {
        throw new AppError(422, 'SERVICE_PART_NOT_REVERSIBLE', 'فقط قطعه مصرف‌شده از انبار قابل برگشت است.');
      }
      if (part.is_reversed) {
        throw new AppError(409, 'SERVICE_PART_ALREADY_REVERSED', 'این قطعه قبلاً برگشت داده شده است.');
      }
      const warehouse = await client.query(
        `
          SELECT 1 FROM warehouses
          WHERE id = $1 AND company_id = $2 AND is_active = true
        `,
        [input.returnWarehouseId, actor.companyId],
      );
      if (!warehouse.rowCount) {
        throw new AppError(422, 'INVALID_RETURN_WAREHOUSE', 'انبار برگشت معتبر نیست.');
      }
      const movement = await applyInventoryMovement(client, {
        companyId: actor.companyId,
        warehouseId: input.returnWarehouseId,
        productId: part.product_id,
        serialId: part.serial_id,
        movementType: 'service_return',
        quantityDelta: part.quantity,
        incomingUnitCost: part.unit_cost_irr,
        sourceType: 'service_part_reversal',
        sourceId: id,
        sourceLineId: partId,
        reason: input.reason,
        reversalOfId: part.inventory_movement_id,
        userId: actor.id,
      });
      if (part.serial_id) {
        const serial = await client.query(
          `
            UPDATE serial_numbers
            SET
              status = 'in_stock',
              warehouse_id = $3,
              row_version = row_version + 1
            WHERE id = $1 AND company_id = $2 AND status = 'in_service'
          `,
          [part.serial_id, actor.companyId, input.returnWarehouseId],
        );
        if (!serial.rowCount) {
          throw new AppError(409, 'SERVICE_PART_SERIAL_STATE_CHANGED', 'وضعیت سریال قطعه برای برگشت معتبر نیست.');
        }
      }
      const reversal = await client.query<{id: string}>(
        `
          INSERT INTO service_part_reversals (
            company_id, service_part_id, return_warehouse_id,
            inventory_movement_id, reason, reversed_by
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `,
        [actor.companyId, partId, input.returnWarehouseId, movement.id, input.reason, actor.id],
      );
      const reversalId = reversal.rows[0]?.id;
      if (!reversalId) throw new Error('Service part reversal was not created');
      await client.query(
        `UPDATE service_parts SET is_reversed = true WHERE id = $1`,
        [partId],
      );
      await client.query(
        `UPDATE service_orders SET row_version = row_version + 1 WHERE id = $1`,
        [id],
      );
      await insertEvent(client, {
        serviceOrderId: id,
        eventType: 'part_reversed',
        description: input.reason,
        metadata: {partId, reversalId, inventoryMovementId: movement.id},
        createdBy: actor.id,
      });
      await writeAudit(client, request, {
        action: 'service.part.reverse',
        entityType: 'service_part_reversal',
        entityId: reversalId,
        before: {partId, isReversed: false},
        after: {returnWarehouseId: input.returnWarehouseId, reason: input.reason},
      });
      return {id: reversalId};
    });
    response.status(201).json({data: created});
  }),
);

serviceRouter.get(
  '/orders/:id/replacement-serials',
  requirePermissions(PERMISSIONS.SERVICE_REPAIR),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    const input = z.object({warehouseId: identifierSchema}).parse(request.query);
    const result = await query(
      `
        SELECT candidate.id, candidate.serial_number AS "serialNumber"
        FROM service_orders service
        JOIN serial_numbers current_serial ON current_serial.id = service.serial_id
        JOIN serial_numbers candidate
          ON candidate.company_id = service.company_id
          AND candidate.product_id = current_serial.product_id
          AND candidate.warehouse_id = $3
          AND candidate.status = 'in_stock'
        JOIN warehouses warehouse
          ON warehouse.id = candidate.warehouse_id
          AND warehouse.company_id = service.company_id
          AND warehouse.is_active = true
        WHERE service.id = $1 AND service.company_id = $2
        ORDER BY candidate.serial_number
        LIMIT 200
      `,
      [id, actor.companyId, input.warehouseId],
    );
    response.json({data: result.rows});
  }),
);

serviceRouter.post(
  '/orders/:id/replacement',
  requirePermissions(PERMISSIONS.SERVICE_REPAIR),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    const input = z
      .object({
        newSerialId: identifierSchema,
        warehouseId: identifierSchema,
        oldSerialDisposition: z.enum(['returned', 'scrapped']),
        reason: z.string().trim().min(3).max(3000),
        rowVersion: z.number().int().positive(),
      })
      .parse(request.body);
    const created = await withTransaction(async (client) => {
      const orderResult = await client.query<{
        status: ServiceStatus;
        row_version: number;
        serial_id: string;
        product_id: string;
        warranty_id: string | null;
        service_warranty_id: string | null;
        coverage_source: 'sale_warranty' | 'service_warranty' | 'none';
        coverage_starts_on: string | null;
        coverage_ends_on: string | null;
      }>(
        `
          SELECT
            service.status,
            service.row_version,
            service.serial_id,
            serial.product_id,
            service.warranty_id,
            service.service_warranty_id,
            service.coverage_source,
            service.coverage_starts_on,
            service.coverage_ends_on
          FROM service_orders service
          JOIN serial_numbers serial ON serial.id = service.serial_id
          WHERE service.id = $1 AND service.company_id = $2
          FOR UPDATE OF service, serial
        `,
        [id, actor.companyId],
      );
      const order = orderResult.rows[0];
      if (!order) throw new AppError(404, 'SERVICE_ORDER_NOT_FOUND', 'پرونده خدمات پیدا نشد.');
      if (!['diagnosis', 'waiting_part', 'repairing', 'final_test'].includes(order.status)) {
        throw new AppError(409, 'SERVICE_REPLACEMENT_NOT_ALLOWED', 'تعویض دستگاه در مرحله فعلی پرونده مجاز نیست.');
      }
      if (order.row_version !== input.rowVersion) {
        throw new AppError(409, 'STALE_DATA', 'پرونده توسط کاربر دیگری تغییر کرده است.');
      }
      const existingReplacement = await client.query(
        `SELECT 1 FROM service_replacements WHERE service_order_id = $1`,
        [id],
      );
      if (existingReplacement.rowCount) {
        throw new AppError(409, 'SERVICE_ALREADY_REPLACED', 'برای این پرونده قبلاً تعویض دستگاه ثبت شده است.');
      }
      const newSerialResult = await client.query<{serial_number: string}>(
        `
          SELECT serial.serial_number
          FROM serial_numbers serial
          JOIN warehouses warehouse ON warehouse.id = serial.warehouse_id
          WHERE serial.id = $1
            AND serial.company_id = $2
            AND serial.product_id = $3
            AND serial.warehouse_id = $4
            AND serial.status = 'in_stock'
            AND warehouse.company_id = $2
            AND warehouse.is_active = true
          FOR UPDATE OF serial
        `,
        [input.newSerialId, actor.companyId, order.product_id, input.warehouseId],
      );
      const newSerial = newSerialResult.rows[0];
      if (!newSerial) {
        throw new AppError(409, 'REPLACEMENT_SERIAL_NOT_AVAILABLE', 'سریال جایگزینِ موجود از همان محصول پیدا نشد.');
      }
      const movement = await applyInventoryMovement(client, {
        companyId: actor.companyId,
        warehouseId: input.warehouseId,
        productId: order.product_id,
        serialId: input.newSerialId,
        movementType: 'service_issue',
        quantityDelta: -1,
        incomingUnitCost: 0,
        sourceType: 'service_replacement',
        sourceId: id,
        reason: input.reason,
        userId: actor.id,
      });
      const unitCostIrr = new Decimal(movement.unitCostIrr)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
        .toFixed(0);

      let newWarrantyId: string | null = null;
      if (order.coverage_source === 'sale_warranty' && order.warranty_id) {
        const warrantyResult = await client.query<{
          sale_invoice_id: string;
          sale_line_id: string;
          customer_id: string;
          policy_version_id: string | null;
          starts_on: string;
          ends_on: string;
          original_duration_months: number;
        }>(
          `
            SELECT
              sale_invoice_id, sale_line_id, customer_id, policy_version_id,
              starts_on, ends_on, original_duration_months
            FROM warranties
            WHERE id = $1 AND company_id = $2
            FOR UPDATE
          `,
          [order.warranty_id, actor.companyId],
        );
        const warranty = warrantyResult.rows[0];
        if (!warranty) throw new AppError(409, 'SERVICE_WARRANTY_SOURCE_MISSING', 'گارانتی فروش مبنای تعویض پیدا نشد.');
        await client.query(
          `UPDATE warranties SET status = 'transferred' WHERE id = $1`,
          [order.warranty_id],
        );
        const newWarranty = await client.query<{id: string}>(
          `
            INSERT INTO warranties (
              company_id, serial_id, sale_invoice_id, sale_line_id, customer_id,
              policy_version_id, starts_on, ends_on, original_duration_months,
              status, transferred_from_id
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9,
              CASE WHEN $8::date >= current_date THEN 'active' ELSE 'expired' END,
              $10
            )
            RETURNING id
          `,
          [
            actor.companyId,
            input.newSerialId,
            warranty.sale_invoice_id,
            warranty.sale_line_id,
            warranty.customer_id,
            warranty.policy_version_id,
            warranty.starts_on,
            warranty.ends_on,
            warranty.original_duration_months,
            order.warranty_id,
          ],
        );
        newWarrantyId = newWarranty.rows[0]?.id ?? null;
        if (!newWarrantyId) throw new Error('Transferred warranty was not created');
      }
      if (order.coverage_source === 'service_warranty' && order.service_warranty_id) {
        const transferred = await client.query(
          `
            UPDATE service_warranties
            SET serial_id = $3
            WHERE id = $1 AND company_id = $2 AND status = 'active'
          `,
          [order.service_warranty_id, actor.companyId, input.newSerialId],
        );
        if (!transferred.rowCount) {
          throw new AppError(409, 'SERVICE_WARRANTY_SOURCE_MISSING', 'گارانتی خدمات مبنای تعویض پیدا نشد.');
        }
      }
      // Preserve the immutable original invoice serial; replacement ownership is resolved separately.
      const saleLink = await client.query(
        'SELECT 1 FROM service_serial_sales WHERE serial_id = $1',
        [order.serial_id],
      );
      if (!saleLink.rowCount) {
        throw new AppError(409, 'SERVICE_SALE_LINK_MISSING', 'پیوند فروش سریال قبلی پیدا نشد.');
      }
      const oldSerialStatus = input.oldSerialDisposition === 'scrapped' ? 'scrapped' : 'returned';
      await client.query(
        `
          UPDATE serial_numbers
          SET status = $3, warehouse_id = NULL, row_version = row_version + 1
          WHERE id = $1 AND company_id = $2 AND status = 'in_service'
        `,
        [order.serial_id, actor.companyId, oldSerialStatus],
      );
      await client.query(
        `
          UPDATE serial_numbers
          SET status = 'in_service', warehouse_id = NULL, sold_on = current_date,
            row_version = row_version + 1
          WHERE id = $1 AND company_id = $2 AND status = 'in_stock'
        `,
        [input.newSerialId, actor.companyId],
      );
      const replacement = await client.query<{id: string}>(
        `
          INSERT INTO service_replacements (
            company_id, service_order_id, old_serial_id, new_serial_id,
            source_warehouse_id, inventory_movement_id, unit_cost_irr,
            old_warranty_id, new_warranty_id, coverage_ends_on,
            old_serial_disposition, reason, replaced_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id
        `,
        [
          actor.companyId,
          id,
          order.serial_id,
          input.newSerialId,
          input.warehouseId,
          movement.id,
          unitCostIrr,
          order.warranty_id,
          newWarrantyId,
          order.coverage_ends_on,
          input.oldSerialDisposition,
          input.reason,
          actor.id,
        ],
      );
      const replacementId = replacement.rows[0]?.id;
      if (!replacementId) throw new Error('Service replacement was not created');
      const updated = await client.query<{row_version: number}>(
        `
          UPDATE service_orders
          SET serial_id = $3,
            warranty_id = $4,
            row_version = row_version + 1
          WHERE id = $1 AND company_id = $2 AND row_version = $5
          RETURNING row_version
        `,
        [id, actor.companyId, input.newSerialId, newWarrantyId ?? order.warranty_id, input.rowVersion],
      );
      const newVersion = updated.rows[0]?.row_version;
      if (!newVersion) throw new AppError(409, 'STALE_DATA', 'پرونده هم‌زمان تغییر کرده است.');
      await insertEvent(client, {
        serviceOrderId: id,
        eventType: 'device_replaced',
        description: input.reason,
        metadata: {
          replacementId,
          oldSerialId: order.serial_id,
          newSerialId: input.newSerialId,
          newSerialNumber: newSerial.serial_number,
          coverageEndsOn: order.coverage_ends_on,
          inventoryMovementId: movement.id,
          unitCostIrr,
        },
        createdBy: actor.id,
      });
      await writeAudit(client, request, {
        action: 'service.device.replace',
        entityType: 'service_replacement',
        entityId: replacementId,
        before: {serialId: order.serial_id, warrantyId: order.warranty_id},
        after: {
          serialId: input.newSerialId,
          warrantyId: newWarrantyId,
          oldSerialDisposition: input.oldSerialDisposition,
        },
      });
      return {id: replacementId, rowVersion: newVersion};
    });
    response.status(201).json({data: created});
  }),
);

serviceRouter.post(
  '/orders/:id/finalize',
  requirePermissions(PERMISSIONS.SERVICE_REPAIR),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    const input = z
      .object({
        finalCostIrr: nonNegativeIrrSchema,
        description: z.string().trim().min(3).max(3000),
      })
      .parse(request.body);
    await withTransaction(async (client) => {
      const result = await client.query<{
        status: ServiceStatus;
        warranty_decision: string;
        branch_id: string;
        customer_id: string;
        tracking_code: string;
        customer_mobile: string | null;
        final_cost_irr: string;
      }>(
        `
          SELECT
            service.status,
            service.warranty_decision,
            service.branch_id,
            service.customer_id,
            service.tracking_code,
            party.mobile AS customer_mobile,
            service.final_cost_irr::text
          FROM service_orders service
          JOIN parties party ON party.id = service.customer_id
          WHERE service.id = $1 AND service.company_id = $2
          FOR UPDATE OF service
        `,
        [id, actor.companyId],
      );
      const order = result.rows[0];
      if (!order) {
        throw new AppError(404, 'SERVICE_ORDER_NOT_FOUND', '\u067e\u0631\u0648\u0646\u062f\u0647 \u062e\u062f\u0645\u0627\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
      }
      if (order.status !== 'final_test') {
        throw new AppError(
          409,
          'FINAL_TEST_REQUIRED',
          '\u0646\u0647\u0627\u06cc\u06cc\u200c\u0633\u0627\u0632\u06cc \u0641\u0642\u0637 \u067e\u0633 \u0627\u0632 \u0648\u0631\u0648\u062f \u067e\u0631\u0648\u0646\u062f\u0647 \u0628\u0647 \u0645\u0631\u062d\u0644\u0647 \u0622\u0632\u0645\u0648\u0646 \u0646\u0647\u0627\u06cc\u06cc \u0645\u062c\u0627\u0632 \u0627\u0633\u062a.',
        );
      }
      if (order.warranty_decision === 'in_warranty' && input.finalCostIrr !== '0') {
        throw new AppError(
          422,
          'WARRANTY_SERVICE_CANNOT_BE_CHARGED',
          '\u0647\u0632\u06cc\u0646\u0647 \u0646\u0647\u0627\u06cc\u06cc \u062a\u0639\u0645\u06cc\u0631 \u062a\u062d\u062a \u06af\u0627\u0631\u0627\u0646\u062a\u06cc \u0628\u0627\u06cc\u062f \u0635\u0641\u0631 \u0628\u0627\u0634\u062f.',
        );
      }
      const passedFinalTest = await client.query(
        `SELECT result_status FROM service_inspections
         WHERE service_order_id = $1
           AND company_id = $2
           AND inspection_type = 'final_test'
           AND created_at > COALESCE((SELECT max(created_at) FROM service_events
             WHERE service_order_id = $1 AND (event_type IN ('part_recorded', 'part_reversed', 'device_replaced')
               OR (event_type = 'status_changed' AND to_status = 'repairing'))), '-infinity'::timestamptz)
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [id, actor.companyId],
      );
      if (passedFinalTest.rows[0]?.result_status !== 'passed') {
        throw new AppError(409, 'PASSED_FINAL_TEST_REQUIRED', 'پیش از نهایی‌سازی باید نتیجه آزمون نهایی «موفق» ثبت شود.');
      }
      const chargeableParts = await client.query<{total: string}>(
        `
          SELECT COALESCE(
            sum(quantity * unit_price_irr) FILTER (
              WHERE usage_type = 'installed'
                AND is_chargeable = true
                AND is_reversed = false
            ),
            0
          )::text AS total
          FROM service_parts
          WHERE service_order_id = $1
        `,
        [id],
      );
      const minimum = new Decimal(chargeableParts.rows[0]?.total ?? 0)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      if (new Decimal(input.finalCostIrr).lessThan(minimum)) {
        throw new AppError(
          422,
          'FINAL_COST_BELOW_PARTS',
          '\u0647\u0632\u06cc\u0646\u0647 \u0646\u0647\u0627\u06cc\u06cc \u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u062f \u0627\u0632 \u0645\u0628\u0644\u063a \u0642\u0637\u0639\u0627\u062a \u0642\u0627\u0628\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u06a9\u0645\u062a\u0631 \u0628\u0627\u0634\u062f.',
          {minimumFinalCostIrr: minimum.toFixed(0)},
        );
      }

      const inventoryCostResult = await client.query<{total: string}>(
        `
          SELECT (
            COALESCE(
              sum(quantity * unit_cost_irr) FILTER (
                WHERE usage_type = 'installed' AND is_reversed = false
              ),
              0
            )
            + COALESCE(
              (SELECT replacement.unit_cost_irr
               FROM service_replacements replacement
               WHERE replacement.service_order_id = $1),
              0
            )
          )::text AS total
          FROM service_parts
          WHERE service_order_id = $1
        `,
        [id],
      );
      const inventoryCostIrr = new Decimal(
        inventoryCostResult.rows[0]?.total ?? 0,
      )
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
        .toFixed(0);
      const hasRevenue = BigInt(input.finalCostIrr) > 0n;
      const hasInventoryCost = BigInt(inventoryCostIrr) > 0n;
      let journalId: string | null = null;
      if (hasRevenue || hasInventoryCost) {
        const existing = await client.query(
          `
            SELECT 1 FROM journal_entries
            WHERE company_id = $1
              AND source_type = 'service_order'
              AND source_id = $2
              AND status <> 'reversed'
          `,
          [actor.companyId, id],
        );
        if (existing.rowCount) {
          throw new AppError(
            409,
            'SERVICE_ALREADY_ACCOUNTED',
            '\u0633\u0646\u062f \u0645\u0627\u0644\u06cc \u0627\u06cc\u0646 \u067e\u0631\u0648\u0646\u062f\u0647 \u0642\u0628\u0644\u0627\u064b \u062b\u0628\u062a \u0634\u062f\u0647 \u0627\u0633\u062a.',
          );
        }
        const accountKeys: string[] = [];
        if (hasRevenue) {
          accountKeys.push('accounts_receivable', 'service_revenue');
        }
        if (hasInventoryCost) {
          accountKeys.push('service_parts_cost', 'inventory');
        }
        const accounts = await systemAccountIds(
          client,
          actor.companyId,
          accountKeys,
        );
        const lines: JournalLineInput[] = [];
        if (hasRevenue) {
          lines.push({
            accountId: accounts.get('accounts_receivable') as string,
            partyId: order.customer_id,
            debitIrr: input.finalCostIrr,
            creditIrr: '0',
          });
          lines.push({
            accountId: accounts.get('service_revenue') as string,
            debitIrr: '0',
            creditIrr: input.finalCostIrr,
          });
        }
        if (hasInventoryCost) {
          lines.push({
            accountId: accounts.get('service_parts_cost') as string,
            debitIrr: inventoryCostIrr,
            creditIrr: '0',
          });
          lines.push({
            accountId: accounts.get('inventory') as string,
            debitIrr: '0',
            creditIrr: inventoryCostIrr,
          });
        }
        const journal = await createJournalEntry(client, {
          companyId: actor.companyId,
          branchId: order.branch_id,
          entryDate: new Date().toISOString().slice(0, 10),
          description: `\u062f\u0631\u0622\u0645\u062f \u062e\u062f\u0645\u0627\u062a \u067e\u0631\u0648\u0646\u062f\u0647 ${id}`,
          sourceType: 'service_order',
          sourceId: id,
          createdBy: actor.id,
          lines,
          post: true,
        });
        journalId = journal.id;
      }
      await client.query(
        `
          UPDATE service_orders
          SET
            final_cost_irr = $2,
            status = 'ready_delivery',
            row_version = row_version + 1
          WHERE id = $1
        `,
        [id, input.finalCostIrr],
      );
      const smsId = await queueSmsIfEnabled(client, {
        companyId: actor.companyId,
        recipient: order.customer_mobile,
        messageText: `پرونده ${order.tracking_code} آماده تحویل است. لطفاً برای هماهنگی تحویل با واحد خدمات تماس بگیرید.`,
        messageType: 'service_ready_delivery',
        relatedEntityType: 'service_order',
        relatedEntityId: id,
      });
      await insertEvent(client, {
        serviceOrderId: id,
        eventType: 'finalized',
        fromStatus: 'final_test',
        toStatus: 'ready_delivery',
        description: input.description,
        metadata: {
          finalCostIrr: input.finalCostIrr,
          inventoryCostIrr,
          journalId,
          smsQueued: smsId !== null,
        },
        createdBy: actor.id,
      });
      await writeAudit(client, request, {
        action: 'service.finalize',
        entityType: 'service_order',
        entityId: id,
        after: {finalCostIrr: input.finalCostIrr, inventoryCostIrr, journalId},
      });
    });
    response.status(204).end();
  }),
);

serviceRouter.post(
  '/orders/:id/deliver',
  requirePermissions(PERMISSIONS.SERVICE_DELIVER),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const id = identifierSchema.parse(request.params.id);
    const input = z
      .object({
        serviceWarrantyMonths: z.union([z.literal(1), z.literal(3)]),
        warrantyDescription: z.string().trim().max(2000).nullable().default(null),
        deliveryNote: z.string().trim().min(2).max(2000),
        deliveredToName: z.string().trim().min(2).max(180).nullable().default(null),
        deliveredToMobile: z.string().trim().max(30).nullable().default(null),
        deliveryConfirmation: z.string().trim().max(2000).nullable().default(null),
      })
      .parse(request.body);
    await withTransaction(async (client) => {
      const result = await client.query<{
        status: ServiceStatus;
        final_cost_irr: string;
        paid_irr: string;
        serial_id: string;
        tracking_code: string;
        customer_name: string;
        customer_mobile: string | null;
      }>(
        `
          SELECT
            status,
            final_cost_irr::text,
            paid_irr::text,
            service.serial_id,
            service.tracking_code,
            party.display_name AS customer_name,
            party.mobile AS customer_mobile
          FROM service_orders service
          JOIN parties party ON party.id = service.customer_id
          WHERE service.id = $1 AND service.company_id = $2
          FOR UPDATE OF service
        `,
        [id, actor.companyId],
      );
      const order = result.rows[0];
      if (!order) {
        throw new AppError(404, 'SERVICE_ORDER_NOT_FOUND', '\u067e\u0631\u0648\u0646\u062f\u0647 \u062e\u062f\u0645\u0627\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
      }
      if (order.status !== 'ready_delivery') {
        throw new AppError(
          409,
          'SERVICE_NOT_READY',
          '\u067e\u0631\u0648\u0646\u062f\u0647 \u0647\u0646\u0648\u0632 \u0622\u0645\u0627\u062f\u0647 \u062a\u062d\u0648\u06cc\u0644 \u0646\u06cc\u0633\u062a.',
        );
      }
      if (BigInt(order.paid_irr) < BigInt(order.final_cost_irr)) {
        throw new AppError(
          409,
          'SERVICE_BALANCE_DUE',
          '\u067e\u06cc\u0634 \u0627\u0632 \u062a\u062d\u0648\u06cc\u0644 \u0628\u0627\u06cc\u062f \u0645\u0627\u0646\u062f\u0647 \u0647\u0632\u06cc\u0646\u0647 \u062e\u062f\u0645\u0627\u062a \u062a\u0633\u0648\u06cc\u0647 \u0634\u0648\u062f.',
          {
            finalCostIrr: order.final_cost_irr,
            paidIrr: order.paid_irr,
          },
        );
      }
      await client.query(
        `
          INSERT INTO service_warranties (
            company_id,
            service_order_id,
            serial_id,
            duration_months,
            starts_on,
            ends_on,
            description
          )
          VALUES (
            $1, $2, $3, $4, current_date,
            (current_date + make_interval(months => $4))::date,
            $5
          )
        `,
        [
          actor.companyId,
          id,
          order.serial_id,
          input.serviceWarrantyMonths,
          input.warrantyDescription,
        ],
      );
      await client.query(
        `
          UPDATE service_orders
          SET
            status = 'delivered',
            delivered_at = now(),
            delivered_by = $2,
            delivered_to_name = $3,
            delivered_to_mobile = $4,
            delivery_confirmation = $5,
            row_version = row_version + 1
          WHERE id = $1
        `,
        [
          id,
          actor.id,
          input.deliveredToName ?? order.customer_name,
          input.deliveredToMobile ?? order.customer_mobile,
          input.deliveryConfirmation ?? input.deliveryNote,
        ],
      );
      await client.query(
        `
          UPDATE serial_numbers
          SET status = 'sold', row_version = row_version + 1
          WHERE id = $1 AND status = 'in_service'
        `,
        [order.serial_id],
      );
      const smsId = await queueSmsIfEnabled(client, {
        companyId: actor.companyId,
        recipient: order.customer_mobile,
        messageText: `دستگاه پرونده ${order.tracking_code} تحویل شد. گارانتی خدمات ${input.serviceWarrantyMonths} ماهه از امروز فعال است.`,
        messageType: 'service_delivered',
        relatedEntityType: 'service_order',
        relatedEntityId: id,
      });
      await insertEvent(client, {
        serviceOrderId: id,
        eventType: 'delivered',
        fromStatus: 'ready_delivery',
        toStatus: 'delivered',
        description: input.deliveryNote,
        metadata: {
          serviceWarrantyMonths: input.serviceWarrantyMonths,
          deliveredToName: input.deliveredToName ?? order.customer_name,
          deliveredToMobile: input.deliveredToMobile ?? order.customer_mobile,
          deliveryConfirmation: input.deliveryConfirmation ?? input.deliveryNote,
          smsQueued: smsId !== null,
        },
        createdBy: actor.id,
      });
      await writeAudit(client, request, {
        action: 'service.deliver',
        entityType: 'service_order',
        entityId: id,
        after: {
          serviceWarrantyMonths: input.serviceWarrantyMonths,
          deliveredToName: input.deliveredToName ?? order.customer_name,
          deliveredToMobile: input.deliveredToMobile ?? order.customer_mobile,
          deliveryConfirmation: input.deliveryConfirmation ?? input.deliveryNote,
        },
      });
    });
    response.status(204).end();
  }),
);
