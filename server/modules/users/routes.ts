import {Router} from 'express';
import type {PoolClient, QueryResultRow} from 'pg';
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
import {describeDevice} from '../auth/session-state.js';

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
  rowVersion: z.number().int().positive(),
});

const accountStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'archived']),
  reason: z.string().trim().max(500).optional(),
  rowVersion: z.number().int().positive(),
});

const revokeSchema = z.object({
  reason: z.string().trim().min(3).max(500).default('خروج اجباری توسط مدیر سامانه'),
});

interface UserListRow extends QueryResultRow {
  id: string;
  fullName: string;
  username: string;
  preferredAmountUnit: 'IRR' | 'TOMAN';
  isActive: boolean;
  accountStatus: 'active' | 'inactive' | 'archived';
  deactivationReason: string | null;
  lastLoginAt: Date | null;
  lastSeenAt: Date | null;
  lastIp: string | null;
  lastUserAgent: string | null;
  activeSessionCount: number;
  online: boolean;
  rowVersion: number;
  roles: Array<{id: string; code: string; name: string}>;
}

async function ensureUniqueUserFullName(
  client: PoolClient,
  companyId: string,
  fullName: string,
  exceptUserId?: string,
): Promise<void> {
  const normalizedName = fullName.trim().toLowerCase();
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `users:full-name:${companyId}:${normalizedName}`,
  ]);
  const result = await client.query(
    `
      SELECT 1
      FROM users
      WHERE company_id = $1
        AND lower(btrim(full_name)) = lower(btrim($2))
        AND ($3::uuid IS NULL OR id <> $3)
      LIMIT 1
    `,
    [companyId, fullName, exceptUserId ?? null],
  );
  if (result.rowCount) {
    throw new AppError(
      409,
      'DUPLICATE_USER_FULL_NAME',
      'کاربری با این نام از قبل وجود دارد. نام دیگری وارد کنید.',
    );
  }
}

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
    const result = await query<UserListRow>(
      `
        SELECT
          target.id,
          target.full_name AS "fullName",
          target.username,
          target.preferred_amount_unit AS "preferredAmountUnit",
          target.is_active AS "isActive",
          target.account_status AS "accountStatus",
          target.deactivation_reason AS "deactivationReason",
          target.last_login_at AS "lastLoginAt",
          session_summary.last_seen_at AS "lastSeenAt",
          session_summary.last_ip AS "lastIp",
          session_summary.last_user_agent AS "lastUserAgent",
          session_summary.active_session_count::integer AS "activeSessionCount",
          COALESCE(session_summary.online, false) AS online,
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
        LEFT JOIN LATERAL (
          SELECT
            max(session.last_seen_at) AS last_seen_at,
            (array_agg(session.ip_address::text ORDER BY session.last_seen_at DESC))[1] AS last_ip,
            (array_agg(session.user_agent ORDER BY session.last_seen_at DESC))[1] AS last_user_agent,
            count(*) FILTER (
              WHERE session.revoked_at IS NULL
                AND session.expires_at > now()
                AND session.idle_expires_at > now()
            ) AS active_session_count,
            bool_or(
              session.revoked_at IS NULL
              AND session.expires_at > now()
              AND session.idle_expires_at > now()
              AND session.last_seen_at >= now() - interval '2 minutes'
            ) AS online
          FROM sessions session
          WHERE session.user_id = target.id
        ) session_summary ON true
        WHERE target.company_id = $1
        GROUP BY
          target.id,
          session_summary.last_seen_at,
          session_summary.last_ip,
          session_summary.last_user_agent,
          session_summary.active_session_count,
          session_summary.online
        ORDER BY target.full_name
      `,
      [actor.companyId],
    );
    response.json({
      data: result.rows.map((row) => ({
        ...row,
        device: describeDevice(row.lastUserAgent),
      })),
    });
  }),
);

