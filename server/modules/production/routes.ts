import Decimal from 'decimal.js';
import {Router} from 'express';
import type {PoolClient, QueryResultRow} from 'pg';
import {z} from 'zod';
import {PERMISSIONS} from '../../../shared/permissions.js';
import {currentUser} from '../../common/auth-context.js';
import {AppError, asyncRoute} from '../../common/errors.js';
import {
  identifierSchema,
  nonNegativeIrrSchema,
  positiveQuantitySchema,
} from '../../common/values.js';
import {query, withTransaction} from '../../db/pool.js';
import {nextSequence} from '../../infrastructure/sequences.js';
import {writeAudit} from '../../infrastructure/audit.js';
import {
  requireAuthentication,
  requirePermissions,
} from '../auth/middleware.js';
import {
  createJournalEntry,
  systemAccountIds,
  type JournalLineInput,
} from '../accounting/journal.service.js';
import {applyInventoryMovement} from '../inventory/inventory.service.js';
import {productionReadRouter} from './production-read.routes.js';
import {reserveProductionMaterials} from './production-reservation.service.js';

const nonNegativeQuantitySchema = z.string().refine((value) => {
  try {
    return new Decimal(value).isFinite() && !new Decimal(value).isNegative();
  } catch {
    return false;
  }
}, 'مقدار نمی‌تواند منفی باشد.');

const componentSchema = z.object({
  productId: identifierSchema,
  quantity: positiveQuantitySchema,
  wastePercent: z.number().min(0).max(100).default(0),
  stageCode: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-zA-Z0-9_-]+$/),
  issueWarehouseId: identifierSchema.nullable().default(null),
  notes: z.string().trim().max(1000).nullable().default(null),
});

const versionSchema = z
  .object({
    outputQuantity: positiveQuantitySchema.default('1'),
    effectiveFrom: z.string().date().nullable().default(null),
    notes: z.string().trim().max(2000).nullable().default(null),
    components: z.array(componentSchema).min(1).max(500),
  })
  .refine(
    (value) =>
      new Set(value.components.map((item) => item.productId)).size ===
      value.components.length,
    {
      path: ['components'],
      message: '\u06cc\u06a9 \u0642\u0637\u0639\u0647 \u062f\u0631 \u0641\u0631\u0645\u0648\u0644 \u0633\u0627\u062e\u062a \u0646\u0628\u0627\u06cc\u062f \u062f\u0648\u0628\u0627\u0631 \u062b\u0628\u062a \u0634\u0648\u062f.',
    },
  );

export const productionRouter = Router();
productionRouter.use(
  requireAuthentication,
  requirePermissions(PERMISSIONS.PRODUCTION_VIEW),
);
productionRouter.use(productionReadRouter);

productionRouter.get(
  '/boms',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const result = await query(
      `
        SELECT
          bom.id,
          bom.code,
          bom.name,
          bom.product_id AS "productId",
          product.code AS "productCode",
          product.name AS "productName",
          bom.is_active AS "isActive",
          bom.row_version AS "rowVersion",
          version.id AS "activeVersionId",
          version.version_number AS "activeVersionNumber",
          version.output_quantity::text AS "outputQuantity"
        FROM boms bom
        JOIN products product ON product.id = bom.product_id
        LEFT JOIN bom_versions version
          ON version.bom_id = bom.id AND version.status = 'active'
        WHERE bom.company_id = $1
        ORDER BY bom.name
      `,
      [actor.companyId],
    );
    response.json({data: result.rows});
  }),
);

productionRouter.get(
  '/boms/:id',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const bomId = identifierSchema.parse(request.params.id);
    const header = await query(
      `
        SELECT
          bom.id,
          bom.code,
          bom.name,
          bom.product_id AS "productId",
          product.name AS "productName",
          bom.is_active AS "isActive",
          bom.row_version AS "rowVersion"
        FROM boms bom
        JOIN products product ON product.id = bom.product_id
        WHERE bom.id = $1 AND bom.company_id = $2
      `,
      [bomId, actor.companyId],
    );
    if (!header.rows[0]) {
      throw new AppError(404, 'BOM_NOT_FOUND', '\u0641\u0631\u0645\u0648\u0644 \u0633\u0627\u062e\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
    }
    const versions = await query(
      `
        SELECT
          id,
          version_number AS "versionNumber",
          status,
          output_quantity::text AS "outputQuantity",
          effective_from::text AS "effectiveFrom",
          notes,
          row_version AS "rowVersion"
        FROM bom_versions
        WHERE bom_id = $1
        ORDER BY version_number DESC
      `,
      [bomId],
    );
    const components = await query(
      `
        SELECT
          component.id,
          component.bom_version_id AS "bomVersionId",
          component.component_product_id AS "productId",
          product.code AS "productCode",
          product.name AS "productName",
          unit.name AS "unitName",
          component.quantity::text,
          component.waste_percent::text AS "wastePercent",
          component.stage_code AS "stageCode",
          component.issue_warehouse_id AS "issueWarehouseId",
          component.notes
        FROM bom_components component
        JOIN products product ON product.id = component.component_product_id
        JOIN units unit ON unit.id = product.base_unit_id
        JOIN bom_versions version ON version.id = component.bom_version_id
        WHERE version.bom_id = $1
        ORDER BY version.version_number DESC, product.name
      `,
      [bomId],
    );
    response.json({
      data: {
        ...header.rows[0],
        versions: versions.rows,
        components: components.rows,
      },
    });
  }),
);

