import {Router} from 'express';
import type {PoolClient, QueryResultRow} from 'pg';
import {z} from 'zod';
import {PERMISSION_CATALOG} from '../../../shared/permissions.js';
import {AppError, asyncRoute} from '../../common/errors.js';
import {isoDateSchema} from '../../common/values.js';
import {
  createSessionToken,
  hashPassword,
  validPassword,
} from '../../common/security.js';
import {config} from '../../config.js';
import {withTransaction} from '../../db/pool.js';
import {setSessionCookie} from '../auth/session-cookie.js';
import {loadAuthenticatedUser} from '../auth/user.js';
import {DEFAULT_CHART, DEFAULT_ROLES} from './defaults.js';

interface IdRow extends QueryResultRow {
  id: string;
}

export const setupSchema = z
  .object({
    companyName: z
      .string()
      .trim()
      .min(2, 'نام شرکت یا کارگاه باید حداقل دو نویسه باشد.')
      .max(180, 'نام شرکت یا کارگاه بیش از حد طولانی است.'),
    companyEnglishName: z
      .string()
      .trim()
      .max(180, 'نام انگلیسی بیش از حد طولانی است.')
      .nullable()
      .default(null),
    branchName: z
      .string()
      .trim()
      .min(2, 'نام شعبه اصلی باید حداقل دو نویسه باشد.')
      .max(160, 'نام شعبه اصلی بیش از حد طولانی است.'),
    adminFullName: z
      .string()
      .trim()
      .min(2, 'نام مدیر باید حداقل دو نویسه باشد.')
      .max(160, 'نام مدیر بیش از حد طولانی است.'),
    adminUsername: z
      .string()
      .trim()
      .min(3, 'نام کاربری باید حداقل سه نویسه باشد.')
      .max(80, 'نام کاربری بیش از حد طولانی است.')
      .regex(
        /^[a-zA-Z0-9._-]+$/,
        'نام کاربری فقط باید شامل حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.',
      ),
    adminPassword: z
      .string()
      .min(1, 'رمز عبور الزامی است.')
      .max(256, 'رمز عبور بیش از حد طولانی است.'),
    defaultAmountUnit: z.enum(['IRR', 'TOMAN']).default('IRR'),
    fiscalYearTitle: z
      .string()
      .trim()
      .min(2, 'عنوان سال مالی باید حداقل دو نویسه باشد.')
      .max(120, 'عنوان سال مالی بیش از حد طولانی است.'),
    fiscalYearStartsOn: isoDateSchema,
    fiscalYearEndsOn: isoDateSchema,
  })
  .superRefine((value, context) => {
    if (!validPassword(value.adminPassword)) {
      context.addIssue({
        code: 'custom',
        path: ['adminPassword'],
        message:
          'رمز عبور باید حداقل ۱۰ نویسه و شامل حروف بزرگ انگلیسی، حروف کوچک انگلیسی و عدد باشد.',
      });
    }
    if (value.fiscalYearStartsOn > value.fiscalYearEndsOn) {
      context.addIssue({
        code: 'custom',
        path: ['fiscalYearEndsOn'],
        message: 'تاریخ پایان سال مالی باید بعد از تاریخ شروع باشد.',
      });
    }
  });

