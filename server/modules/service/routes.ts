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
  final_test: ['repairing', 'ready_delivery'],
  ready_delivery: ['delivered'],
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
    const [branches, warehouses, products, balances] = await Promise.all([
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
    ]);
    response.json({
      data: {
        branches: branches.rows,
        warehouses: warehouses.rows,
        products: products.rows,
        balances: balances.rows,
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
          CASE
            WHEN warranty.ends_on IS NULL THEN 0
            ELSE GREATEST(warranty.ends_on - current_date, 0)
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
            WHEN warranty.status = 'active'
              AND current_date BETWEEN warranty.starts_on AND warranty.ends_on
            THEN true
            ELSE false
          END AS "isInWarranty"
        FROM serial_numbers serial
        JOIN products product ON product.id = serial.product_id
        JOIN sale_invoice_serials sold_serial ON sold_serial.serial_id = serial.id
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
            AND candidate.status <> 'voided'
          ORDER BY candidate.created_at DESC
          LIMIT 1
        ) warranty ON true
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
        status: serviceStatusSchema.optional(),
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
          service.estimate_status AS "estimateStatus",
          service.final_cost_irr::text AS "finalCostIrr",
          service.paid_irr::text AS "paidIrr",
          service.row_version AS "rowVersion",
          serial.serial_number AS "serialNumber",
          product.name AS "productName",
          party.display_name AS "customerName",
          party.mobile AS "customerMobile"
        FROM service_orders service
        JOIN serial_numbers serial ON serial.id = service.serial_id
        JOIN products product ON product.id = serial.product_id
        JOIN parties party ON party.id = service.customer_id
        WHERE service.company_id = $1
          AND ($2::text IS NULL OR service.status = $2)
          AND (
            $3::text IS NULL
            OR serial.serial_number ILIKE '%' || $3 || '%'
            OR service.tracking_code ILIKE '%' || $3 || '%'
            OR party.display_name ILIKE '%' || $3 || '%'
          )
        ORDER BY
          CASE WHEN service.status = ANY($4::text[]) THEN 0 ELSE 1 END,
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
        customer_id: string;
        customer_mobile: string | null;
        warranty_id: string | null;
        is_in_warranty: boolean;
      }>(
        `
          SELECT
            serial.id AS serial_id,
            serial.status AS serial_status,
            sale.customer_id,
            customer.mobile AS customer_mobile,
            warranty.id AS warranty_id,
            CASE
              WHEN warranty.status = 'active'
                AND current_date BETWEEN warranty.starts_on AND warranty.ends_on
              THEN true
              ELSE false
            END AS is_in_warranty
          FROM serial_numbers serial
          JOIN sale_invoice_serials sold_serial ON sold_serial.serial_id = serial.id
          JOIN sale_invoice_lines sale_line ON sale_line.id = sold_serial.invoice_line_id
          JOIN sale_invoices sale
            ON sale.id = sale_line.invoice_id
            AND sale.status = 'posted'
          JOIN parties customer ON customer.id = sale.customer_id
          LEFT JOIN LATERAL (
            SELECT candidate.*
            FROM warranties candidate
            WHERE candidate.serial_id = serial.id
              AND candidate.status <> 'voided'
            ORDER BY candidate.created_at DESC
            LIMIT 1
          ) warranty ON true
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
      const branch = await client.query(
        `
          SELECT 1 FROM branches
          WHERE id = $1 AND company_id = $2 AND is_active = true
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
      const orderResult = await client.query<{id: string}>(
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
            received_by,
            complaint,
            intake_condition,
            received_accessories,
            warranty_decision,
            estimate_status
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
            $13, $14
          )
          RETURNING id
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
        metadata: {warrantyDecision: serial.is_in_warranty ? 'in_warranty' : 'out_of_warranty'},
        createdBy: actor.id,
      });
      await queueSmsIfEnabled(client, {
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
          service.intake_condition AS "intakeCondition",
          service.received_accessories AS "receivedAccessories",
          service.status,
          service.warranty_decision AS "warrantyDecision",
          service.warranty_rejection_reason AS "warrantyRejectionReason",
          service.warranty_rejection_evidence AS "warrantyRejectionEvidence",
          service.estimated_cost_irr::text AS "estimatedCostIrr",
          service.estimate_status AS "estimateStatus",
          service.final_cost_irr::text AS "finalCostIrr",
          service.paid_irr::text AS "paidIrr",
          service.delivered_at AS "deliveredAt",
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
        LEFT JOIN warranties warranty ON warranty.id = service.warranty_id
        WHERE service.id = $1 AND service.company_id = $2
      `,
      [id, actor.companyId],
    );
    const order = orderResult.rows[0];
    if (!order) {
      throw new AppError(404, 'SERVICE_ORDER_NOT_FOUND', '\u067e\u0631\u0648\u0646\u062f\u0647 \u062e\u062f\u0645\u0627\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
    }
    const [events, parts, warranty, attachments] = await Promise.all([
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
    ]);
    response.json({
      data: {
        ...order,
        events: events.rows,
        parts: parts.rows,
        serviceWarranty: warranty.rows[0] ?? null,
        attachments: attachments.rows,
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
        warranty_valid: boolean;
      }>(
        `
          SELECT
            service.status,
            service.warranty_id,
            CASE
              WHEN warranty.status = 'active'
                AND current_date BETWEEN warranty.starts_on AND warranty.ends_on
              THEN true
              ELSE false
            END AS warranty_valid
          FROM service_orders service
          LEFT JOIN warranties warranty ON warranty.id = service.warranty_id
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
        metadata: {decision: input.decision, reason, evidence},
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
      }>(
        `
          SELECT status, warranty_decision
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
      await insertEvent(client, {
        serviceOrderId: id,
        eventType: 'estimate',
        description: input.note,
        metadata: {
          estimatedCostIrr: input.estimatedCostIrr,
          status: input.status,
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
            WHERE service_order_id = $1 AND usage_type = 'installed'
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
            removed_disposition,
            inventory_movement_id,
            serial_id,
            recorded_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        final_cost_irr: string;
      }>(
        `
          SELECT
            status,
            warranty_decision,
            branch_id,
            customer_id,
            final_cost_irr::text
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
      const chargeableParts = await client.query<{total: string}>(
        `
          SELECT COALESCE(
            sum(quantity * unit_price_irr) FILTER (
              WHERE usage_type = 'installed' AND is_chargeable = true
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

      let journalId: string | null = null;
      if (input.finalCostIrr !== '0') {
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
        const accounts = await systemAccountIds(client, actor.companyId, [
          'accounts_receivable',
          'service_revenue',
        ]);
        const lines: JournalLineInput[] = [
          {
            accountId: accounts.get('accounts_receivable') as string,
            partyId: order.customer_id,
            debitIrr: input.finalCostIrr,
            creditIrr: '0',
          },
          {
            accountId: accounts.get('service_revenue') as string,
            debitIrr: '0',
            creditIrr: input.finalCostIrr,
          },
        ];
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
      await insertEvent(client, {
        serviceOrderId: id,
        eventType: 'finalized',
        fromStatus: 'final_test',
        toStatus: 'ready_delivery',
        description: input.description,
        metadata: {finalCostIrr: input.finalCostIrr, journalId},
        createdBy: actor.id,
      });
      await writeAudit(client, request, {
        action: 'service.finalize',
        entityType: 'service_order',
        entityId: id,
        after: {finalCostIrr: input.finalCostIrr, journalId},
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
      })
      .parse(request.body);
    await withTransaction(async (client) => {
      const result = await client.query<{
        status: ServiceStatus;
        final_cost_irr: string;
        paid_irr: string;
        serial_id: string;
      }>(
        `
          SELECT
            status,
            final_cost_irr::text,
            paid_irr::text,
            serial_id
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
            row_version = row_version + 1
          WHERE id = $1
        `,
        [id, actor.id],
      );
      await client.query(
        `
          UPDATE serial_numbers
          SET status = 'sold', row_version = row_version + 1
          WHERE id = $1 AND status = 'in_service'
        `,
        [order.serial_id],
      );
      await insertEvent(client, {
        serviceOrderId: id,
        eventType: 'delivered',
        fromStatus: 'ready_delivery',
        toStatus: 'delivered',
        description: input.deliveryNote,
        metadata: {serviceWarrantyMonths: input.serviceWarrantyMonths},
        createdBy: actor.id,
      });
      await writeAudit(client, request, {
        action: 'service.deliver',
        entityType: 'service_order',
        entityId: id,
        after: {serviceWarrantyMonths: input.serviceWarrantyMonths},
      });
    });
    response.status(204).end();
  }),
);
