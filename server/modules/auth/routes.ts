import {Router} from 'express';
import type {QueryResultRow} from 'pg';
import {z} from 'zod';
import {AppError, asyncRoute} from '../../common/errors.js';
import {
  createSessionToken,
  hashPassword,
  parseCookies,
  verifyPassword,
} from '../../common/security.js';
import {config} from '../../config.js';
import {query, withTransaction} from '../../db/pool.js';
import {
  requireAuthentication,
} from './middleware.js';
import {
  clearSessionCookie,
  SESSION_COOKIE,
  setSessionCookie,
} from './session-cookie.js';
import {loadAuthenticatedUser} from './user.js';

interface LoginUserRow extends QueryResultRow {
  id: string;
  password_hash: string;
  failed_login_count: number;
  locked_until: Date | null;
}

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(256),
});

const preferencesSchema = z.object({
  preferredAmountUnit: z.enum(['IRR', 'TOMAN']),
  preferredWorkspace: z
    .enum([
      'home',
      'accounting',
      'treasury',
      'inventory',
      'purchases',
      'sales',
      'production',
      'service',
      'reports',
      'settings',
    ])
    .nullable(),
});

const dummyHashPromise = hashPassword('TimingOnlyPassword123');

export const authRouter = Router();

authRouter.post(
  '/login',
  asyncRoute(async (request, response) => {
    const input = loginSchema.parse(request.body);
    const normalizedUsername = input.username.toLocaleLowerCase('en-US');
    const sessionToken = createSessionToken();
    const absoluteExpiry = new Date(Date.now() + config.sessionAbsoluteMs);
    const idleExpiry = new Date(Date.now() + config.sessionIdleMs);

    const result = await withTransaction(async (client) => {
      const userResult = await client.query<LoginUserRow>(
        `
          SELECT
            "user".id,
            "user".password_hash,
            "user".failed_login_count,
            "user".locked_until
          FROM users "user"
          JOIN companies company ON company.id = "user".company_id
          WHERE lower("user".username) = $1
            AND "user".is_active = true
            AND company.is_active = true
          ORDER BY "user".created_at
          LIMIT 2
          FOR UPDATE OF "user"
        `,
        [normalizedUsername],
      );

      if (userResult.rows.length !== 1) {
        await verifyPassword(input.password, await dummyHashPromise);
        await client.query(
          `
            INSERT INTO login_attempts (
              username,
              ip_address,
              was_successful
            )
            VALUES ($1, $2, false)
          `,
          [normalizedUsername, request.ip ?? null],
        );
        return {ok: false as const, locked: false};
      }

      const user = userResult.rows[0];
      if (!user) return {ok: false as const, locked: false};

      if (user.locked_until && user.locked_until.getTime() > Date.now()) {
        await client.query(
          `
            INSERT INTO login_attempts (
              username,
              ip_address,
              was_successful
            )
            VALUES ($1, $2, false)
          `,
          [normalizedUsername, request.ip ?? null],
        );
        return {ok: false as const, locked: true};
      }

      const passwordMatches = await verifyPassword(
        input.password,
        user.password_hash,
      );

      if (!passwordMatches) {
        const failedCount = user.failed_login_count + 1;
        await client.query(
          `
            UPDATE users
            SET
              failed_login_count = $2,
              locked_until = CASE
                WHEN $2 >= 5 THEN now() + interval '15 minutes'
                ELSE NULL
              END
            WHERE id = $1
          `,
          [user.id, failedCount],
        );
        await client.query(
          `
            INSERT INTO login_attempts (
              username,
              ip_address,
              was_successful
            )
            VALUES ($1, $2, false)
          `,
          [normalizedUsername, request.ip ?? null],
        );
        return {ok: false as const, locked: failedCount >= 5};
      }

      await client.query(
        `
          UPDATE users
          SET
            failed_login_count = 0,
            locked_until = NULL,
            last_login_at = now()
          WHERE id = $1
        `,
        [user.id],
      );

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
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          user.id,
          sessionToken.hash,
          absoluteExpiry,
          idleExpiry,
          request.ip ?? null,
          request.get('user-agent') ?? '',
        ],
      );

      await client.query(
        `
          INSERT INTO login_attempts (
            username,
            ip_address,
            was_successful
          )
          VALUES ($1, $2, true)
        `,
        [normalizedUsername, request.ip ?? null],
      );

      return {ok: true as const, userId: user.id};
    });

    if (!result.ok) {
      throw new AppError(
        result.locked ? 423 : 401,
        result.locked ? 'ACCOUNT_TEMPORARILY_LOCKED' : 'INVALID_CREDENTIALS',
        result.locked
          ? 'حساب کاربری به دلیل تلاش‌های ناموفق موقتاً قفل شده است.'
          : 'نام کاربری یا رمز عبور صحیح نیست.',
      );
    }

    const user = await loadAuthenticatedUser(result.userId);
    if (!user) {
      throw new AppError(
        500,
        'USER_LOAD_FAILED',
        'بارگذاری اطلاعات کاربر با خطا روبه‌رو شد.',
      );
    }

    setSessionCookie(response, sessionToken.raw);
    response.json({data: user});
  }),
);

authRouter.post(
  '/logout',
  asyncRoute(async (request, response) => {
    const token = parseCookies(request.get('cookie'))[SESSION_COOKIE];
    if (token) {
      const {hashToken} = await import('../../common/security.js');
      await query('DELETE FROM sessions WHERE token_hash = $1', [
        hashToken(token),
      ]);
    }
    clearSessionCookie(response);
    response.status(204).end();
  }),
);

authRouter.get(
  '/me',
  requireAuthentication,
  asyncRoute(async (request, response) => {
    response.json({data: request.auth});
  }),
);

authRouter.patch(
  '/me/preferences',
  requireAuthentication,
  asyncRoute(async (request, response) => {
    const input = preferencesSchema.parse(request.body);
    const userId = request.auth?.id;
    if (!userId) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'نشست کاربری معتبر نیست.');
    }

    await query(
      `
        UPDATE users
        SET
          preferred_amount_unit = $2,
          preferred_workspace = $3,
          row_version = row_version + 1
        WHERE id = $1
      `,
      [userId, input.preferredAmountUnit, input.preferredWorkspace],
    );

    const user = await loadAuthenticatedUser(userId);
    response.json({data: user});
  }),
);