usersRouter.get(
  '/name-availability',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const fullName = z.string().trim().min(2).max(160).parse(
      request.query.fullName,
    );
    const excludeId = request.query.excludeId
      ? identifierSchema.parse(request.query.excludeId)
      : null;
    const result = await query(
      `
        SELECT 1
        FROM users
        WHERE company_id = $1
          AND lower(btrim(full_name)) = lower(btrim($2))
          AND ($3::uuid IS NULL OR id <> $3)
        LIMIT 1
      `,
      [actor.companyId, fullName, excludeId],
    );
    response.json({data: {available: !result.rowCount}});
  }),
);

usersRouter.post(
  '/',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = userSchema.parse(request.body);
    const passwordHash = await hashPassword(input.password);

    const created = await withTransaction(async (client) => {
      await ensureUniqueUserFullName(client, actor.companyId, input.fullName);
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

    const row = await withTransaction(async (client) => {
      if (input.fullName !== undefined) {
        await ensureUniqueUserFullName(
          client,
          actor.companyId,
          input.fullName,
          userId,
        );
      }
      const before = await client.query(
        `
          SELECT id, full_name, username, row_version
          FROM users
          WHERE id = $1 AND company_id = $2
          FOR UPDATE
        `,
        [userId, actor.companyId],
      );
      if (!before.rows[0]) {
        throw new AppError(404, 'USER_NOT_FOUND', 'کاربر پیدا نشد.');
      }
      const result = await client.query(
      `
        UPDATE users
        SET
          full_name = COALESCE($4, full_name),
          username = COALESCE($5, username),
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
          account_status AS "accountStatus",
          row_version AS "rowVersion"
      `,
      [
        userId,
        actor.companyId,
        input.rowVersion,
        input.fullName ?? null,
        input.username ?? null,
      ],
      );
      const updated = result.rows[0];
      if (!updated) {
        throw new AppError(
          409,
          'CONCURRENT_UPDATE',
          'کاربر پیدا نشد یا هم‌زمان تغییر کرده است.',
        );
      }
      await writeAudit(client, request, {
        action: 'user.profile.update',
        module: 'users',
        entityType: 'user',
        entityId: userId,
        before: before.rows[0],
        after: updated,
      });
      return updated;
    });
    response.json({data: row});
  }),
);

usersRouter.get(
  '/:id/sessions',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const userId = identifierSchema.parse(request.params.id);
    const target = await query(
      'SELECT 1 FROM users WHERE id = $1 AND company_id = $2',
      [userId, actor.companyId],
    );
    if (!target.rowCount) {
      throw new AppError(404, 'USER_NOT_FOUND', 'کاربر پیدا نشد.');
    }
    const result = await query<{
      id: string;
      createdAt: Date;
      lastSeenAt: Date;
      expiresAt: Date;
      idleExpiresAt: Date;
      revokedAt: Date | null;
      revokeReason: string | null;
      ipAddress: string | null;
      userAgent: string | null;
      active: boolean;
    }>(
      `
        SELECT
          session.id,
          session.created_at AS "createdAt",
          session.last_seen_at AS "lastSeenAt",
          session.expires_at AS "expiresAt",
          session.idle_expires_at AS "idleExpiresAt",
          session.revoked_at AS "revokedAt",
          session.revoke_reason AS "revokeReason",
          session.ip_address::text AS "ipAddress",
          session.user_agent AS "userAgent",
          (
            session.revoked_at IS NULL
            AND session.expires_at > now()
            AND session.idle_expires_at > now()
          ) AS active
        FROM sessions session
        WHERE session.user_id = $1
        ORDER BY session.created_at DESC
        LIMIT 100
      `,
      [userId],
    );
    response.json({
      data: result.rows.map((row) => ({
        ...row,
        current: row.id === request.sessionId,
        device: describeDevice(row.userAgent),
      })),
    });
  }),
);

