import type {QueryResultRow} from 'pg';
import {AppError} from '../common/errors.js';
import {hashPassword, validPassword} from '../common/security.js';
import {withTransaction} from '../db/pool.js';

export interface RecoverableAdmin {
  id: string;
  username: string;
  fullName: string;
}

interface AdminRow extends QueryResultRow {
  id: string;
  company_id: string;
  username: string;
  full_name: string;
}

export async function listRecoverableAdmins(): Promise<readonly RecoverableAdmin[]> {
  return withTransaction(async (client) => {
    const result = await client.query<AdminRow>(
      `
        SELECT DISTINCT
          "user".id,
          "user".username,
          "user".full_name
        FROM users "user"
        JOIN user_roles user_role ON user_role.user_id = "user".id
        JOIN roles role ON role.id = user_role.role_id
        WHERE "user".is_active = true
          AND role.code = 'administrator'
          AND role.is_system = true
          AND role.is_active = true
        ORDER BY "user".created_at
      `,
    );
    return result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      fullName: row.full_name,
    }));
  });
}

export async function recoverAdminPassword(
  userId: string,
  password: string,
): Promise<{sessionsInvalidated: number}> {
  if (!validPassword(password)) {
    throw new AppError(
      422,
      'WEAK_PASSWORD',
      'رمز باید حداقل ۱۰ نویسه و شامل حرف بزرگ انگلیسی، حرف کوچک انگلیسی و عدد باشد.',
    );
  }

  const passwordHash = await hashPassword(password);
  return withTransaction(async (client) => {
    const userResult = await client.query<AdminRow>(
      `
        SELECT
          "user".id,
          "user".company_id,
          "user".username,
          "user".full_name
        FROM users "user"
        JOIN user_roles user_role ON user_role.user_id = "user".id
        JOIN roles role ON role.id = user_role.role_id
        WHERE "user".id = $1
          AND "user".is_active = true
          AND role.code = 'administrator'
          AND role.is_system = true
          AND role.is_active = true
        FOR UPDATE OF "user"
      `,
      [userId],
    );
    const user = userResult.rows[0];
    if (!user) {
      throw new AppError(
        404,
        'ADMIN_NOT_FOUND',
        'مدیر فعال انتخاب‌شده پیدا نشد.',
      );
    }

    await client.query(
      `
        UPDATE users
        SET
          password_hash = $2,
          must_change_password = false,
          failed_login_count = 0,
          locked_until = NULL,
          row_version = row_version + 1
        WHERE id = $1
      `,
      [user.id, passwordHash],
    );
    const sessions = await client.query(
      'DELETE FROM sessions WHERE user_id = $1',
      [user.id],
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
          metadata
        )
        VALUES ($1, NULL, 'admin.password.recovered', 'user', $2, $3, $4)
      `,
      [
        user.company_id,
        user.id,
        JSON.stringify({
          accountUnlocked: true,
          sessionsInvalidated: sessions.rowCount ?? 0,
        }),
        JSON.stringify({initiatedBy: 'local_windows_administrator'}),
      ],
    );
    return {sessionsInvalidated: sessions.rowCount ?? 0};
  });
}
