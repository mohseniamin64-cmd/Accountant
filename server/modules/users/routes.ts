import {Router} from 'express';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {
  PERMISSION_CATALOG,
  PERMISSIONS,
} from '../../../shared/permissions.js';
import {currentUser} from '../../common/auth-context.js';
import {AppError, asyncRoute} from '../../common/errors.js';
import {identifierSchema} from '../../common/values.js';
import {
  hashPassword,
  validPassword,
} from '../../common/security.js';
import {query, withTransaction} from '../../db/pool.js';
import {writeAudit} from '../../infrastructure/audit.js';
import {
  requireAuthentication,
  requirePermissions,
} from '../auth/middleware.js';

const passwordSchema = z.string().max(256).refine(
  validPassword,
  'رمز عبور باید حداقل ۱۰ نویسه و شامل حروف بزرگ، کوچک و عدد باشد.',
);

const userSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  username: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      'نام کاربری فقط می‌تواند شامل حروف انگلیسی، عدد و ._- باشد.',
    ),
  password: passwordSchema,
  preferredAmountUnit: z.enum(['IRR', 'TOMAN']).default('IRR'),
  roleIds: z.array(identifierSchema).min(1),
});

const userUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(160).optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .optional(),
  isActive: z.boolean().optional(),
  rowVersion: z.number().int().positive(),
});

const roleSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).nullable().default(null),
  permissionCodes: z
    .array(z.string())
    .refine(
      (items) =>
        items.every((code) =>
          PERMISSION_CATALOG.some((item) => item.code === code),
        ),
      'یک یا چند مجوز انتخاب‌شده معتبر نیست.',
    ),
});

const roleUpdateSchema = roleSchema.partial().extend({
  isActive: z.boolean().optional(),
  rowVersion: z.number().int().positive(),
});

async function ensureCompanyRoles(
  client: PoolClient,
  companyId: string,
  roleIds: readonly string[],
): Promise<void> {
  const uniqueIds = [...new Set(roleIds)];
  const result = await client.query<{count: string}>(
    `
      SELECT count(*)::text AS count
      FROM roles
      WHERE company_id = $1
        AND is_active = true
        AND id = ANY($2::uuid[])
    `,
    [companyId, uniqueIds],
  );
  if (Number(result.rows[0]?.count ?? 0) !== uniqueIds.length) {
    throw new AppError(
      422,
      'INVALID_ROLE',
      'یک یا چند نقش انتخاب‌شده معتبر نیست.',
    );
  }
}

export const usersRouter = Router();
usersRouter.use(
  requireAuthentication,
  requirePermissions(PERMISSIONS.USERS_MANAGE),
);

usersRouter.get(
  '/',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const result = await query(
      `
        SELECT
          target.id,
          target.full_name AS "fullName",
          target.username,
          target.preferred_amount_unit AS "preferredAmountUnit",
          target.is_active AS "isActive",
          target.last_login_at AS "lastLoginAt",
          target.row_version AS "rowVersion",
          COALESCE(
            jsonb_agg(
              DISTINCT jsonb_build_object(
                'id', role.id,
                'code', role.code,
                'name', role.name
              )
            ) FILTER (WHERE role.id IS NOT NULL),
            '[]'::jsonb
          ) AS roles
        FROM users target
        LEFT JOIN user_roles user_role ON user_role.user_id = target.id
        LEFT JOIN roles role ON role.id = user_role.role_id
        WHERE target.company_id = $1
        GROUP BY target.id
        ORDER BY target.full_name
      `,
      [actor.companyId],
    );
    response.json({data: result.rows});
  }),
);

