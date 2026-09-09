import {createHash} from 'node:crypto';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import type {PoolClient} from 'pg';
import {pool} from './pool.js';

function migrationDirectory(): string {
  return process.env.NODE_ENV === 'production'
    ? path.join(process.cwd(), 'dist', 'migrations')
    : path.join(process.cwd(), 'server', 'db', 'migrations');
}

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function migrateDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [748_221_905]);
    await ensureMigrationTable(client);

    const files = (await readdir(migrationDirectory()))
      .filter((name) => name.endsWith('.sql'))
      .sort((left, right) => left.localeCompare(right));

    for (const name of files) {
      const sql = await readFile(path.join(migrationDirectory(), name), 'utf8');
      const digest = checksum(sql);
      const existing = await client.query<{checksum: string}>(
        'SELECT checksum FROM schema_migrations WHERE name = $1',
        [name],
      );

      if (existing.rowCount) {
        if (existing.rows[0]?.checksum !== digest) {
          throw new Error(`Migration checksum mismatch: ${name}`);
        }
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
          [name, digest],
        );
        await client.query('COMMIT');
        console.info(`Applied database migration: ${name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [748_221_905]);
    client.release();
  }
}
