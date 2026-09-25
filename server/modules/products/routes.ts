import {Router} from 'express';
import {z} from 'zod';
import {PERMISSIONS} from '../../../shared/permissions.js';
import {currentUser} from '../../common/auth-context.js';
import {AppError, asyncRoute} from '../../common/errors.js';
import {
  activeFilter,
  listQuerySchema,
} from '../../common/pagination.js';
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

const productSchema = z.object({
  name: z.string().trim().min(2).max(200),
  productType: z.enum([
    'purchased',
    'component',
    'manufactured',
    'semi_finished',
    'consumable',
    'service',
  ]),
  trackingType: z.enum(['none', 'serial', 'batch']),
  baseUnitId: identifierSchema,
  barcode: z.string().trim().max(120).nullable().default(null),
  description: z.string().trim().max(2000).nullable().default(null),
  minimumStock: z.string().default('0'),
  defaultSalePriceIrr: nonNegativeIrrSchema.default('0'),
  defaultPurchasePriceIrr: nonNegativeIrrSchema.default('0'),
  taxRate: z.number().min(0).max(100).default(0),
  isSellable: z.boolean().default(true),
  isPurchasable: z.boolean().default(true),
  isProducible: z.boolean().default(false),
});

const productUpdateSchema = productSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
    rowVersion: z.number().int().positive(),
  });

async function nextAutomaticProductCode(
  client: Parameters<Parameters<typeof withTransaction>[0]>[0],
  companyId: string,
): Promise<string> {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `products:${companyId}`,
  ]);
  const result = await client.query<{next_number: number}>(
    `
      SELECT (
        COALESCE(MAX((substring(code FROM '^IT-([0-9]+)$'))::integer), 0) + 1
      )::integer AS next_number
      FROM products
      WHERE company_id = $1
    `,
    [companyId],
  );
  const number = result.rows[0]?.next_number ?? 1;
  return `IT-${String(number).padStart(4, '0')}`;
}

function productHasUsageSql(productId: string): string {
  return `EXISTS (
    SELECT 1 FROM inventory_balances WHERE product_id = ${productId}
    UNION ALL SELECT 1 FROM inventory_batches WHERE product_id = ${productId}
    UNION ALL SELECT 1 FROM serial_numbers WHERE product_id = ${productId}
    UNION ALL SELECT 1 FROM inventory_movements WHERE product_id = ${productId}
    UNION ALL SELECT 1 FROM stock_reservations WHERE product_id = ${productId}
    UNION ALL SELECT 1 FROM stock_transfer_lines WHERE product_id = ${productId}
    UNION ALL SELECT 1 FROM purchase_invoice_lines WHERE product_id = ${productId}
    UNION ALL SELECT 1 FROM sale_invoice_lines WHERE product_id = ${productId}
    UNION ALL SELECT 1 FROM warranty_policy_versions WHERE product_id = ${productId}
    UNION ALL SELECT 1 FROM boms WHERE product_id = ${productId}
    UNION ALL SELECT 1 FROM bom_components WHERE component_product_id = ${productId}
    UNION ALL SELECT 1 FROM production_orders WHERE product_id = ${productId}
    UNION ALL SELECT 1 FROM production_materials WHERE product_id = ${productId}
    UNION ALL SELECT 1 FROM production_outputs WHERE product_id = ${productId}
    UNION ALL SELECT 1 FROM production_waste WHERE product_id = ${productId}
    UNION ALL SELECT 1 FROM subcontract_order_lines WHERE product_id = ${productId}
    UNION ALL SELECT 1 FROM service_parts WHERE product_id = ${productId}
  )`;
}

const warrantyPolicySchema = z.object({
  effectiveFrom: isoDateSchema,
  durationMonths: z.number().int().min(0).max(120),
  reason: z.string().trim().min(2).max(1000),
});

export const productsRouter = Router();
productsRouter.use(requireAuthentication);

productsRouter.get(
  '/units',
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const result = await query(
      `
        SELECT
          id,
          code,
          name,
          decimal_places AS "decimalPlaces",
          is_active AS "isActive"
        FROM units
        WHERE company_id = $1
        ORDER BY name
      `,
      [user.companyId],
    );
    response.json({data: result.rows});
  }),
);

productsRouter.get(
  '/',
  requirePermissions(PERMISSIONS.INVENTORY_VIEW),
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const input = listQuerySchema.parse(request.query);
    const active = activeFilter(input.active);
    const result = await query(
      `
        SELECT
          product.id,
          product.code,
          product.name,
          product.product_type AS "productType",
          product.tracking_type AS "trackingType",
          product.base_unit_id AS "baseUnitId",
          unit.name AS "unitName",
          product.barcode,
          product.description,
          product.minimum_stock::text AS "minimumStock",
          product.default_sale_price_irr::text AS "defaultSalePriceIrr",
          product.default_purchase_price_irr::text AS "defaultPurchasePriceIrr",
          product.tax_rate::text AS "taxRate",
          product.is_sellable AS "isSellable",
          product.is_purchasable AS "isPurchasable",
          product.is_producible AS "isProducible",
          product.is_active AS "isActive",
          NOT ${productHasUsageSql('product.id')} AS "canDelete",
          product.row_version AS "rowVersion"
        FROM products product
        JOIN units unit ON unit.id = product.base_unit_id
        WHERE product.company_id = $1
          AND (
            $2 = ''
            OR product.code ILIKE '%' || $2 || '%'
            OR product.name ILIKE '%' || $2 || '%'
            OR COALESCE(product.barcode, '') ILIKE '%' || $2 || '%'
          )
          AND ($3::boolean IS NULL OR product.is_active = $3)
        ORDER BY product.name
        LIMIT $4 OFFSET $5
      `,
      [user.companyId, input.q, active, input.limit, input.offset],
    );
    response.json({data: result.rows});
  }),
);