usersRouter.post(
  '/',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = userSchema.parse(request.body);
    const passwordHash = await hashPassword(input.password);

    const created = await withTransaction(async (client) => {
      await ensureCompanyRoles(client, actor.companyId, input.roleIds);
      const result = await client.query(
        `
          INSERT INTO users (
            company_id,
            full_name,
            username,
            password_hash,
            preferred_amount_unit,
            must_change_password
          )
          VALUES ($1, $2, $3, $4, $5, true)
          RETURNING
            id,
            full_name AS "fullName",
            username,
            preferred_amount_unit AS "preferredAmountUnit",
            is_active AS "isActive",
            row_version AS "rowVersion"
        `,
        [
          actor.companyId,
          input.fullName,
          input.username,
          passwordHash,
          input.preferredAmountUnit,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error('User was not created');

      for (const roleId of new Set(input.roleIds)) {
        await client.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
          [row.id, roleId],
        );
      }
      await writeAudit(client, request, {
        action: 'user.create',
        entityType: 'user',
        entityId: String(row.id),
        after: {
          id: row.id,
          username: row.username,
          roleIds: input.roleIds,
        },
      });
      return row;
    });

    response.status(201).json({data: created});
  }),
);

usersRouter.patch(
  '/:id',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const userId = identifierSchema.parse(request.params.id);
    const input = userUpdateSchema.parse(request.body);
    if (userId === actor.id && input.isActive === false) {
      throw new AppError(
        409,
        'CANNOT_DEACTIVATE_SELF',
        'کاربر غیرفعال باید دلیل مشخص داشته باشد.',
      );
    }

    const result = await query(
      `
        UPDATE users
        SET
          full_name = COALESCE($4, full_name),
          username = COALESCE($5, username),
          is_active = COALESCE($6, is_active),
          row_version = row_version + 1
        WHERE id = $1
          AND company_id = $2
          AND row_version = $3
        RETURNING
          id,
          full_name AS "fullName",
          username,
          preferred_amount_unit AS "preferredAmountUnit",
          is_active AS "isActive",
          row_version AS "rowVersion"
      `,
      [
        userId,
        actor.companyId,
        input.rowVersion,
        input.fullName ?? null,
        input.username ?? null,
        input.isActive ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError(
        409,
        'CONCURRENT_UPDATE',
        'کاربر پیدا نشد یا هم‌زمان تغییر کرده است.',
      );
    }
    response.json({data: row});
  }),
);

usersRouter.put(
  '/:id/roles',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const userId = identifierSchema.parse(request.params.id);
    const input = z
      .object({roleIds: z.array(identifierSchema).min(1)})
      .parse(request.body);

    await withTransaction(async (client) => {
      const target = await client.query(
        'SELECT 1 FROM users WHERE id = $1 AND company_id = $2 FOR UPDATE',
        [userId, actor.companyId],
      );
      if (!target.rowCount) {
        throw new AppError(404, 'USER_NOT_FOUND', 'کاربر پیدا نشد.');
      }
      await ensureCompanyRoles(client, actor.companyId, input.roleIds);

      if (userId === actor.id) {
        const permission = await client.query(
          `
            SELECT 1
            FROM role_permissions
            WHERE role_id = ANY($1::uuid[])
              AND permission_code = $2
            LIMIT 1
          `,
          [input.roleIds, PERMISSIONS.USERS_MANAGE],
        );
        if (!permission.rowCount) {
          throw new AppError(
            409,
            'CANNOT_REMOVE_OWN_ADMIN_ACCESS',
            'غیرفعال‌کردن آخرین مدیر فعال سامانه مجاز نیست.',
          );
        }
      }

      const before = await client.query(
        'SELECT role_id FROM user_roles WHERE user_id = $1',
        [userId],
      );
      await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
      for (const roleId of new Set(input.roleIds)) {
        await client.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
          [userId, roleId],
        );
      }
      await client.query(
        'DELETE FROM sessions WHERE user_id = $1 AND id <> $2',
        [userId, request.sessionId],
      );
      await writeAudit(client, request, {
        action: 'user.roles.update',
        entityType: 'user',
        entityId: userId,
        before: before.rows,
        after: {roleIds: input.roleIds},
      });
    });

    response.status(204).end();
  }),
);