usersRouter.post(
  '/:id/sessions/:sessionId/revoke',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const userId = identifierSchema.parse(request.params.id);
    const sessionId = identifierSchema.parse(request.params.sessionId);
    const input = revokeSchema.parse(request.body ?? {});
    await withTransaction(async (client) => {
      const result = await client.query(
        `
          UPDATE sessions session
          SET
            revoked_at = COALESCE(session.revoked_at, now()),
            revoke_reason = COALESCE(session.revoke_reason, $4),
            revoked_by = COALESCE(session.revoked_by, $2)
          FROM users target
          WHERE session.id = $1
            AND session.user_id = $3
            AND target.id = session.user_id
            AND target.company_id = $5
          RETURNING session.id
        `,
        [sessionId, actor.id, userId, input.reason, actor.companyId],
      );
      if (!result.rowCount) {
        throw new AppError(404, 'SESSION_NOT_FOUND', 'نشست پیدا نشد.');
      }
      await writeAudit(client, request, {
        action: 'session.revoke',
        module: 'auth',
        entityType: 'session',
        entityId: sessionId,
        after: {userId, revokedBy: actor.id},
        reason: input.reason,
      });
    });
    response.status(204).end();
  }),
);

usersRouter.post(
  '/:id/sessions/revoke-all',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const userId = identifierSchema.parse(request.params.id);
    const input = revokeSchema.parse(request.body ?? {});
    const revokedCount = await withTransaction(async (client) => {
      const target = await client.query(
        'SELECT 1 FROM users WHERE id = $1 AND company_id = $2 FOR UPDATE',
        [userId, actor.companyId],
      );
      if (!target.rowCount) {
        throw new AppError(404, 'USER_NOT_FOUND', 'کاربر پیدا نشد.');
      }
      const result = await client.query(
        `
          UPDATE sessions
          SET
            revoked_at = COALESCE(revoked_at, now()),
            revoke_reason = COALESCE(revoke_reason, $3),
            revoked_by = COALESCE(revoked_by, $2)
          WHERE user_id = $1 AND revoked_at IS NULL
        `,
        [userId, actor.id, input.reason],
      );
      await writeAudit(client, request, {
        action: 'session.revoke_all',
        module: 'auth',
        entityType: 'user',
        entityId: userId,
        after: {revokedSessions: result.rowCount ?? 0},
        reason: input.reason,
      });
      return result.rowCount ?? 0;
    });
    response.json({data: {revokedSessions: revokedCount}});
  }),
);

