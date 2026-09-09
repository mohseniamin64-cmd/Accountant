import {cp, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'server', 'db', 'migrations');
const destination = path.join(root, 'dist', 'migrations');

await mkdir(destination, {recursive: true});
await cp(source, destination, {recursive: true});