async function insertAccountChart(
  client: PoolClient,
  companyId: string,
): Promise<void> {
  const ids = new Map<string, string>();
  for (const account of DEFAULT_CHART) {
    const parentId = account.parentKey
      ? (ids.get(account.parentKey) ?? null)
      : null;
    if (account.parentKey && !parentId) {
      throw new Error(`Missing account parent: ${account.parentKey}`);
    }

    const result = await client.query<IdRow>(
      `
        INSERT INTO accounts (
          company_id,
          parent_id,
          code,
          name,
          account_level,
          account_type,
          normal_balance,
          system_key,
          allows_posting,
          requires_party,
          is_system
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          true
        )
        RETURNING id
      `,
      [
        companyId,
        parentId,
        account.code,
        account.name,
        account.level,
        account.type,
        account.normal,
        account.key,
        account.posting ?? false,
        account.party ?? false,
      ],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error('Account insertion did not return an id');
    ids.set(account.key, id);
  }
}

export const setupRouter = Router();

setupRouter.post(
  '/',
  asyncRoute(async (request, response) => {
    const input = setupSchema.parse(request.body);
    const passwordHash = await hashPassword(input.adminPassword);
    const session = createSessionToken();

    const result = await withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [812_309_441]);
      const existing = await client.query('SELECT 1 FROM companies LIMIT 1');
      if (existing.rowCount) {
        throw new AppError(
          409,
          'SETUP_ALREADY_COMPLETED',
          'راه‌اندازی اولیه قبلاً انجام شده است.',
        );
      }

      const companyResult = await client.query<IdRow>(
        `
          INSERT INTO companies (
            code,
            name_fa,
            name_en,
            default_amount_unit
          )
          VALUES ('DIACO', $1, $2, $3)
          RETURNING id
        `,
        [
          input.companyName,
          input.companyEnglishName || null,
          input.defaultAmountUnit,
        ],
      );
      const companyId = companyResult.rows[0]?.id;
      if (!companyId) throw new Error('Company insertion failed');

      const branchResult = await client.query<IdRow>(
        `
          INSERT INTO branches (
            company_id,
            code,
            name,
            is_head_office
          )
          VALUES ($1, 'MAIN', $2, true)
          RETURNING id
        `,
        [companyId, input.branchName],
      );
      const branchId = branchResult.rows[0]?.id;
      if (!branchId) throw new Error('Branch insertion failed');

      const warehouseDefinitions = [
        ['RAW', 'انبار مواد و قطعات', 'raw_material'],
        ['WIP', 'انبار کالای در جریان ساخت', 'work_in_progress'],
        ['FINISHED', 'انبار محصول نهایی', 'finished_goods'],
        ['SERVICE', 'انبار خدمات', 'service'],
        ['QUARANTINE', 'انبار قرنطینه', 'quarantine'],
      ] as const;

      for (const [code, name, type] of warehouseDefinitions) {
        await client.query(
          `
            INSERT INTO warehouses (
              company_id,
              branch_id,
              code,
              name,
              warehouse_type
            )
            VALUES ($1, $2, $3, $4, $5)
          `,
          [companyId, branchId, code, name, type],
        );
      }

      const userResult = await client.query<IdRow>(
        `
          INSERT INTO users (
            company_id,
            full_name,
            username,
            password_hash,
            preferred_amount_unit
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `,
        [
          companyId,
          input.adminFullName,
          input.adminUsername,
          passwordHash,
          input.defaultAmountUnit,
        ],
      );
      const userId = userResult.rows[0]?.id;
      if (!userId) throw new Error('Admin insertion failed');

      for (const permission of PERMISSION_CATALOG) {
        await client.query(
          `
            INSERT INTO permissions (code, module, title)
            VALUES ($1, $2, $3)
            ON CONFLICT (code) DO UPDATE
            SET module = EXCLUDED.module, title = EXCLUDED.title
          `,
          [permission.code, permission.module, permission.title],
        );
      }

      let administratorRoleId: string | null = null;
      for (const role of DEFAULT_ROLES) {
        const roleResult = await client.query<IdRow>(
          `
            INSERT INTO roles (
              company_id,
              code,
              name,
              description,
              is_system
            )
            VALUES ($1, $2, $3, $4, true)
            RETURNING id
          `,
          [companyId, role.code, role.name, role.description],
        );
        const roleId = roleResult.rows[0]?.id;
        if (!roleId) throw new Error('Role insertion failed');
        if (role.code === 'administrator') administratorRoleId = roleId;

        const permissions =
          role.permissions === 'all'
            ? PERMISSION_CATALOG.map((item) => item.code)
            : role.permissions;
        for (const permissionCode of permissions) {
          await client.query(
            `
              INSERT INTO role_permissions (role_id, permission_code)
              VALUES ($1, $2)
            `,
            [roleId, permissionCode],
          );
        }
      }

      if (!administratorRoleId) {
        throw new Error('Administrator role was not created');
      }
      await client.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [userId, administratorRoleId],
      );

      const fiscalResult = await client.query<IdRow>(
        `
          INSERT INTO fiscal_years (
            company_id,
            title,
            starts_on,
            ends_on
          )
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [
          companyId,
          input.fiscalYearTitle,
          input.fiscalYearStartsOn,
          input.fiscalYearEndsOn,
        ],
      );
      const fiscalYearId = fiscalResult.rows[0]?.id;
      if (!fiscalYearId) throw new Error('Fiscal year insertion failed');

      await client.query(
        `
          INSERT INTO fiscal_periods (
            fiscal_year_id,
            period_number,
            title,
            starts_on,
            ends_on
          )
          VALUES ($1, 1, $2, $3, $4)
        `,
        [
          fiscalYearId,
          'سال مالی آغازین',
          input.fiscalYearStartsOn,
          input.fiscalYearEndsOn,
        ],
      );

      const unitDefinitions = [
        ['COUNT', 'عدد', 0],
        ['METER', 'متر', 3],
        ['KILOGRAM', 'کیلوگرم', 3],
      ] as const;
      for (const [code, name, decimals] of unitDefinitions) {
        await client.query(
          `
            INSERT INTO units (
              company_id,
              code,
              name,
              decimal_places
            )
            VALUES ($1, $2, $3, $4)
          `,
          [companyId, code, name, decimals],
        );
      }

      await insertAccountChart(client, companyId);

      for (const connector of [
        'android_sms',
        'google_drive',
        'taxpayer_system',
      ]) {
        await client.query(
          `
            INSERT INTO connector_states (
              company_id,
              connector_type,
              is_enabled
            )
            VALUES ($1, $2, false)
          `,
          [companyId, connector],
        );
      }

      await client.query(
        `
          INSERT INTO sessions (
            user_id,
            token_hash,
            expires_at,
            idle_expires_at,
            ip_address,
            user_agent
          )
          VALUES (
            $1,
            $2,
            now() + ($3 * interval '1 millisecond'),
            now() + ($4 * interval '1 millisecond'),
            $5,
            $6
          )
        `,
        [
          userId,
          session.hash,
          config.sessionAbsoluteMs,
          config.sessionIdleMs,
          request.ip ?? null,
          request.get('user-agent') ?? '',
        ],
      );

      await client.query(
        `
          INSERT INTO audit_logs (
            company_id,
            user_id,
            action,
            entity_type,
            entity_id,
            after_data,
            ip_address,
            user_agent,
            request_id
          )
          VALUES ($1, $2, 'system.setup', 'company', $3, $4, $5, $6, $7)
        `,
        [
          companyId,
          userId,
          companyId,
          JSON.stringify({
            companyName: input.companyName,
            branchName: input.branchName,
          }),
          request.ip ?? null,
          request.get('user-agent') ?? '',
          request.requestId,
        ],
      );

      return {companyId, userId};
    });

    const user = await loadAuthenticatedUser(result.userId);
    if (!user) throw new Error('Initial admin could not be loaded');
    setSessionCookie(response, session.raw);
    response.status(201).json({data: user});
  }),
);
