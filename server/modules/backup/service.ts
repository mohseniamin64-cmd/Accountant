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
import {query, withTransaction} from '../../db/pool.js';

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

type DatabaseArguments = {
  databaseUrl: string;
  environment: NodeJS.ProcessEnv;
  username: string;
  databaseName: string;
};

export type BackupInstallationIdentity = {
  serial: string;
  appVersion: string;
  filenamePattern: string;
};

type StartedBackupRun = {
  id: string;
  fileName: string;
  metadata: Record<string, string | number>;
};

const INSTALLATION_SETTING_KEY = 'backup.installation_identity';
const installationSerialPattern = /^[A-Z0-9][A-Z0-9-]{5,47}$/;

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

function createInstallationSerial(): string {
  return `DIA-${randomBytes(5).toString('hex').toUpperCase()}`;
}

function validInstallationSerial(value: unknown): value is string {
  return typeof value === 'string' && installationSerialPattern.test(value);
}

function safeFileSegment(value: string, fallback: string): string {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return normalized || fallback;
}

function jalaliParts(date: Date): {date: string; time: string} {
  const calendarParts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const clockParts = new Intl.DateTimeFormat('en-US-u-nu-latn', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const take = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find((part) => part.type === type)?.value ?? '00';
  return {
    date: `${take(calendarParts, 'year')}${take(calendarParts, 'month')}${take(calendarParts, 'day')}`,
    time: `${take(clockParts, 'hour')}${take(clockParts, 'minute')}${take(clockParts, 'second')}`,
  };
}

function backupFilename(input: {
  companyName: string;
  serial: string;
  jalaliDate: string;
  jalaliTime: string;
  dailySequence: number;
}): string {
  const company = safeFileSegment(input.companyName, 'company');
  const version = safeFileSegment(config.appVersion, '0');
  const sequence = String(input.dailySequence).padStart(3, '0');
  return `${company}-v${version}-${input.serial}-${input.jalaliDate}-${input.jalaliTime}-V${sequence}.dump.enc`;
}

export async function getBackupInstallationIdentity(input: {
  companyId: string;
  userId: string | null;
}): Promise<BackupInstallationIdentity> {
  return withTransaction(async (client) => {
    const existing = await client.query<{setting_value: {serial?: unknown}}>(
      `
        SELECT setting_value
        FROM app_settings
        WHERE company_id = $1
          AND scope_type = 'company'
          AND scope_id = $1
          AND setting_key = $2
        FOR UPDATE
      `,
      [input.companyId, INSTALLATION_SETTING_KEY],
    );
    const stored = existing.rows[0]?.setting_value?.serial;
    const serial = validInstallationSerial(stored)
      ? stored
      : createInstallationSerial();
    if (!validInstallationSerial(stored)) {
      await client.query(
        `
          INSERT INTO app_settings (
            company_id, scope_type, scope_id, setting_key, setting_value, updated_by
          )
          VALUES ($1, 'company', $1, $2, $3, $4)
          ON CONFLICT (company_id, scope_type, scope_id, setting_key)
          DO UPDATE SET
            setting_value = EXCLUDED.setting_value,
            updated_by = EXCLUDED.updated_by,
            row_version = app_settings.row_version + 1
        `,
        [input.companyId, INSTALLATION_SETTING_KEY, JSON.stringify({serial}), input.userId],
      );
    }
    return {
      serial,
      appVersion: config.appVersion,
      filenamePattern: 'نام شرکت · نسخه برنامه · شناسه نصب · تاریخ و ساعت شمسی · V001',
    };
  });
}

async function startBackupRun(input: {
  companyId: string;
  userId: string | null;
  backupType: BackupType;
  triggerType: TriggerType;
}): Promise<StartedBackupRun> {
  const createdAt = new Date();
  const jalali = jalaliParts(createdAt);
  const identity = await getBackupInstallationIdentity({
    companyId: input.companyId,
    userId: input.userId,
  });
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `backup:${input.companyId}:${jalali.date}`,
    ]);
    const [company, sequence] = await Promise.all([
      client.query<{name: string}>('SELECT name_fa AS name FROM companies WHERE id = $1', [input.companyId]),
      client.query<{next_sequence: number}>(
        `
          SELECT (count(*) + 1)::integer AS next_sequence
          FROM backup_runs
          WHERE company_id = $1
            AND (started_at AT TIME ZONE 'Asia/Tehran')::date =
              (now() AT TIME ZONE 'Asia/Tehran')::date
        `,
        [input.companyId],
      ),
    ]);
    const companyName = company.rows[0]?.name ?? 'company';
    const dailySequence = sequence.rows[0]?.next_sequence ?? 1;
    const fileName = backupFilename({
      companyName,
      serial: identity.serial,
      jalaliDate: jalali.date,
      jalaliTime: jalali.time,
      dailySequence,
    });
    const metadata = {
      companyName,
      installationSerial: identity.serial,
      applicationVersion: identity.appVersion,
      jalaliDate: jalali.date,
      jalaliTime: jalali.time,
      dailySequence,
      fileName,
    };
    const run = await client.query<{id: string}>(
      `
        INSERT INTO backup_runs (
          company_id, backup_type, trigger_type, status, requested_by, metadata
        )
        VALUES ($1, $2, $3, 'running', $4, $5)
        RETURNING id
      `,
      [
        input.companyId,
        input.backupType,
        input.triggerType,
        input.userId,
        JSON.stringify(metadata),
      ],
    );
    const id = run.rows[0]?.id;
    if (!id) throw new Error('Backup run was not created');
    return {id, fileName, metadata};
  });
}

