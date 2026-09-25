import {Router} from 'express';
import {z} from 'zod';
import {PERMISSIONS} from '../../../shared/permissions.js';
import {currentUser} from '../../common/auth-context.js';
import {AppError, asyncRoute} from '../../common/errors.js';
import {identifierSchema} from '../../common/values.js';
import {query, withTransaction} from '../../db/pool.js';
import {writeAudit} from '../../infrastructure/audit.js';
import {
  requireAuthentication,
  requirePermissions,
} from '../auth/middleware.js';

const branchCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(30).nullable().default(null),
  address: z.string().trim().max(1000).nullable().default(null),
  isHeadOffice: z.boolean().default(false),
});

const branchUpdateSchema = branchCreateSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
    rowVersion: z.number().int().positive(),
  });

const warehouseCreateSchema = z.object({
  branchId: identifierSchema,
  name: z.string().trim().min(2).max(160),
  warehouseType: z.enum([
    'general',
    'raw_material',
    'work_in_progress',
    'finished_goods',
    'service',
    'quarantine',
  ]),
  allowNegative: z.boolean().default(false),
});

const warehouseUpdateSchema = warehouseCreateSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
    rowVersion: z.number().int().positive(),
  });

async function nextAutomaticCode(
  client: Parameters<Parameters<typeof withTransaction>[0]>[0],
  companyId: string,
  entity: 'branch' | 'warehouse',
): Promise<string> {
  const source = entity === 'branch' ? 'branches' : 'warehouses';
  const prefix = entity === 'branch' ? 'BR' : 'WH';
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `organization:${entity}:${companyId}`,
  ]);
  const result = await client.query<{next_number: number}>(
    `
      SELECT (
        COALESCE(MAX((substring(code FROM '^${prefix}-([0-9]+)$'))::integer), 0) + 1
      )::integer AS next_number
      FROM ${source}
      WHERE company_id = $1
    `,
    [companyId],
  );
  const number = result.rows[0]?.next_number ?? 1;
  return `${prefix}-${String(number).padStart(4, '0')}`;
}

export const organizationRouter = Router();
organizationRouter.use(requireAuthentication);

organizationRouter.get(
  '/branches',
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const result = await query(
      `
        SELECT
          id,
          code,
          name,
          phone,
          address,
          is_head_office AS "isHeadOffice",
          is_active AS "isActive",
          row_version AS "rowVersion"
        FROM branches
        WHERE company_id = $1
        ORDER BY is_head_office DESC, name
      `,
      [user.companyId],
    );
    response.json({data: result.rows});
  }),
);

organizationRouter.post(
  '/branches',
  requirePermissions(PERMISSIONS.BRANCHES_MANAGE),
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const input = branchCreateSchema.parse(request.body);
    const created = await withTransaction(async (client) => {
      const code = await nextAutomaticCode(client, user.companyId, 'branch');
      if (input.isHeadOffice) {
        await client.query(
          `
            UPDATE branches
            SET
              is_head_office = false,
              row_version = row_version + 1
            WHERE company_id = $1 AND is_head_office = true
          `,
          [user.companyId],
        );
      }

      const result = await client.query(
        `
          INSERT INTO branches (
            company_id,
            code,
            name,
            phone,
            address,
            is_head_office
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING
            id,
            code,
            name,
            phone,
            address,
            is_head_office AS "isHeadOffice",
            is_active AS "isActive",
            row_version AS "rowVersion"
        `,
        [
          user.companyId,
          code,
          input.name,
          input.phone,
          input.address,
          input.isHeadOffice,
        ],
      );
      const row = result.rows[0];
      await writeAudit(client, request, {
        action: 'branch.create',
        entityType: 'branch',
        entityId: (row?.id as string | undefined) ?? null,
        after: row,
      });
      return row;
    });
    response.status(201).json({data: created});
  }),
);

