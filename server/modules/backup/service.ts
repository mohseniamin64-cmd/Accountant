import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
} from 'node:fs';
import {
  appendFile,
  mkdir,
  open,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {AppError} from '../../common/errors.js';
import {config} from '../../config.js';
import {query} from '../../db/pool.js';

const execFileAsync = promisify(execFile);
const MAGIC = Buffer.from('DIACOBK1', 'ascii');
const IV_BYTES = 12;
const TAG_BYTES = 16;

type BackupType = 'local' | 'external_drive';
type TriggerType =
  | 'manual'
  | 'scheduled'
  | 'end_of_day'
  | 'server_shutdown'
  | 'drive_connected';

function encryptionKey(): Buffer {
  if (!config.backupEncryptionKey) {
    throw new AppError(
      409,
      'BACKUP_KEY_NOT_CONFIGURED',
      '\u06a9\u0644\u06cc\u062f \u0631\u0645\u0632\u0646\u06af\u0627\u0631\u06cc \u067e\u0634\u062a\u06cc\u0628\u0627\u0646 \u062f\u0631 \u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u0633\u0631\u0648\u0631 \u062a\u0639\u0631\u06cc\u0641 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.',
    );
  }
  const key = Buffer.from(config.backupEncryptionKey, 'base64');
  if (key.length !== 32) {
    throw new AppError(
      500,
      'INVALID_BACKUP_KEY',
      '\u06a9\u0644\u06cc\u062f \u0631\u0645\u0632\u0646\u06af\u0627\u0631\u06cc \u067e\u0634\u062a\u06cc\u0628\u0627\u0646 \u0628\u0627\u06cc\u062f \u062f\u0642\u06cc\u0642\u0627\u064b \u06f3\u06f2 \u0628\u0627\u06cc\u062a \u0648 \u0628\u0627 \u0642\u0627\u0644\u0628 Base64 \u0628\u0627\u0634\u062f.',
    );
  }
  return key;
}

function databaseArguments(): {
  databaseUrl: string;
  environment: NodeJS.ProcessEnv;
} {
  const database = new URL(config.databaseUrl);
  const password = decodeURIComponent(database.password);
  database.password = '';
  return {
    databaseUrl: database.toString(),
    environment: {
      ...process.env,
      ...(password ? {PGPASSWORD: password} : {}),
    },
  };
}

async function encryptedFileHash(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function encryptFile(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  await writeFile(destinationPath, Buffer.concat([MAGIC, iv]), {
    flag: 'wx',
  });
  await pipeline(
    createReadStream(sourcePath),
    cipher,
    createWriteStream(destinationPath, {flags: 'a'}),
  );
  await appendFile(destinationPath, cipher.getAuthTag());
}

async function decryptFile(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  const file = await stat(sourcePath);
  if (file.size <= MAGIC.length + IV_BYTES + TAG_BYTES) {
    throw new AppError(422, 'INVALID_BACKUP_FILE', '\u0641\u0627\u06cc\u0644 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.');
  }
  const handle = await open(sourcePath, 'r');
  const prefix = Buffer.alloc(MAGIC.length + IV_BYTES);
  const tag = Buffer.alloc(TAG_BYTES);
  try {
    await handle.read(prefix, 0, prefix.length, 0);
    await handle.read(tag, 0, TAG_BYTES, file.size - TAG_BYTES);
  } finally {
    await handle.close();
  }
  if (!prefix.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new AppError(
      422,
      'INVALID_BACKUP_FILE',
      '\u0627\u0645\u0636\u0627\u06cc \u0641\u0627\u06cc\u0644 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.',
    );
  }
  const iv = prefix.subarray(MAGIC.length);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  await pipeline(
    createReadStream(sourcePath, {
      start: MAGIC.length + IV_BYTES,
      end: file.size - TAG_BYTES - 1,
    }),
    decipher,
    createWriteStream(destinationPath, {flags: 'wx'}),
  );
}

async function externalBackupPath(companyId: string): Promise<string> {
  const result = await query<{backup_path: string | null}>(
    `
      SELECT setting_value ->> 'path' AS backup_path
      FROM app_settings
      WHERE company_id = $1
        AND scope_type = 'company'
        AND scope_id = $1
        AND setting_key = 'backup.external_drive'
    `,
    [companyId],
  );
  const configured = result.rows[0]?.backup_path;
  if (!configured) {
    throw new AppError(
      409,
      'EXTERNAL_BACKUP_PATH_NOT_CONFIGURED',
      '\u0645\u0633\u06cc\u0631 \u062d\u0627\u0641\u0638\u0647 \u062e\u0627\u0631\u062c\u06cc \u0628\u0631\u0627\u06cc \u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u200c\u06af\u06cc\u0631\u06cc \u062a\u0639\u0631\u06cc\u0641 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.',
    );
  }
  const resolved = path.resolve(configured);
  if (!path.isAbsolute(configured) || resolved === path.parse(resolved).root) {
    throw new AppError(
      422,
      'UNSAFE_BACKUP_PATH',
      '\u0645\u0633\u06cc\u0631 \u062d\u0627\u0641\u0638\u0647 \u062e\u0627\u0631\u062c\u06cc \u0645\u0639\u062a\u0628\u0631 \u06cc\u0627 \u0627\u06cc\u0645\u0646 \u0646\u06cc\u0633\u062a.',
    );
  }
  const details = await stat(resolved).catch(() => null);
  if (!details?.isDirectory()) {
    throw new AppError(
      409,
      'EXTERNAL_DRIVE_NOT_AVAILABLE',
      '\u062d\u0627\u0641\u0638\u0647 \u062e\u0627\u0631\u062c\u06cc \u062f\u0631 \u062f\u0633\u062a\u0631\u0633 \u0646\u06cc\u0633\u062a.',
    );
  }
  return resolved;
}

export async function runBackup(input: {
  companyId: string;
  userId: string | null;
  backupType: BackupType;
  triggerType: TriggerType;
}): Promise<{
  id: string;
  storagePath: string;
  byteSize: string;
  sha256: string;
}> {
  const runResult = await query<{id: string}>(
    `
      INSERT INTO backup_runs (
        company_id,
        backup_type,
        trigger_type,
        status,
        requested_by
      )
      VALUES ($1, $2, $3, 'running', $4)
      RETURNING id
    `,
    [
      input.companyId,
      input.backupType,
      input.triggerType,
      input.userId,
    ],
  );
  const runId = runResult.rows[0]?.id;
  if (!runId) throw new Error('Backup run was not created');

  await mkdir(config.backupsDir, {recursive: true});
  const temporaryPath = path.join(config.backupsDir, `.${runId}.dump`);
  let encryptedPath: string | null = null;
  try {
    const targetDirectory =
      input.backupType === 'external_drive'
        ? await externalBackupPath(input.companyId)
        : config.backupsDir;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    encryptedPath = path.join(
      targetDirectory,
      `diaco-${timestamp}-${runId}.dump.enc`,
    );
    const database = databaseArguments();
    await execFileAsync(
      config.pgDumpPath,
      [
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        '--file',
        temporaryPath,
        '--dbname',
        database.databaseUrl,
      ],
      {
        env: database.environment,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
    );
    await encryptFile(temporaryPath, encryptedPath);
    const file = await stat(encryptedPath);
    const sha256 = await encryptedFileHash(encryptedPath);
    await query(
      `
        UPDATE backup_runs
        SET
          status = 'succeeded',
          storage_path = $2,
          byte_size = $3,
          sha256 = $4,
          encrypted = true,
          completed_at = now()
        WHERE id = $1
      `,
      [runId, encryptedPath, file.size.toString(), sha256],
    );
    return {
      id: runId,
      storagePath: encryptedPath,
      byteSize: file.size.toString(),
      sha256,
    };
  } catch (error) {
    if (encryptedPath) {
      await rm(encryptedPath, {force: true}).catch(() => undefined);
    }
    const message =
      error instanceof Error ? error.message.slice(0, 2000) : 'Backup failed';
    await query(
      `
        UPDATE backup_runs
        SET status = 'failed', error_message = $2, completed_at = now()
        WHERE id = $1
      `,
      [runId, message],
    );
    throw error;
  } finally {
    await rm(temporaryPath, {force: true}).catch(() => undefined);
  }
}

export async function verifyBackup(input: {
  companyId: string;
  backupRunId: string;
  userId: string;
}): Promise<{id: string; verifiedBackupRunId: string}> {
  const sourceResult = await query<{
    storage_path: string;
    sha256: string;
  }>(
    `
      SELECT storage_path, sha256
      FROM backup_runs
      WHERE id = $1
        AND company_id = $2
        AND status = 'succeeded'
        AND storage_path IS NOT NULL
        AND sha256 IS NOT NULL
    `,
    [input.backupRunId, input.companyId],
  );
  const source = sourceResult.rows[0];
  if (!source) {
    throw new AppError(
      404,
      'BACKUP_NOT_FOUND',
      '\u0646\u0633\u062e\u0647 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646 \u0645\u0648\u0641\u0642 \u0628\u0631\u0627\u06cc \u0628\u0631\u0631\u0633\u06cc \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.',
    );
  }
  const currentHash = await encryptedFileHash(source.storage_path);
  if (currentHash !== source.sha256) {
    throw new AppError(
      409,
      'BACKUP_HASH_MISMATCH',
      '\u0641\u0627\u06cc\u0644 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646 \u067e\u0633 \u0627\u0632 \u0627\u06cc\u062c\u0627\u062f \u062a\u063a\u06cc\u06cc\u0631 \u06a9\u0631\u062f\u0647 \u06cc\u0627 \u0622\u0633\u06cc\u0628 \u062f\u06cc\u062f\u0647 \u0627\u0633\u062a.',
    );
  }
  await mkdir(config.backupsDir, {recursive: true});
  const temporaryPath = path.join(
    config.backupsDir,
    `.${input.backupRunId}.verify.dump`,
  );
  try {
    await decryptFile(source.storage_path, temporaryPath);
    await execFileAsync(
      config.pgRestorePath,
      ['--list', temporaryPath],
      {
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    const result = await query<{id: string}>(
      `
        INSERT INTO backup_runs (
          company_id,
          backup_type,
          trigger_type,
          status,
          storage_path,
          encrypted,
          completed_at,
          requested_by,
          metadata
        )
        VALUES (
          $1,
          'restore_verification',
          'manual',
          'succeeded',
          $2,
          true,
          now(),
          $3,
          jsonb_build_object('verifiedBackupRunId', $4::text)
        )
        RETURNING id
      `,
      [
        input.companyId,
        source.storage_path,
        input.userId,
        input.backupRunId,
      ],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error('Backup verification was not recorded');
    return {id, verifiedBackupRunId: input.backupRunId};
  } finally {
    await rm(temporaryPath, {force: true}).catch(() => undefined);
  }
}
