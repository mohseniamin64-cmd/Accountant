import {migrateDatabase} from './migrate.js';
import {pool} from './pool.js';

try {
  await migrateDatabase();
  console.info('Database migrations are up to date.');
} finally {
  await pool.end();
}