productsRouter.post(
  '/',
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const input = productSchema.parse(request.body);
    const row = await withTransaction(async (client) => {
      const code = await nextAutomaticProductCode(client, user.companyId);
      const result = await client.query(
      `
        INSERT INTO products (
          company_id,
          code,
          name,
          product_type,
          tracking_type,
          base_unit_id,
          barcode,
          description,
          minimum_stock,
          default_sale_price_irr,
          default_purchase_price_irr,
          tax_rate,
          is_sellable,
          is_purchasable,
          is_producible
        )
        SELECT
          $1, $2, $3, $4, $5, unit.id, $7, $8, $9,
          $10, $11, $12, $13, $14, $15
        FROM units unit
        WHERE unit.id = $6
          AND unit.company_id = $1
          AND unit.is_active = true
        RETURNING
          id,
          code,
          name,
          product_type AS "productType",
          tracking_type AS "trackingType",
          row_version AS "rowVersion"
      `,
      [
        user.companyId,
        code,
        input.name,
        input.productType,
        input.trackingType,
        input.baseUnitId,
        input.barcode,
        input.description,
        input.minimumStock,
        input.defaultSalePriceIrr,
        input.defaultPurchasePriceIrr,
        input.taxRate,
        input.isSellable,
        input.isPurchasable,
        input.isProducible,
        ],
      );
      const created = result.rows[0];
      if (!created) {
        throw new AppError(
          422,
          'INVALID_UNIT',
          'واحد اندازه‌گیری انتخاب‌شده معتبر نیست.',
        );
      }
      await writeAudit(client, request, {
        action: 'product.create',
        entityType: 'product',
        entityId: created.id as string,
        after: created,
      });
      return created;
    });
    response.status(201).json({data: row});
  }),
);

productsRouter.patch(
  '/:id',
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const productId = identifierSchema.parse(request.params.id);
    const input = productUpdateSchema.parse(request.body);

    const updated = await withTransaction(async (client) => {
      const currentResult = await client.query<{
        tracking_type: string;
        product_type: string;
      }>(
        `
          SELECT tracking_type, product_type
          FROM products
          WHERE id = $1 AND company_id = $2
          FOR UPDATE
        `,
        [productId, user.companyId],
      );
      const current = currentResult.rows[0];
      if (!current) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'کالا پیدا نشد.');
      }

      if (
        (input.trackingType &&
          input.trackingType !== current.tracking_type) ||
        (input.productType &&
          input.productType !== current.product_type)
      ) {
        const usage = await client.query(
          'SELECT 1 FROM inventory_movements WHERE product_id = $1 LIMIT 1',
          [productId],
        );
        if (usage.rowCount) {
          throw new AppError(
            409,
            'PRODUCT_CLASSIFICATION_LOCKED',
            'نوع رهگیری کالای دارای گردش موجودی قابل تغییر نیست.',
          );
        }
      }

      const result = await client.query(
        `
          UPDATE products product
          SET
            name = COALESCE($4, product.name),
            product_type = COALESCE($5, product.product_type),
            tracking_type = COALESCE($6, product.tracking_type),
            base_unit_id = COALESCE($7, product.base_unit_id),
            barcode = CASE WHEN $8::boolean THEN $9 ELSE product.barcode END,
            description = CASE WHEN $10::boolean THEN $11 ELSE product.description END,
            minimum_stock = COALESCE($12, product.minimum_stock),
            default_sale_price_irr = COALESCE($13, product.default_sale_price_irr),
            default_purchase_price_irr = COALESCE($14, product.default_purchase_price_irr),
            tax_rate = COALESCE($15, product.tax_rate),
            is_sellable = COALESCE($16, product.is_sellable),
            is_purchasable = COALESCE($17, product.is_purchasable),
            is_producible = COALESCE($18, product.is_producible),
            is_active = COALESCE($19, product.is_active),
            row_version = product.row_version + 1
          WHERE product.id = $1
            AND product.company_id = $2
            AND product.row_version = $3
            AND (
              $7::uuid IS NULL
              OR EXISTS (
                SELECT 1
                FROM units unit
                WHERE unit.id = $7
                  AND unit.company_id = $2
                  AND unit.is_active = true
              )
            )
          RETURNING
            id,
            code,
            name,
            product_type AS "productType",
            tracking_type AS "trackingType",
            is_active AS "isActive",
            row_version AS "rowVersion"
        `,
        [
          productId,
          user.companyId,
          input.rowVersion,
          input.name ?? null,
          input.productType ?? null,
          input.trackingType ?? null,
          input.baseUnitId ?? null,
          Object.hasOwn(input, 'barcode'),
          input.barcode ?? null,
          Object.hasOwn(input, 'description'),
          input.description ?? null,
          input.minimumStock ?? null,
          input.defaultSalePriceIrr ?? null,
          input.defaultPurchasePriceIrr ?? null,
          input.taxRate ?? null,
          input.isSellable ?? null,
          input.isPurchasable ?? null,
          input.isProducible ?? null,
          input.isActive ?? null,
        ],
      );
      const row = result.rows[0];
      if (!row) {
        throw new AppError(
          409,
          'CONCURRENT_UPDATE',
          'کالای دارای سابقه عملیاتی فقط می‌تواند غیرفعال شود.',
        );
      }
      return row;
    });
    response.json({data: updated});
  }),
);