usersRouter.patch(
  '/:id/status',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const userId = identifierSchema.parse(request.params.id);
    const input = accountStatusSchema.parse(request.body);
    if (userId === actor.id && input.status !== 'active') {
      throw new AppError(
        409,
        'CANNOT_DEACTIVATE_SELF',
        'برای جلوگیری از قطع دسترسی مدیریتی، حساب فعال خودتان را نمی‌توانید غیرفعال کنید.',
      );
    }
    const reason = input.reason || 'توسط مدیر سامانه';
    const result = await withTransaction(async (client) => {
      const targetResult = await client.query<{
        id: string;
        full_name: string;
        username: string;
        account_status: string;
        row_version: number;
        is_administrator: boolean;
      }>(
        `
          SELECT
            target.id,
            target.full_name,
            target.username,
            target.account_status,
            target.row_version,
            EXISTS (
              SELECT 1
              FROM user_roles user_role
              JOIN roles role ON role.id = user_role.role_id
              WHERE user_role.user_id = target.id
                AND role.code = 'administrator'
                AND role.is_active = true
            ) AS is_administrator
          FROM users target
          WHERE target.id = $1 AND target.company_id = $2
          FOR UPDATE
        `,
        [userId, actor.companyId],
      );
      const target = targetResult.rows[0];
      if (!target) {
        throw new AppError(404, 'USER_NOT_FOUND', 'کاربر پیدا نشد.');
      }
      if (input.status !== 'active' && target.is_administrator) {
        const administrators = await client.query<{count: string}>(
          `
            SELECT count(DISTINCT target.id)::text AS count
            FROM users target
            JOIN user_roles user_role ON user_role.user_id = target.id
            JOIN roles role ON role.id = user_role.role_id
            WHERE target.company_id = $1
              AND target.account_status = 'active'
              AND target.is_active = true
              AND role.code = 'administrator'
              AND role.is_active = true
          `,
          [actor.companyId],
        );
        if (Number(administrators.rows[0]?.count ?? 0) <= 1) {
          throw new AppError(
            409,
            'LAST_ADMINISTRATOR',
            'حداقل یک مدیر سامانه فعال باید باقی بماند.',
          );
        }
      }
      const updated = await client.query(
        `
          UPDATE users
          SET
            account_status = $4::varchar,
            is_active = ($4::varchar = 'active'),
            deactivated_at = CASE WHEN $4::varchar = 'active' THEN NULL ELSE now() END,
            deactivation_reason = CASE WHEN $4::varchar = 'active' THEN NULL::text ELSE $5::text END,
            archived_at = CASE WHEN $4::varchar = 'archived' THEN now() ELSE NULL END,
            row_version = row_version + 1
          WHERE id = $1
            AND company_id = $2
            AND row_version = $3
          RETURNING
            id,
            full_name AS "fullName",
            username,
            is_active AS "isActive",
            account_status AS "accountStatus",
            deactivation_reason AS "deactivationReason",
            row_version AS "rowVersion"
        `,
        [userId, actor.companyId, input.rowVersion, input.status, reason],
      );
      const row = updated.rows[0];
      if (!row) {
        throw new AppError(
          409,
          'CONCURRENT_UPDATE',
          'کاربر هم‌زمان تغییر کرده است؛ فهرست را دوباره دریافت کنید.',
        );
      }
      let revokedSessions = 0;
      if (input.status !== 'active') {
        const revoked = await client.query(
          `
            UPDATE sessions
            SET
              revoked_at = COALESCE(revoked_at, now()),
              revoke_reason = COALESCE(revoke_reason, $3),
              revoked_by = COALESCE(revoked_by, $2)
            WHERE user_id = $1 AND revoked_at IS NULL
          `,
          [userId, actor.id, reason],
        );
        revokedSessions = revoked.rowCount ?? 0;
      }
      await writeAudit(client, request, {
        action: input.status === 'active' ? 'user.activate' : 'user.deactivate',
        module: 'users',
        entityType: 'user',
        entityId: userId,
        before: {
          status: target.account_status,
          rowVersion: target.row_version,
        },
        after: {...row, revokedSessions},
        reason,
      });
      return {...row, revokedSessions};
    });
    response.json({data: result});
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
      const revoked = await client.query(
        `
          UPDATE sessions
          SET
            revoked_at = COALESCE(revoked_at, now()),
            revoke_reason = COALESCE(revoke_reason, 'role_changed'),
            revoked_by = COALESCE(revoked_by, $2)
          WHERE user_id = $1 AND revoked_at IS NULL
        `,
        [userId, actor.id],
      );
      await writeAudit(client, request, {
        action: 'user.roles.update',
        module: 'users',
        entityType: 'user',
        entityId: userId,
        before: before.rows,
        after: {
          roleIds: input.roleIds,
          revokedSessions: revoked.rowCount ?? 0,
        },
        reason: 'تغییر نقش یا مجوز',
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
    await withTransaction(async (client) => {
      const result = await client.query(
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
      const revoked = await client.query(
        `
          UPDATE sessions
          SET
            revoked_at = COALESCE(revoked_at, now()),
            revoke_reason = COALESCE(revoke_reason, 'password_reset'),
            revoked_by = COALESCE(revoked_by, $2)
          WHERE user_id = $1 AND revoked_at IS NULL
        `,
        [userId, actor.id],
      );
      await writeAudit(client, request, {
        action: 'user.password.reset',
        module: 'users',
        entityType: 'user',
        entityId: userId,
        after: {revokedSessions: revoked.rowCount ?? 0},
        reason: 'بازنشانی رمز توسط مدیر سامانه',
      });
    });
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
