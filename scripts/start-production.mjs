import {access} from 'node:fs/promises';

const serverEntry = new URL('../dist/server.cjs', import.meta.url);
await access(serverEntry);

process.env.NODE_ENV = 'production';
process.env.PORT ??= '4173';
await import(serverEntry.href);

