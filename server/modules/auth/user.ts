import type {QueryResultRow} from 'pg';
import type {
  AmountUnit,
  AuthenticatedUser,
  WorkspaceKey,
} from '../../../shared/contracts.js';
import {query} from '../../db/pool.js';

interface UserRow extends QueryResultRow {
  id: string;
  company_id: string;
  full_name: string;
  username: string;
  preferred_amount_unit: AmountUnit;
  preferred_workspace: string | null;
}

interface RoleRow extends QueryResultRow {
  id: string;
  name: string;
  code: string;
}

interface PermissionRow extends QueryResultRow {
  permission_code: string;
}

const WORKSPACES: readonly WorkspaceKey[] = [
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
];

function workspace(value: string | null): WorkspaceKey | null {
  if (!value) return null;
  return WORKSPACES.includes(value as WorkspaceKey)
    ? (value as WorkspaceKey)
    : null;
}

export async function loadAuthenticatedUser(
  userId: string,
): Promise<AuthenticatedUser | null> {
  const userResult = await query<UserRow>(
    `
      SELECT
        id,
        company_id,
        full_name,
        username,
        preferred_amount_unit,
        preferred_workspace
      FROM users
      WHERE id = $1 AND is_active = true
    `,
    [userId],
  );

  const user = userResult.rows[0];
  if (!user) return null;

  const [rolesResult, permissionsResult] = await Promise.all([
    query<RoleRow>(
      `
        SELECT role.id, role.name, role.code
        FROM roles role
        JOIN user_roles user_role ON user_role.role_id = role.id
        WHERE user_role.user_id = $1 AND role.is_active = true
        ORDER BY role.name
      `,
      [userId],
    ),
    query<PermissionRow>(
      `
        SELECT DISTINCT role_permission.permission_code
        FROM role_permissions role_permission
        JOIN user_roles user_role
          ON user_role.role_id = role_permission.role_id
        JOIN roles role ON role.id = role_permission.role_id
        WHERE user_role.user_id = $1 AND role.is_active = true
        ORDER BY role_permission.permission_code
      `,
      [userId],
    ),
  ]);

  return {
    id: user.id,
    companyId: user.company_id,
    fullName: user.full_name,
    username: user.username,
    roles: rolesResult.rows,
    permissions: permissionsResult.rows.map((row) => row.permission_code),
    preferredAmountUnit: user.preferred_amount_unit,
    preferredWorkspace: workspace(user.preferred_workspace),
  };
}
