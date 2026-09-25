import {z} from 'zod';
import {config} from '../../config.js';
import {query} from '../../db/pool.js';

export const sessionSecuritySchema = z.object({
  idleMinutes: z.number().int().min(1).max(90).default(30),
  loginLockEnabled: z.boolean().default(true),
  maxFailedLoginAttempts: z.number().int().min(1).max(20).default(5),
  loginLockMinutes: z.number().int().min(1).max(1440).default(15),
});

const defaultSessionSecurity: SessionSecuritySettings = {
  idleMinutes: 30,
  loginLockEnabled: true,
  maxFailedLoginAttempts: 5,
  loginLockMinutes: 15,
};

export type SessionSecuritySettings = z.infer<typeof sessionSecuritySchema>;

export async function loadSessionSecuritySettings(
  companyId: string,
): Promise<SessionSecuritySettings> {
  const result = await query<{setting_value: unknown}>(
    `
      SELECT setting_value
      FROM app_settings
      WHERE company_id = $1
        AND scope_type = 'company'
        AND scope_id = $1
        AND setting_key = 'auth.session_security'
    `,
    [companyId],
  );
  const stored = z
    .object({
      idleMinutes: z.number().int().min(1).max(90).optional(),
      loginLockEnabled: z.boolean().optional(),
      maxFailedLoginAttempts: z.number().int().min(1).max(20).optional(),
      loginLockMinutes: z.number().int().min(1).max(1440).optional(),
    })
    .safeParse(result.rows[0]?.setting_value);
  const idleMinutes = Math.min(90, Math.max(1, Math.round(config.sessionIdleMs / 60_000)));
  return {
    idleMinutes: stored.success ? stored.data.idleMinutes ?? idleMinutes : idleMinutes,
    loginLockEnabled: stored.success
      ? stored.data.loginLockEnabled ?? defaultSessionSecurity.loginLockEnabled
      : defaultSessionSecurity.loginLockEnabled,
    maxFailedLoginAttempts: stored.success
      ? stored.data.maxFailedLoginAttempts ?? defaultSessionSecurity.maxFailedLoginAttempts
      : defaultSessionSecurity.maxFailedLoginAttempts,
    loginLockMinutes: stored.success
      ? stored.data.loginLockMinutes ?? defaultSessionSecurity.loginLockMinutes
      : defaultSessionSecurity.loginLockMinutes,
  };
}

export async function loadSessionIdleMs(companyId: string): Promise<number> {
  return (await loadSessionSecuritySettings(companyId)).idleMinutes * 60_000;
}
