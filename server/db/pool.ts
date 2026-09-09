import pg, {
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from 'pg';
import {config} from '../config.js';

const {Pool} = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? {rejectUnauthorized: true} : undefined,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: 'diaco-accounting',
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});

export async function query<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, [...values]);
}

export async function withTransaction<T>(
  handler: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function databaseHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
}> {
  const startedAt = performance.now();
  try {
    await query('SELECT 1');
    return {ok: true, latencyMs: Math.round(performance.now() - startedAt)};
  } catch {
    return {ok: false, latencyMs: Math.round(performance.now() - startedAt)};
  }
}