productionRouter.post(
  '/boms',
  requirePermissions(PERMISSIONS.PRODUCTION_MANAGE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        code: z.string().trim().min(1).max(60),
        name: z.string().trim().min(2).max(180),
        productId: identifierSchema,
        version: versionSchema,
        activate: z.boolean().default(false),
      })
      .parse(request.body);

    const created = await withTransaction(async (client) => {
      const product = await client.query(
        `
          SELECT 1
          FROM products
          WHERE id = $1
            AND company_id = $2
            AND is_active = true
            AND is_producible = true
            AND product_type IN ('manufactured', 'semi_finished')
          FOR UPDATE
        `,
        [input.productId, actor.companyId],
      );
      if (!product.rowCount) {
        throw new AppError(
          422,
          'INVALID_PRODUCTION_PRODUCT',
          '\u0645\u062d\u0635\u0648\u0644 \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0628\u0631\u0627\u06cc \u062a\u0648\u0644\u06cc\u062f \u0641\u0639\u0627\u0644 \u0646\u06cc\u0633\u062a.',
        );
      }
      if (
        input.version.components.some(
          (component) => component.productId === input.productId,
        )
      ) {
        throw new AppError(
          422,
          'BOM_SELF_REFERENCE',
          '\u0645\u062d\u0635\u0648\u0644 \u0646\u0647\u0627\u06cc\u06cc \u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u062f \u0642\u0637\u0639\u0647 \u062e\u0648\u062f\u0634 \u0628\u0627\u0634\u062f.',
        );
      }

      const bomResult = await client.query<{id: string}>(
        `
          INSERT INTO boms (
            company_id,
            product_id,
            code,
            name
          )
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [actor.companyId, input.productId, input.code, input.name],
      );
      const bomId = bomResult.rows[0]?.id;
      if (!bomId) throw new Error('BOM was not created');
      const versionResult = await client.query<{id: string}>(
        `
          INSERT INTO bom_versions (
            bom_id,
            version_number,
            status,
            output_quantity,
            effective_from,
            notes,
            approved_by,
            approved_at,
            created_by
          )
          VALUES (
            $1,
            1,
            $2,
            $3,
            $4,
            $5,
            CASE WHEN $2 = 'active' THEN $6 ELSE NULL END,
            CASE WHEN $2 = 'active' THEN now() ELSE NULL END,
            $6
          )
          RETURNING id
        `,
        [
          bomId,
          input.activate ? 'active' : 'draft',
          input.version.outputQuantity,
          input.version.effectiveFrom,
          input.version.notes,
          actor.id,
        ],
      );
      const versionId = versionResult.rows[0]?.id;
      if (!versionId) throw new Error('BOM version was not created');
      await insertComponents(
        client,
        actor.companyId,
        versionId,
        input.version.components,
      );
      await writeAudit(client, request, {
        action: 'bom.create',
        entityType: 'bom',
        entityId: bomId,
        after: {versionId, activate: input.activate},
      });
      return {id: bomId, versionId};
    });
    response.status(201).json({data: created});
  }),
);

async function insertComponents(
  client: PoolClient,
  companyId: string,
  versionId: string,
  components: z.infer<typeof componentSchema>[],
): Promise<void> {
  for (const component of components) {
    const result = await client.query(
      `
        INSERT INTO bom_components (
          bom_version_id,
          component_product_id,
          quantity,
          waste_percent,
          stage_code,
          issue_warehouse_id,
          notes
        )
        SELECT $1, product.id, $3, $4, $5, $6, $7
        FROM products product
        LEFT JOIN warehouses warehouse ON warehouse.id = $6
        WHERE product.id = $2
          AND product.company_id = $8
          AND product.is_active = true
          AND product.product_type <> 'service'
          AND (
            $6::uuid IS NULL
            OR (
              warehouse.company_id = $8
              AND warehouse.is_active = true
            )
          )
      `,
      [
        versionId,
        component.productId,
        component.quantity,
        component.wastePercent,
        component.stageCode,
        component.issueWarehouseId,
        component.notes,
        companyId,
      ],
    );
    if (!result.rowCount) {
      throw new AppError(
        422,
        'INVALID_BOM_COMPONENT',
        '\u06cc\u06a9\u06cc \u0627\u0632 \u0642\u0637\u0639\u0627\u062a \u0641\u0631\u0645\u0648\u0644 \u0633\u0627\u062e\u062a \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.',
      );
    }
  }
}

productionRouter.post(
  '/boms/:id/versions',
  requirePermissions(PERMISSIONS.PRODUCTION_MANAGE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const bomId = identifierSchema.parse(request.params.id);
    const input = versionSchema.parse(request.body);
    const created = await withTransaction(async (client) => {
      const bomResult = await client.query<{product_id: string}>(
        `
          SELECT product_id
          FROM boms
          WHERE id = $1 AND company_id = $2 AND is_active = true
          FOR UPDATE
        `,
        [bomId, actor.companyId],
      );
      const bom = bomResult.rows[0];
      if (!bom) {
        throw new AppError(404, 'BOM_NOT_FOUND', '\u0641\u0631\u0645\u0648\u0644 \u0633\u0627\u062e\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
      }
      if (
        input.components.some(
          (component) => component.productId === bom.product_id,
        )
      ) {
        throw new AppError(
          422,
          'BOM_SELF_REFERENCE',
          '\u0645\u062d\u0635\u0648\u0644 \u0646\u0647\u0627\u06cc\u06cc \u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u062f \u0642\u0637\u0639\u0647 \u062e\u0648\u062f\u0634 \u0628\u0627\u0634\u062f.',
        );
      }
      const result = await client.query<{id: string; version_number: number}>(
        `
          INSERT INTO bom_versions (
            bom_id,
            version_number,
            output_quantity,
            effective_from,
            notes,
            created_by
          )
          SELECT
            $1,
            COALESCE(max(version_number), 0) + 1,
            $2,
            $3,
            $4,
            $5
          FROM bom_versions
          WHERE bom_id = $1
          RETURNING id, version_number
        `,
        [
          bomId,
          input.outputQuantity,
          input.effectiveFrom,
          input.notes,
          actor.id,
        ],
      );
      const version = result.rows[0];
      if (!version) throw new Error('BOM version was not created');
      await insertComponents(
        client,
        actor.companyId,
        version.id,
        input.components,
      );
      await writeAudit(client, request, {
        action: 'bom.version.create',
        entityType: 'bom_version',
        entityId: version.id,
        after: {bomId, versionNumber: version.version_number},
      });
      return {id: version.id, versionNumber: version.version_number};
    });
    response.status(201).json({data: created});
  }),
);

productionRouter.post(
  '/bom-versions/:id/activate',
  requirePermissions(PERMISSIONS.PRODUCTION_MANAGE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const versionId = identifierSchema.parse(request.params.id);
    await withTransaction(async (client) => {
      const result = await client.query<{bom_id: string}>(
        `
          SELECT version.bom_id
          FROM bom_versions version
          JOIN boms bom ON bom.id = version.bom_id
          WHERE version.id = $1
            AND bom.company_id = $2
            AND version.status = 'draft'
          FOR UPDATE OF version
        `,
        [versionId, actor.companyId],
      );
      const version = result.rows[0];
      if (!version) {
        throw new AppError(
          409,
          'BOM_VERSION_NOT_ACTIVATABLE',
          '\u0646\u0633\u062e\u0647 \u0641\u0631\u0645\u0648\u0644 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f \u06cc\u0627 \u0642\u0628\u0644\u0627\u064b \u062a\u0639\u06cc\u06cc\u0646 \u062a\u06a9\u0644\u06cc\u0641 \u0634\u062f\u0647 \u0627\u0633\u062a.',
        );
      }
      const components = await client.query(
        'SELECT 1 FROM bom_components WHERE bom_version_id = $1 LIMIT 1',
        [versionId],
      );
      if (!components.rowCount) {
        throw new AppError(
          409,
          'BOM_COMPONENTS_REQUIRED',
          '\u0646\u0633\u062e\u0647 \u0628\u062f\u0648\u0646 \u0642\u0637\u0639\u0647 \u0642\u0627\u0628\u0644 \u0641\u0639\u0627\u0644\u200c\u0634\u062f\u0646 \u0646\u06cc\u0633\u062a.',
        );
      }
      await client.query(
        `
          UPDATE bom_versions
          SET
            status = 'retired',
            row_version = row_version + 1
          WHERE bom_id = $1 AND status = 'active'
        `,
        [version.bom_id],
      );
      await client.query(
        `
          UPDATE bom_versions
          SET
            status = 'active',
            approved_by = $2,
            approved_at = now(),
            row_version = row_version + 1
          WHERE id = $1
        `,
        [versionId, actor.id],
      );
      await writeAudit(client, request, {
        action: 'bom.version.activate',
        entityType: 'bom_version',
        entityId: versionId,
        after: {bomId: version.bom_id, status: 'active'},
      });
    });
    response.status(204).end();
  }),
);

async function productionAvailability(
  companyId: string,
  versionId: string,
  warehouseId: string,
  client?: PoolClient,
): Promise<{
  maximumQuantity: string;
  components: unknown[];
}> {
  const executeQuery = async <T extends QueryResultRow>(
    statement: string,
    values: readonly unknown[] = [],
  ) =>
    client
      ? client.query<T>(statement, [...values])
      : query<T>(statement, values);
  const result = await executeQuery<{
    product_id: string;
    product_code: string;
    product_name: string;
    required_per_output: string;
    available_quantity: string;
    maximum_output: string | null;
  }>(
    `
      SELECT
        component.component_product_id AS product_id,
        product.code AS product_code,
        product.name AS product_name,
        (
          component.quantity
          * (1 + component.waste_percent / 100)
          / version.output_quantity
        )::text AS required_per_output,
        COALESCE(balance.quantity - balance.reserved_quantity, 0)::text
          AS available_quantity,
        floor(
          COALESCE(balance.quantity - balance.reserved_quantity, 0)
          / NULLIF(
              component.quantity
              * (1 + component.waste_percent / 100)
              / version.output_quantity,
              0
            )
        )::text AS maximum_output
      FROM bom_components component
      JOIN bom_versions version ON version.id = component.bom_version_id
      JOIN boms bom ON bom.id = version.bom_id
      JOIN products product ON product.id = component.component_product_id
      LEFT JOIN inventory_balances balance
        ON balance.product_id = component.component_product_id
        AND balance.warehouse_id = COALESCE(
          component.issue_warehouse_id,
          $3::uuid
        )
      WHERE version.id = $1
        AND bom.company_id = $2
        AND version.status = 'active'
      ORDER BY product.name
    `,
    [versionId, companyId, warehouseId],
  );
  if (!result.rows.length) {
    throw new AppError(
      404,
      'ACTIVE_BOM_NOT_FOUND',
      '\u0646\u0633\u062e\u0647 \u0641\u0639\u0627\u0644 \u0641\u0631\u0645\u0648\u0644 \u0633\u0627\u062e\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.',
    );
  }
  const maximum = result.rows.reduce(
    (minimum, row) =>
      Decimal.min(
        minimum,
        new Decimal(row.maximum_output ?? 0),
      ),
    new Decimal('1e30'),
  );
  return {
    maximumQuantity: Decimal.max(maximum, 0).toFixed(0),
    components: result.rows.map((row) => ({
      productId: row.product_id,
      productCode: row.product_code,
      productName: row.product_name,
      requiredPerOutput: row.required_per_output,
      availableQuantity: row.available_quantity,
      maximumOutput: row.maximum_output ?? '0',
    })),
  };
}

productionRouter.get(
  '/availability',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        bomVersionId: identifierSchema,
        warehouseId: identifierSchema,
      })
      .parse(request.query);
    response.json({
      data: await productionAvailability(
        actor.companyId,
        input.bomVersionId,
        input.warehouseId,
      ),
    });
  }),
);

productionRouter.get(
  '/orders',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const result = await query(
      `
        SELECT
          production.id,
          production.order_number::text AS "orderNumber",
          production.status,
          production.planned_quantity::text AS "plannedQuantity",
          production.actual_quantity::text AS "actualQuantity",
          production.planned_start_on::text AS "plannedStartOn",
          production.planned_end_on::text AS "plannedEndOn",
          production.started_at AS "startedAt",
          production.completed_at AS "completedAt",
          production.total_cost_irr::text AS "totalCostIrr",
          production.row_version AS "rowVersion",
          product.code AS "productCode",
          product.name AS "productName"
        FROM production_orders production
        JOIN products product ON product.id = production.product_id
        WHERE production.company_id = $1
        ORDER BY production.created_at DESC
        LIMIT 100
      `,
      [actor.companyId],
    );
    response.json({data: result.rows});
  }),
);

productionRouter.post(
  '/orders',
  requirePermissions(PERMISSIONS.PRODUCTION_MANAGE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        branchId: identifierSchema,
        bomVersionId: identifierSchema,
        plannedQuantity: positiveQuantitySchema,
        materialWarehouseId: identifierSchema,
        wipWarehouseId: identifierSchema.nullable().default(null),
        outputWarehouseId: identifierSchema,
        plannedStartOn: z.string().date().nullable().default(null),
        plannedEndOn: z.string().date().nullable().default(null),
        description: z.string().trim().max(2000).nullable().default(null),
        stages: z
          .array(
            z.object({
              code: z.string().trim().min(2).max(60),
              title: z.string().trim().min(2).max(160),
            }),
          )
          .min(1)
          .max(50),
      })
      .parse(request.body);

    if (
      new Set(input.stages.map((stage) => stage.code)).size !==
      input.stages.length
    ) {
      throw new AppError(
        422,
        'DUPLICATE_PRODUCTION_STAGE',
        'کد هر مرحله در یک دستور تولید باید یکتا باشد.',
      );
    }
    if (
      input.plannedStartOn &&
      input.plannedEndOn &&
      input.plannedStartOn > input.plannedEndOn
    ) {
      throw new AppError(
        422,
        'INVALID_PRODUCTION_DATE_RANGE',
        'تاریخ پایان برنامه‌ریزی‌شده نمی‌تواند پیش از تاریخ شروع باشد.',
      );
    }

    const created = await withTransaction(async (client) => {
      const organization = await client.query(
        `
          SELECT 1
          FROM branches branch
          JOIN warehouses material_warehouse
            ON material_warehouse.id = $3
          JOIN warehouses output_warehouse
            ON output_warehouse.id = $4
          WHERE branch.id = $1
            AND branch.company_id = $2
            AND branch.is_active = true
            AND material_warehouse.company_id = $2
            AND material_warehouse.is_active = true
            AND output_warehouse.company_id = $2
            AND output_warehouse.is_active = true
            AND (
              $5::uuid IS NULL
              OR EXISTS (
                SELECT 1
                FROM warehouses wip_warehouse
                WHERE wip_warehouse.id = $5
                  AND wip_warehouse.company_id = $2
                  AND wip_warehouse.is_active = true
              )
            )
        `,
        [
          input.branchId,
          actor.companyId,
          input.materialWarehouseId,
          input.outputWarehouseId,
          input.wipWarehouseId,
        ],
      );
      if (!organization.rowCount) {
        throw new AppError(
          422,
          'INVALID_PRODUCTION_ORGANIZATION',
          'شعبه یا یکی از انبارهای انتخاب‌شده معتبر و فعال نیست.',
        );
      }

      const versionResult = await client.query<{
        product_id: string;
        output_quantity: string;
      }>(
        `
          SELECT bom.product_id, version.output_quantity::text
          FROM bom_versions version
          JOIN boms bom ON bom.id = version.bom_id
          WHERE version.id = $1
            AND bom.company_id = $2
            AND version.status = 'active'
          FOR UPDATE OF version
        `,
        [input.bomVersionId, actor.companyId],
      );
      const version = versionResult.rows[0];
      if (!version) {
        throw new AppError(
          422,
          'ACTIVE_BOM_NOT_FOUND',
          '\u0646\u0633\u062e\u0647 \u0641\u0639\u0627\u0644 \u0641\u0631\u0645\u0648\u0644 \u0633\u0627\u062e\u062a \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.',
        );
      }
      const availability = await productionAvailability(
        actor.companyId,
        input.bomVersionId,
        input.materialWarehouseId,
        client,
      );
      if (
        new Decimal(input.plannedQuantity).greaterThan(
          availability.maximumQuantity,
        )
      ) {
        throw new AppError(
          409,
          'INSUFFICIENT_PRODUCTION_MATERIAL',
          '\u0645\u0648\u062c\u0648\u062f\u06cc \u0642\u0637\u0639\u0627\u062a \u0628\u0631\u0627\u06cc \u0645\u0642\u062f\u0627\u0631 \u0628\u0631\u0646\u0627\u0645\u0647\u200c\u0631\u06cc\u0632\u06cc\u200c\u0634\u062f\u0647 \u06a9\u0627\u0641\u06cc \u0646\u06cc\u0633\u062a.',
          availability,
        );
      }

      const number = await nextSequence(
        client,
        actor.companyId,
        'production_order',
      );
      const orderResult = await client.query<{id: string}>(
        `
          INSERT INTO production_orders (
            company_id,
            branch_id,
            order_number,
            bom_version_id,
            product_id,
            planned_quantity,
            planned_start_on,
            planned_end_on,
            material_warehouse_id,
            wip_warehouse_id,
            output_warehouse_id,
            status,
            description,
            created_by
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, 'planned', $12, $13
          )
          RETURNING id
        `,
        [
          actor.companyId,
          input.branchId,
          number.toString(),
          input.bomVersionId,
          version.product_id,
          input.plannedQuantity,
          input.plannedStartOn,
          input.plannedEndOn,
          input.materialWarehouseId,
          input.wipWarehouseId,
          input.outputWarehouseId,
          input.description,
          actor.id,
        ],
      );
      const orderId = orderResult.rows[0]?.id;
      if (!orderId) throw new Error('Production order was not created');

      await client.query(
        `
          INSERT INTO production_materials (
            production_order_id,
            bom_component_id,
            product_id,
            warehouse_id,
            planned_quantity
          )
          SELECT
            $1,
            component.id,
            component.component_product_id,
            COALESCE(component.issue_warehouse_id, $2),
            (
              component.quantity
              * (1 + component.waste_percent / 100)
              * $3::numeric
              / version.output_quantity
            )
          FROM bom_components component
          JOIN bom_versions version ON version.id = component.bom_version_id
          WHERE component.bom_version_id = $4
        `,
        [
          orderId,
          input.materialWarehouseId,
          input.plannedQuantity,
          input.bomVersionId,
        ],
      );
      for (const [index, stage] of input.stages.entries()) {
        await client.query(
          `
            INSERT INTO production_order_stages (
              production_order_id,
              sequence_number,
              stage_code,
              title
            )
            VALUES ($1, $2, $3, $4)
          `,
          [orderId, index + 1, stage.code, stage.title],
        );
      }
      await writeAudit(client, request, {
        action: 'production.create',
        entityType: 'production_order',
        entityId: orderId,
        after: {
          orderNumber: number.toString(),
          plannedQuantity: input.plannedQuantity,
          bomVersionId: input.bomVersionId,
        },
      });
      return {id: orderId, orderNumber: number.toString()};
    });
    response.status(201).json({data: created});
  }),
);

productionRouter.post(
  '/orders/:id/start',
  requirePermissions(PERMISSIONS.PRODUCTION_MANAGE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const orderId = identifierSchema.parse(request.params.id);
    const result = await query(
      `
        UPDATE production_orders
        SET
          status = 'in_progress',
          started_at = now(),
          row_version = row_version + 1
        WHERE id = $1
          AND company_id = $2
          AND status IN ('planned', 'released')
        RETURNING id, status, row_version AS "rowVersion"
      `,
      [orderId, actor.companyId],
    );
    if (!result.rowCount) {
      throw new AppError(
        409,
        'PRODUCTION_NOT_STARTABLE',
        '\u062f\u0633\u062a\u0648\u0631 \u062a\u0648\u0644\u06cc\u062f \u062f\u0631 \u0648\u0636\u0639\u06cc\u062a \u0642\u0627\u0628\u0644 \u0634\u0631\u0648\u0639 \u0646\u06cc\u0633\u062a.',
      );
    }
    response.json({data: result.rows[0]});
  }),
);

productionRouter.patch(
  '/orders/:id/stages/:stageId',
  requirePermissions(PERMISSIONS.PRODUCTION_MANAGE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const orderId = identifierSchema.parse(request.params.id);
    const stageId = identifierSchema.parse(request.params.stageId);
    const input = z
      .object({
        status: z.enum(['pending', 'in_progress', 'completed', 'skipped']),
        notes: z.string().trim().max(1000).nullable().default(null),
      })
      .parse(request.body);
    const result = await query(
      `
        UPDATE production_order_stages stage
        SET
          status = $4,
          notes = $5,
          assigned_to = COALESCE(stage.assigned_to, $6),
          started_at = CASE
            WHEN $4 = 'in_progress' THEN COALESCE(stage.started_at, now())
            ELSE stage.started_at
          END,
          completed_at = CASE
            WHEN $4 IN ('completed', 'skipped') THEN now()
            ELSE NULL
          END,
          row_version = stage.row_version + 1
        FROM production_orders production
        WHERE stage.id = $1
          AND stage.production_order_id = $2
          AND production.id = stage.production_order_id
          AND production.company_id = $3
          AND production.status = 'in_progress'
        RETURNING stage.id, stage.status
      `,
      [
        stageId,
        orderId,
        actor.companyId,
        input.status,
        input.notes,
        actor.id,
      ],
    );
    if (!result.rowCount) {
      throw new AppError(
        409,
        'STAGE_NOT_EDITABLE',
        '\u0645\u0631\u062d\u0644\u0647 \u062a\u0648\u0644\u06cc\u062f \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f \u06cc\u0627 \u062f\u0633\u062a\u0648\u0631 \u062f\u0631 \u062d\u0627\u0644 \u0627\u062c\u0631\u0627 \u0646\u06cc\u0633\u062a.',
      );
    }
    response.json({data: result.rows[0]});
  }),
);

productionRouter.post(
  '/orders/:id/complete',
  requirePermissions(PERMISSIONS.PRODUCTION_POST),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const orderId = identifierSchema.parse(request.params.id);
    const input = z
      .object({
        actualQuantity: positiveQuantitySchema,
        outputSerialNumbers: z
          .array(z.string().trim().min(1).max(160))
          .default([]),
        directLaborCostIrr: nonNegativeIrrSchema.default('0'),
        subcontractCostIrr: nonNegativeIrrSchema.default('0'),
        overheadCostIrr: nonNegativeIrrSchema.default('0'),
        packagingCostIrr: nonNegativeIrrSchema.default('0'),
        materials: z
          .array(
            z.object({
              productionMaterialId: identifierSchema,
              actualQuantity: positiveQuantitySchema,
              returnedQuantity: nonNegativeQuantitySchema.default('0'),
              serialNumbers: z
                .array(z.string().trim().min(1).max(160))
                .default([]),
            }),
          )
          .min(1),
      })
      .parse(request.body);

    const completed = await withTransaction(async (client) => {
      const orderResult = await client.query<{
        product_id: string;
        branch_id: string;
        output_warehouse_id: string;
        status: string;
        order_number: string;
        tracking_type: string;
      }>(
        `
          SELECT
            production.product_id,
            production.branch_id,
            production.output_warehouse_id,
            production.status,
            production.order_number::text,
            product.tracking_type
          FROM production_orders production
          JOIN products product ON product.id = production.product_id
          WHERE production.id = $1 AND production.company_id = $2
          FOR UPDATE OF production
        `,
        [orderId, actor.companyId],
      );
      const order = orderResult.rows[0];
      if (!order || order.status !== 'in_progress') {
        throw new AppError(
          409,
          'PRODUCTION_NOT_COMPLETABLE',
          '\u062f\u0633\u062a\u0648\u0631 \u062a\u0648\u0644\u06cc\u062f \u062f\u0631 \u0648\u0636\u0639\u06cc\u062a \u0642\u0627\u0628\u0644 \u067e\u0627\u06cc\u0627\u0646 \u0646\u06cc\u0633\u062a.',
        );
      }
      const incompleteStage = await client.query(
        `
          SELECT 1
          FROM production_order_stages
          WHERE production_order_id = $1
            AND status NOT IN ('completed', 'skipped')
          LIMIT 1
        `,
        [orderId],
      );
      if (incompleteStage.rowCount) {
        throw new AppError(
          409,
          'PRODUCTION_STAGES_INCOMPLETE',
          '\u0647\u0645\u0647 \u0645\u0631\u0627\u062d\u0644 \u062a\u0648\u0644\u06cc\u062f \u0628\u0627\u06cc\u062f \u062a\u06a9\u0645\u06cc\u0644 \u06cc\u0627 \u0628\u0627 \u062f\u0644\u06cc\u0644 \u0631\u062f \u0634\u0648\u0646\u062f.',
        );
      }

      const plannedMaterials = await client.query<{
        id: string;
        product_id: string;
        warehouse_id: string;
        planned_quantity: string;
        tracking_type: string;
      }>(
        `
          SELECT
            material.id,
            material.product_id,
            material.warehouse_id,
            material.planned_quantity::text,
            product.tracking_type
          FROM production_materials material
          JOIN products product ON product.id = material.product_id
          WHERE material.production_order_id = $1
          FOR UPDATE OF material
        `,
        [orderId],
      );
      if (
        input.materials.length !== plannedMaterials.rows.length ||
        new Set(input.materials.map((item) => item.productionMaterialId)).size
          !== plannedMaterials.rows.length
      ) {
        throw new AppError(
          422,
          'PRODUCTION_MATERIALS_INCOMPLETE',
          '\u0645\u0635\u0631\u0641 \u0648\u0627\u0642\u0639\u06cc \u062a\u0645\u0627\u0645 \u0645\u0648\u0627\u062f \u062f\u0633\u062a\u0648\u0631 \u062a\u0648\u0644\u06cc\u062f \u0628\u0627\u06cc\u062f \u062b\u0628\u062a \u0634\u0648\u062f.',
        );
      }

      let materialCost = 0n;
      for (const material of plannedMaterials.rows) {
        const actual = input.materials.find(
          (item) => item.productionMaterialId === material.id,
        );
        if (!actual) {
          throw new AppError(
            422,
            'PRODUCTION_MATERIAL_MISSING',
            '\u0645\u0635\u0631\u0641 \u0648\u0627\u0642\u0639\u06cc \u06cc\u06a9\u06cc \u0627\u0632 \u0642\u0637\u0639\u0627\u062a \u062b\u0628\u062a \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.',
          );
        }
        const serialNumbers = [...new Set(actual.serialNumbers)];
        if (
          material.tracking_type === 'serial' &&
          (
            !new Decimal(actual.actualQuantity).isInteger() ||
            new Decimal(actual.actualQuantity).toNumber()
              !== serialNumbers.length
          )
        ) {
          throw new AppError(
            422,
            'SERIAL_COUNT_MISMATCH',
            '\u062a\u0639\u062f\u0627\u062f \u0633\u0631\u06cc\u0627\u0644 \u0642\u0637\u0639\u0627\u062a \u0645\u0635\u0631\u0641\u06cc \u0628\u0627 \u0645\u0642\u062f\u0627\u0631 \u0645\u0635\u0631\u0641 \u0628\u0631\u0627\u0628\u0631 \u0646\u06cc\u0633\u062a.',
          );
        }

        const movement = await applyInventoryMovement(client, {
          companyId: actor.companyId,
          warehouseId: material.warehouse_id,
          productId: material.product_id,
          movementType: 'production_issue',
          quantityDelta: new Decimal(actual.actualQuantity).negated(),
          incomingUnitCost: 0,
          sourceType: 'production_order',
          sourceId: orderId,
          sourceLineId: material.id,
          releaseReservedQuantity: material.planned_quantity,
          userId: actor.id,
        });
        const cost = BigInt(
          new Decimal(movement.valueDeltaIrr)
            .abs()
            .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
            .toFixed(0),
        );
        materialCost += cost;

        if (material.tracking_type === 'serial') {
          const serialResult = await client.query<{id: string}>(
            `
              SELECT id
              FROM serial_numbers
              WHERE company_id = $1
                AND product_id = $2
                AND warehouse_id = $3
                AND serial_number = ANY($4::text[])
                AND status = 'in_stock'
              FOR UPDATE
            `,
            [
              actor.companyId,
              material.product_id,
              material.warehouse_id,
              serialNumbers,
            ],
          );
          if (serialResult.rows.length !== serialNumbers.length) {
            throw new AppError(
              409,
              'SERIAL_NOT_AVAILABLE',
              '\u06cc\u06a9 \u06cc\u0627 \u0686\u0646\u062f \u0633\u0631\u06cc\u0627\u0644 \u0642\u0637\u0639\u0647 \u0645\u0635\u0631\u0641\u06cc \u0645\u0648\u062c\u0648\u062f \u0646\u06cc\u0633\u062a.',
            );
          }
          for (const serial of serialResult.rows) {
            await client.query(
              `
                INSERT INTO production_material_serials (
                  production_material_id,
                  serial_id
                )
                VALUES ($1, $2)
              `,
              [material.id, serial.id],
            );
          }
          await client.query(
            `
              UPDATE serial_numbers
              SET
                status = 'in_production',
                warehouse_id = NULL,
                row_version = row_version + 1
              WHERE id = ANY($1::uuid[])
            `,
            [serialResult.rows.map((row) => row.id)],
          );
        }

        await client.query(
          `
            UPDATE production_materials
            SET
              actual_quantity = $2,
              returned_quantity = $3,
              unit_cost_irr = $4,
              inventory_movement_id = $5
            WHERE id = $1
          `,
          [
            material.id,
            actual.actualQuantity,
            actual.returnedQuantity,
            movement.unitCostIrr,
            movement.id,
          ],
        );
      }

      const outputSerials = [...new Set(input.outputSerialNumbers)];
      if (
        order.tracking_type === 'serial' &&
        (
          !new Decimal(input.actualQuantity).isInteger() ||
          new Decimal(input.actualQuantity).toNumber() !== outputSerials.length
        )
      ) {
        throw new AppError(
          422,
          'OUTPUT_SERIAL_COUNT_MISMATCH',
          '\u0647\u0631 \u0645\u062d\u0635\u0648\u0644 \u0646\u0647\u0627\u06cc\u06cc \u0633\u0631\u06cc\u0627\u0644\u06cc \u0628\u0627\u06cc\u062f \u06cc\u06a9 \u0634\u0645\u0627\u0631\u0647 \u0633\u0631\u06cc\u0627\u0644 \u06cc\u06a9\u062a\u0627 \u062f\u0627\u0634\u062a\u0647 \u0628\u0627\u0634\u062f.',
        );
      }

      const directLabor = BigInt(input.directLaborCostIrr);
      const subcontract = BigInt(input.subcontractCostIrr);
      const overhead = BigInt(input.overheadCostIrr);
      const packaging = BigInt(input.packagingCostIrr);
      const conversionCost =
        directLabor + subcontract + overhead + packaging;
      const totalCost = materialCost + conversionCost;
      if (totalCost <= 0n) {
        throw new AppError(
          422,
          'ZERO_PRODUCTION_COST',
          '\u0647\u0632\u06cc\u0646\u0647 \u0646\u0647\u0627\u06cc\u06cc \u062a\u0648\u0644\u06cc\u062f \u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u062f \u0635\u0641\u0631 \u0628\u0627\u0634\u062f.',
        );
      }
      const unitCost = new Decimal(totalCost.toString()).div(
        input.actualQuantity,
      );
      const outputMovement = await applyInventoryMovement(client, {
        companyId: actor.companyId,
        warehouseId: order.output_warehouse_id,
        productId: order.product_id,
        movementType: 'production_receipt',
        quantityDelta: input.actualQuantity,
        incomingUnitCost: unitCost,
        sourceType: 'production_order',
        sourceId: orderId,
        userId: actor.id,
      });
      const outputResult = await client.query<{id: string}>(
        `
          INSERT INTO production_outputs (
            production_order_id,
            product_id,
            warehouse_id,
            quantity,
            unit_cost_irr,
            inventory_movement_id
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `,
        [
          orderId,
          order.product_id,
          order.output_warehouse_id,
          input.actualQuantity,
          unitCost.toFixed(6),
          outputMovement.id,
        ],
      );
      const outputId = outputResult.rows[0]?.id;
      if (!outputId) throw new Error('Production output was not created');
      for (const serialNumber of outputSerials) {
        const serialResult = await client.query<{id: string}>(
          `
            INSERT INTO serial_numbers (
              company_id,
              product_id,
              serial_number,
              warehouse_id,
              status,
              manufactured_on,
              source_type,
              source_id
            )
            VALUES (
              $1, $2, $3, $4, 'in_stock',
              current_date, 'production_order', $5
            )
            RETURNING id
          `,
          [
            actor.companyId,
            order.product_id,
            serialNumber,
            order.output_warehouse_id,
            orderId,
          ],
        );
        await client.query(
          `
            INSERT INTO production_output_serials (
              production_output_id,
              serial_id
            )
            VALUES ($1, $2)
          `,
          [outputId, serialResult.rows[0]?.id],
        );
      }

      const accounts = await systemAccountIds(client, actor.companyId, [
        'finished_goods',
        'inventory',
        'production_overhead',
      ]);
      const journalLines: JournalLineInput[] = [
        {
          accountId: accounts.get('finished_goods') as string,
          debitIrr: totalCost.toString(),
          creditIrr: '0',
        },
      ];
      if (materialCost > 0n) {
        journalLines.push({
          accountId: accounts.get('inventory') as string,
          debitIrr: '0',
          creditIrr: materialCost.toString(),
        });
      }
      if (conversionCost > 0n) {
        journalLines.push({
          accountId: accounts.get('production_overhead') as string,
          debitIrr: '0',
          creditIrr: conversionCost.toString(),
        });
      }
      const journal = await createJournalEntry(client, {
        companyId: actor.companyId,
        branchId: order.branch_id,
        entryDate: new Date().toISOString().slice(0, 10),
        description: `\u062a\u06a9\u0645\u06cc\u0644 \u062f\u0633\u062a\u0648\u0631 \u062a\u0648\u0644\u06cc\u062f \u0634\u0645\u0627\u0631\u0647 ${order.order_number}`,
        sourceType: 'production_order',
        sourceId: orderId,
        createdBy: actor.id,
        lines: journalLines,
        post: true,
      });

      await client.query(
        `
          UPDATE production_orders
          SET
            status = 'completed',
            actual_quantity = $2,
            direct_labor_cost_irr = $3,
            subcontract_cost_irr = $4,
            overhead_cost_irr = $5,
            packaging_cost_irr = $6,
            total_cost_irr = $7,
            completed_by = $8,
            completed_at = now(),
            row_version = row_version + 1
          WHERE id = $1
        `,
        [
          orderId,
          input.actualQuantity,
          directLabor.toString(),
          subcontract.toString(),
          overhead.toString(),
          packaging.toString(),
          totalCost.toString(),
          actor.id,
        ],
      );
      await writeAudit(client, request, {
        action: 'production.complete',
        entityType: 'production_order',
        entityId: orderId,
        after: {
          actualQuantity: input.actualQuantity,
          totalCostIrr: totalCost.toString(),
          journalEntryId: journal.id,
        },
      });
      return {
        id: orderId,
        totalCostIrr: totalCost.toString(),
        unitCostIrr: unitCost.toFixed(6),
        journalEntryId: journal.id,
      };
    });
    response.json({data: completed});
  }),
);

productionRouter.post(
  '/orders/:id/cancel',
  requirePermissions(PERMISSIONS.PRODUCTION_MANAGE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const orderId = identifierSchema.parse(request.params.id);
    const input = z
      .object({reason: z.string().trim().min(5).max(1000)})
      .parse(request.body);
    const result = await query(
      `
        UPDATE production_orders production
        SET
          status = 'cancelled',
          description = concat_ws(
            E'\\n',
            production.description,
            $3
          ),
          row_version = production.row_version + 1
        WHERE production.id = $1
          AND production.company_id = $2
          AND production.status IN ('draft', 'planned', 'released')
          AND NOT EXISTS (
            SELECT 1
            FROM inventory_movements movement
            WHERE movement.source_type = 'production_order'
              AND movement.source_id = production.id
          )
        RETURNING production.id
      `,
      [
        orderId,
        actor.companyId,
        `\u0644\u063a\u0648 \u062f\u0633\u062a\u0648\u0631: ${input.reason}`,
      ],
    );
    if (!result.rowCount) {
      throw new AppError(
        409,
        'PRODUCTION_NOT_CANCELLABLE',
        '\u062f\u0633\u062a\u0648\u0631 \u0634\u0631\u0648\u0639\u200c\u0634\u062f\u0647 \u06cc\u0627 \u062f\u0627\u0631\u0627\u06cc \u06af\u0631\u062f\u0634 \u0627\u0646\u0628\u0627\u0631 \u0628\u0627 \u0644\u063a\u0648 \u0633\u0627\u062f\u0647 \u0642\u0627\u0628\u0644 \u062d\u0630\u0641 \u0627\u062b\u0631 \u0646\u06cc\u0633\u062a.',
      );
    }
    response.status(204).end();
  }),
);
