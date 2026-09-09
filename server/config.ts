import 'dotenv/config';
import path from 'node:path';
import {z} from 'zod';

const booleanValue = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .string()
    .min(1),
  DATABASE_SSL: booleanValue,
  TRUST_PROXY: booleanValue,
  COOKIE_SECURE: booleanValue,
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  UPLOADS_DIR: z.string().default('data/uploads'),
  BACKUPS_DIR: z.string().default('data/backups'),
  BACKUP_ENCRYPTION_KEY: z.string().optional(),
  PG_DUMP_PATH: z.string().default('pg_dump'),
  PG_RESTORE_PATH: z.string().default('pg_restore'),
});

const parsed = schema.parse(process.env);

export const config = {
  nodeEnv: parsed.NODE_ENV,
  isProduction: parsed.NODE_ENV === 'production',
  port: parsed.PORT,
  databaseUrl: parsed.DATABASE_URL,
  databaseSsl: parsed.DATABASE_SSL,
  trustProxy: parsed.TRUST_PROXY,
  cookieSecure: parsed.COOKIE_SECURE,
  sessionIdleMs: parsed.SESSION_IDLE_MINUTES * 60_000,
  sessionAbsoluteMs: parsed.SESSION_ABSOLUTE_HOURS * 3_600_000,
  uploadsDir: path.resolve(process.cwd(), parsed.UPLOADS_DIR),
  backupsDir: path.resolve(process.cwd(), parsed.BACKUPS_DIR),
  backupEncryptionKey: parsed.BACKUP_ENCRYPTION_KEY,
  pgDumpPath: parsed.PG_DUMP_PATH,
  pgRestorePath: parsed.PG_RESTORE_PATH,
} as const;
