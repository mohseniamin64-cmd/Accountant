import type {RequestHandler} from 'express';
import type {QueryResultRow} from 'pg';
import type {PermissionCode} from '../../../shared/permissions.js';
import {AppError, asyncRoute} from '../../common/errors.js';
import {query} from '../../db/pool.js';
import {hashToken, parseCookies} from '../../common/security.js';
import {clearSessionCookie, SESSION_COOKIE} from './session-cookie.js';
import {loadSessionIdleMs} from './session-policy.js';
import {loadAuthenticatedUser} from './user.js';

interface SessionRow extends QueryResultRow {
  id: string;
  user_id: string;
}

export const populateAuthentication = asyncRoute(
  async (request, response, next) => {
    const token = parseCookies(request.get('cookie'))[SESSION_COOKIE];
    if (!token) {
      next();
      return;
    }

    const result = await query<SessionRow>(
      `
        SELECT session.id, session.user_id
        FROM sessions session
        JOIN users "user" ON "user".id = session.user_id
        JOIN companies company ON company.id = "user".company_id
        WHERE session.token_hash = $1
          AND session.expires_at > now()
          AND session.idle_expires_at > now()
          AND session.revoked_at IS NULL
          AND "user".is_active = true
          AND "user".account_status = 'active'
          AND company.is_active = true
      `,
      [hashToken(token)],
    );

    const session = result.rows[0];
    if (!session) {
      clearSessionCookie(response);
      next();
      return;
    }

    const user = await loadAuthenticatedUser(session.user_id);
    if (!user) {
      clearSessionCookie(response);
      next();
      return;
    }

    request.auth = user;
    request.sessionId = session.id;
    const sessionIdleMs = await loadSessionIdleMs(user.companyId);

    await query(
      `
        UPDATE sessions
        SET
          last_seen_at = now(),
          idle_expires_at = now() + ($2 * interval '1 millisecond')
        WHERE id = $1
          AND revoked_at IS NULL
          AND last_seen_at < now() - interval '1 minute'
      `,
      [session.id, sessionIdleMs],
    );

    next();
  },
);

export const requireAuthentication: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (!request.auth) {
    next(
      new AppError(
        401,
        'AUTHENTICATION_REQUIRED',
        'برای ادامه باید وارد سامانه شوید.',
      ),
    );
    return;
  }

  next();
};

export function requirePermissions(
  ...required: readonly PermissionCode[]
): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) {
      next(
        new AppError(
          401,
          'AUTHENTICATION_REQUIRED',
          'برای ادامه باید وارد سامانه شوید.',
        ),
      );
      return;
    }

    const granted = new Set(request.auth.permissions);
    const missing = required.filter((code) => !granted.has(code));
    if (missing.length > 0) {
      next(
        new AppError(
          403,
          'PERMISSION_DENIED',
          'مجوز لازم برای انجام این عملیات به شما داده نشده است.',
          {missingPermissions: missing},
        ),
      );
      return;
    }

    next();
  };
}