function databaseArguments(): DatabaseArguments {
  const database = new URL(config.databaseUrl);
  const password = decodeURIComponent(database.password);
  const username = decodeURIComponent(database.username);
  const databaseName = decodeURIComponent(database.pathname.replace(/^\//, ''));
  database.password = '';
  return {
    databaseUrl: database.toString(),
    environment: {
      ...process.env,
      ...(password ? {PGPASSWORD: password} : {}),
    },
    username,
    databaseName,
  };
}

function commandWasNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function dockerBackupContainer(): string | null {
  return config.backupDockerContainer ?? null;
}

function dockerTemporaryDumpPath(localPath: string): string {
  return `/tmp/${path.basename(localPath)}`;
}

async function removeDockerTemporaryFile(
  container: string,
  temporaryPath: string,
): Promise<void> {
  await execFileAsync('docker', ['exec', container, 'rm', '-f', temporaryPath], {
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  }).catch(() => undefined);
}

async function dumpDatabaseWithDocker(
  database: DatabaseArguments,
  localPath: string,
  container: string,
): Promise<void> {
  const containerPath = dockerTemporaryDumpPath(localPath);
  try {
    await execFileAsync(
      'docker',
      [
        'exec',
        container,
        'pg_dump',
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        '--file',
        containerPath,
        '--username',
        database.username,
        '--dbname',
        database.databaseName,
      ],
      {windowsHide: true, maxBuffer: 1024 * 1024},
    );
    await execFileAsync('docker', ['cp', `${container}:${containerPath}`, localPath], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
  } finally {
    await removeDockerTemporaryFile(container, containerPath);
  }
}

async function dumpDatabase(localPath: string): Promise<void> {
  const database = databaseArguments();
  try {
    await execFileAsync(
      config.pgDumpPath,
      [
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        '--file',
        localPath,
        '--dbname',
        database.databaseUrl,
      ],
      {
        env: database.environment,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
    );
  } catch (error) {
    const container = dockerBackupContainer();
    if (!commandWasNotFound(error) || !container) throw error;
    await dumpDatabaseWithDocker(database, localPath, container);
  }
}

async function verifyDatabaseDumpWithDocker(
  localPath: string,
  container: string,
): Promise<void> {
  const containerPath = dockerTemporaryDumpPath(localPath);
  try {
    await execFileAsync('docker', ['cp', localPath, `${container}:${containerPath}`], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    await execFileAsync(
      'docker',
      ['exec', container, 'pg_restore', '--list', containerPath],
      {windowsHide: true, maxBuffer: 10 * 1024 * 1024},
    );
  } finally {
    await removeDockerTemporaryFile(container, containerPath);
  }
}

async function verifyDatabaseDump(localPath: string): Promise<void> {
  try {
    await execFileAsync(
      config.pgRestorePath,
      ['--list', localPath],
      {windowsHide: true, maxBuffer: 10 * 1024 * 1024},
    );
  } catch (error) {
    const container = dockerBackupContainer();
    if (!commandWasNotFound(error) || !container) throw error;
    await verifyDatabaseDumpWithDocker(localPath, container);
  }
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
  const startedRun = await startBackupRun(input);
  const runId = startedRun.id;

  await mkdir(config.backupsDir, {recursive: true});
  const temporaryPath = path.join(config.backupsDir, `.${runId}.dump`);
  let encryptedPath: string | null = null;
  try {
    const targetDirectory =
      input.backupType === 'external_drive'
        ? await externalBackupPath(input.companyId)
        : config.backupsDir;
    encryptedPath = path.join(
      targetDirectory,
      startedRun.fileName,
    );
    await dumpDatabase(temporaryPath);
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
    await verifyDatabaseDump(temporaryPath);
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