organizationRouter.patch(
  '/branches/:id',
  requirePermissions(PERMISSIONS.BRANCHES_MANAGE),
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const branchId = identifierSchema.parse(request.params.id);
    const input = branchUpdateSchema.parse(request.body);

    const updated = await withTransaction(async (client) => {
      const beforeResult = await client.query(
        `
          SELECT *
          FROM branches
          WHERE id = $1 AND company_id = $2
          FOR UPDATE
        `,
        [branchId, user.companyId],
      );
      const before = beforeResult.rows[0];
      if (!before) {
        throw new AppError(404, 'BRANCH_NOT_FOUND', 'شعبه پیدا نشد.');
      }

      if (input.isHeadOffice) {
        await client.query(
          `
            UPDATE branches
            SET
              is_head_office = false,
              row_version = row_version + 1
            WHERE company_id = $1
              AND id <> $2
              AND is_head_office = true
          `,
          [user.companyId, branchId],
        );
      }

      const result = await client.query(
        `
          UPDATE branches
          SET
            name = COALESCE($4, name),
            phone = CASE WHEN $5::boolean THEN $6 ELSE phone END,
            address = CASE WHEN $7::boolean THEN $8 ELSE address END,
            is_head_office = COALESCE($9, is_head_office),
            is_active = COALESCE($10, is_active),
            row_version = row_version + 1
          WHERE id = $1
            AND company_id = $2
            AND row_version = $3
          RETURNING
            id,
            code,
            name,
            phone,
            address,
            is_head_office AS "isHeadOffice",
            is_active AS "isActive",
            row_version AS "rowVersion"
        `,
        [
          branchId,
          user.companyId,
          input.rowVersion,
          input.name ?? null,
          Object.hasOwn(input, 'phone'),
          input.phone ?? null,
          Object.hasOwn(input, 'address'),
          input.address ?? null,
          input.isHeadOffice ?? null,
          input.isActive ?? null,
        ],
      );
      const row = result.rows[0];
      if (!row) {
        throw new AppError(
          409,
          'CONCURRENT_UPDATE',
          'شعبه اصلی قابل غیرفعال‌سازی نیست.',
        );
      }
      await writeAudit(client, request, {
        action: 'branch.update',
        entityType: 'branch',
        entityId: branchId,
        before,
        after: row,
      });
      return row;
    });
    response.json({data: updated});
  }),
);

organizationRouter.get(
  '/warehouses',
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const result = await query(
      `
        SELECT
          warehouse.id,
          warehouse.branch_id AS "branchId",
          branch.name AS "branchName",
          warehouse.code,
          warehouse.name,
          warehouse.warehouse_type AS "warehouseType",
          warehouse.allow_negative AS "allowNegative",
          warehouse.is_active AS "isActive",
          warehouse.row_version AS "rowVersion"
        FROM warehouses warehouse
        JOIN branches branch ON branch.id = warehouse.branch_id
        WHERE warehouse.company_id = $1
        ORDER BY branch.name, warehouse.name
      `,
      [user.companyId],
    );
    response.json({data: result.rows});
  }),
);

organizationRouter.post(
  '/warehouses',
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const input = warehouseCreateSchema.parse(request.body);
    const row = await withTransaction(async (client) => {
      const code = await nextAutomaticCode(client, user.companyId, 'warehouse');
      const result = await client.query(
        `
          INSERT INTO warehouses (
            company_id, branch_id, code, name, warehouse_type, allow_negative
          )
          SELECT $1, branch.id, $3, $4, $5, $6
          FROM branches branch
          WHERE branch.id = $2
            AND branch.company_id = $1
            AND branch.is_active = true
          RETURNING
            id,
            branch_id AS "branchId",
            code,
            name,
            warehouse_type AS "warehouseType",
            allow_negative AS "allowNegative",
            is_active AS "isActive",
            row_version AS "rowVersion"
        `,
        [
          user.companyId,
          input.branchId,
          code,
          input.name,
          input.warehouseType,
          input.allowNegative,
        ],
      );
      const created = result.rows[0];
      if (!created) {
        throw new AppError(422, 'INVALID_BRANCH', 'شعبه انتخاب‌شده معتبر نیست.');
      }
      await writeAudit(client, request, {
        action: 'warehouse.create',
        entityType: 'warehouse',
        entityId: created.id as string,
        after: created,
      });
      return created;
    });
    response.status(201).json({data: row});
  }),
);

organizationRouter.patch(
  '/warehouses/:id',
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const warehouseId = identifierSchema.parse(request.params.id);
    const input = warehouseUpdateSchema.parse(request.body);
    const result = await query(
      `
        UPDATE warehouses warehouse
        SET
          branch_id = COALESCE($4, warehouse.branch_id),
          name = COALESCE($5, warehouse.name),
          warehouse_type = COALESCE($6, warehouse.warehouse_type),
          allow_negative = COALESCE($7, warehouse.allow_negative),
          is_active = COALESCE($8, warehouse.is_active),
          row_version = warehouse.row_version + 1
        WHERE warehouse.id = $1
          AND warehouse.company_id = $2
          AND warehouse.row_version = $3
          AND (
            $4::uuid IS NULL
            OR EXISTS (
              SELECT 1
              FROM branches branch
              WHERE branch.id = $4
                AND branch.company_id = $2
                AND branch.is_active = true
            )
          )
        RETURNING
          id,
          branch_id AS "branchId",
          code,
          name,
          warehouse_type AS "warehouseType",
          allow_negative AS "allowNegative",
          is_active AS "isActive",
          row_version AS "rowVersion"
      `,
      [
        warehouseId,
        user.companyId,
        input.rowVersion,
        input.branchId ?? null,
        input.name ?? null,
        input.warehouseType ?? null,
        input.allowNegative ?? null,
        input.isActive ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError(
        409,
        'CONCURRENT_UPDATE',
        'انبار پیدا نشد یا دارای سابقه عملیاتی است.',
      );
    }
    response.json({data: row});
  }),
);