usersRouter.post(
  '/:id/reset-password',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const userId = identifierSchema.parse(request.params.id);
    const input = z.object({password: passwordSchema}).parse(request.body);
    const passwordHash = await hashPassword(input.password);
    const result = await query(
      `
        UPDATE users
        SET
          password_hash = $3,
          must_change_password = true,
          failed_login_count = 0,
          locked_until = NULL,
          row_version = row_version + 1
        WHERE id = $1 AND company_id = $2
        RETURNING id
      `,
      [userId, actor.companyId, passwordHash],
    );
    if (!result.rowCount) {
      throw new AppError(404, 'USER_NOT_FOUND', 'کاربر پیدا نشد.');
    }
    await query(
      'DELETE FROM sessions WHERE user_id = $1 AND id <> $2',
      [userId, request.sessionId],
    );
    response.status(204).end();
  }),
);

export const rolesRouter = Router();
rolesRouter.use(
  requireAuthentication,
  requirePermissions(PERMISSIONS.ROLES_MANAGE),
);

rolesRouter.get(
  '/',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const result = await query(
      `
        SELECT
          role.id,
          role.code,
          role.name,
          role.description,
          role.is_system AS "isSystem",
          role.is_active AS "isActive",
          role.row_version AS "rowVersion",
          COALESCE(
            array_agg(role_permission.permission_code)
              FILTER (WHERE role_permission.permission_code IS NOT NULL),
            ARRAY[]::text[]
          ) AS "permissionCodes"
        FROM roles role
        LEFT JOIN role_permissions role_permission
          ON role_permission.role_id = role.id
        WHERE role.company_id = $1
        GROUP BY role.id
        ORDER BY role.name
      `,
      [actor.companyId],
    );
    response.json({
      data: {
        roles: result.rows,
        permissionCatalog: PERMISSION_CATALOG,
      },
    });
  }),
);

rolesRouter.post(
  '/',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = roleSchema.parse(request.body);
    const created = await withTransaction(async (client) => {
      const result = await client.query(
        `
          INSERT INTO roles (
            company_id,
            code,
            name,
            description
          )
          VALUES ($1, $2, $3, $4)
          RETURNING
            id,
            code,
            name,
            description,
            is_system AS "isSystem",
            is_active AS "isActive",
            row_version AS "rowVersion"
        `,
        [
          actor.companyId,
          input.code,
          input.name,
          input.description,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error('Role was not created');
      for (const code of new Set(input.permissionCodes)) {
        await client.query(
          `
            INSERT INTO role_permissions (role_id, permission_code)
            VALUES ($1, $2)
          `,
          [row.id, code],
        );
      }
      return row;
    });
    response.status(201).json({data: created});
  }),
);

rolesRouter.patch(
  '/:id',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const roleId = identifierSchema.parse(request.params.id);
    const input = roleUpdateSchema.parse(request.body);
    const updated = await withTransaction(async (client) => {
      const result = await client.query(
        `
          UPDATE roles
          SET
            code = CASE
              WHEN is_system THEN code
              ELSE COALESCE($4, code)
            END,
            name = COALESCE($5, name),
            description = CASE
              WHEN $6::boolean THEN $7
              ELSE description
            END,
            is_active = COALESCE($8, is_active),
            row_version = row_version + 1
          WHERE id = $1
            AND company_id = $2
            AND row_version = $3
          RETURNING
            id,
            code,
            name,
            description,
            is_system AS "isSystem",
            is_active AS "isActive",
            row_version AS "rowVersion"
        `,
        [
          roleId,
          actor.companyId,
          input.rowVersion,
          input.code ?? null,
          input.name ?? null,
          Object.hasOwn(input, 'description'),
          input.description ?? null,
          input.isActive ?? null,
        ],
      );
      const row = result.rows[0];
      if (!row) {
        throw new AppError(
          409,
          'CONCURRENT_UPDATE',
          'نقش پیدا نشد یا هم‌زمان تغییر کرده است.',
        );
      }

      if (input.permissionCodes) {
        await client.query(
          'DELETE FROM role_permissions WHERE role_id = $1',
          [roleId],
        );
        for (const code of new Set(input.permissionCodes)) {
          await client.query(
            `
              INSERT INTO role_permissions (role_id, permission_code)
              VALUES ($1, $2)
            `,
            [roleId, code],
          );
        }
      }
      return row;
    });
    response.json({data: updated});
  }),
);
