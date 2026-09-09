import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import {createServer as createHttpServer} from 'node:http';
import {
  attachApiNotFound,
  attachErrorHandler,
  configureApi,
} from './app.js';
import {config} from './config.js';
import {migrateDatabase} from './db/migrate.js';
import {pool} from './db/pool.js';

import {
  runShutdownBackups,
  startBackupScheduler,
} from './modules/backup/scheduler.js';
async function start(): Promise<void> {
  await migrateDatabase();
  await Promise.all([
    mkdir(config.uploadsDir, {recursive: true}),
    mkdir(config.backupsDir, {recursive: true}),
  ]);

  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1);
  configureApi(app);
  attachApiNotFound(app);

  if (config.isProduction) {
    const distribution = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distribution, {index: false, maxAge: '1h'}));
    app.get('*', (_request, response) => {
      response.sendFile(path.join(distribution, 'index.html'));
    });
  } else {
    const {createServer} = await import('vite');
    const vite = await createServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  attachErrorHandler(app);
  const server = createHttpServer(app);

  await new Promise<void>((resolve) => {
    server.listen(config.port, '0.0.0.0', resolve);
  });

  console.info(
    `Diaco accounting server is available on port ${config.port}.`,
  );

  const stopBackupScheduler = startBackupScheduler();
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    stopBackupScheduler();
    console.info(`Received ${signal}; shutting down.`);
    server.close(async () => {
      await runShutdownBackups();
      await pool.end();
      process.exit(0);
    });

    setTimeout(() => {
      process.exit(1);
    }, 120_000).unref();
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch(async (error: unknown) => {
  console.error('Server startup failed', error);
  await pool.end();
  process.exit(1);
});