productsRouter.delete(
  '/:id',
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const productId = identifierSchema.parse(request.params.id);
    await withTransaction(async (client) => {
      const beforeResult = await client.query(
        `
          SELECT *
          FROM products
          WHERE id = $1 AND company_id = $2
          FOR UPDATE
        `,
        [productId, user.companyId],
      );
      const before = beforeResult.rows[0];
      if (!before) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'کالا پیدا نشد.');
      }
      const usage = await client.query<{has_usage: boolean}>(
        `SELECT ${productHasUsageSql('$1')} AS has_usage`,
        [productId],
      );
      if (usage.rows[0]?.has_usage) {
        throw new AppError(
          409,
          'PRODUCT_DELETE_LOCKED',
          'این قلم سابقه عملیاتی دارد و فقط قابل غیرفعال‌سازی است.',
        );
      }
      await client.query(
        'DELETE FROM products WHERE id = $1 AND company_id = $2',
        [productId, user.companyId],
      );
      await writeAudit(client, request, {
        action: 'product.delete',
        entityType: 'product',
        entityId: productId,
        before,
        after: {deleted: true},
      });
    });
    response.status(204).end();
  }),
);

productsRouter.get(
  '/:id/warranty-policies',
  requirePermissions(PERMISSIONS.SALES_VIEW),
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const productId = identifierSchema.parse(request.params.id);
    const result = await query(
      `
        SELECT
          policy.id,
          policy.version_number AS "versionNumber",
          policy.effective_from::text AS "effectiveFrom",
          policy.effective_to::text AS "effectiveTo",
          policy.duration_months AS "durationMonths",
          policy.is_active AS "isActive",
          policy.reason,
          policy.created_at AS "createdAt"
        FROM warranty_policy_versions policy
        WHERE policy.company_id = $1 AND policy.product_id = $2
        ORDER BY policy.version_number DESC
      `,
      [user.companyId, productId],
    );
    response.json({data: result.rows});
  }),
);

productsRouter.post(
  '/:id/warranty-policies',
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const productId = identifierSchema.parse(request.params.id);
    const input = warrantyPolicySchema.parse(request.body);

    const created = await withTransaction(async (client) => {
      const product = await client.query(
        `
          SELECT 1
          FROM products
          WHERE id = $1 AND company_id = $2 AND is_active = true
          FOR UPDATE
        `,
        [productId, user.companyId],
      );
      if (!product.rowCount) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'کالا پیدا نشد.');
      }

      const overlap = await client.query(
        `
          SELECT 1
          FROM warranty_policy_versions
          WHERE product_id = $1
            AND is_active = true
            AND effective_from >= $2::date
          LIMIT 1
        `,
        [productId, input.effectiveFrom],
      );
      if (overlap.rowCount) {
        throw new AppError(
          409,
          'WARRANTY_POLICY_DATE_CONFLICT',
          'تاریخ شروع نسخه جدید باید بعد از نسخه قبلی باشد.',
        );
      }

      await client.query(
        `
          UPDATE warranty_policy_versions
          SET effective_to = $2::date - interval '1 day'
          WHERE product_id = $1
            AND is_active = true
            AND effective_to IS NULL
        `,
        [productId, input.effectiveFrom],
      );

      const result = await client.query(
        `
          INSERT INTO warranty_policy_versions (
            company_id,
            product_id,
            version_number,
            effective_from,
            duration_months,
            reason,
            created_by
          )
          SELECT
            $1,
            $2,
            COALESCE(max(version_number), 0) + 1,
            $3,
            $4,
            $5,
            $6
          FROM warranty_policy_versions
          WHERE product_id = $2
          RETURNING
            id,
            version_number AS "versionNumber",
            effective_from::text AS "effectiveFrom",
            duration_months AS "durationMonths",
            reason
        `,
        [
          user.companyId,
          productId,
          input.effectiveFrom,
          input.durationMonths,
          input.reason,
          user.id,
        ],
      );
      const row = result.rows[0];
      await writeAudit(client, request, {
        action: 'warranty_policy.create',
        entityType: 'warranty_policy',
        entityId: (row?.id as string | undefined) ?? null,
        after: row,
      });
      return row;
    });

    response.status(201).json({data: created});
  }),
);
