import {stat} from 'node:fs/promises';
import {query} from '../../db/pool.js';
import {runBackup} from './service.js';

interface BackupPolicy {
  scheduled?: boolean;
  scheduleTime?: string;
  endOfDay?: boolean;
  onDriveConnected?: boolean;
  onServerShutdown?: boolean;
}

interface PolicyRow {
  company_id: string;
  policy: BackupPolicy;
  external_path: string | null;
}

const runningCompanies = new Set<string>();
const driveAvailability = new Map<string, boolean>();

function tehranClock(): {date: string; time: string} {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  return {date, time};
}

async function policies(): Promise<PolicyRow[]> {
  const result = await query<PolicyRow>(
    `
      SELECT
        policy.company_id,
        policy.setting_value AS policy,
        external.setting_value ->> 'path' AS external_path
      FROM app_settings policy
      LEFT JOIN app_settings external
        ON external.company_id = policy.company_id
        AND external.scope_type = 'company'
        AND external.scope_id = policy.company_id
        AND external.setting_key = 'backup.external_drive'
      WHERE policy.scope_type = 'company'
        AND policy.scope_id = policy.company_id
        AND policy.setting_key = 'backup.policy'
    `,
  );
  return result.rows;
}

async function alreadyRunToday(
  companyId: string,
  backupType: 'local' | 'external_drive',
  triggerType: 'scheduled' | 'end_of_day' | 'drive_connected',
  date: string,
): Promise<boolean> {
  const result = await query(
    `
      SELECT 1
      FROM backup_runs
      WHERE company_id = $1
        AND backup_type = $2
        AND trigger_type = $3
        AND status IN ('running', 'succeeded')
        AND (started_at AT TIME ZONE 'Asia/Tehran')::date = $4::date
      LIMIT 1
    `,
    [companyId, backupType, triggerType, date],
  );
  return Boolean(result.rowCount);
}

async function runOnce(
  companyId: string,
  backupType: 'local' | 'external_drive',
  triggerType: 'scheduled' | 'end_of_day' | 'drive_connected',
): Promise<void> {
  if (runningCompanies.has(companyId)) return;
  const clock = tehranClock();
  if (await alreadyRunToday(companyId, backupType, triggerType, clock.date)) {
    return;
  }
  runningCompanies.add(companyId);
  try {
    await runBackup({
      companyId,
      userId: null,
      backupType,
      triggerType,
    });
  } catch (error) {
    console.error(
      `Automatic ${triggerType} backup failed for company ${companyId}`,
      error,
    );
  } finally {
    runningCompanies.delete(companyId);
  }
}

async function tick(): Promise<void> {
  const clock = tehranClock();
  for (const row of await policies()) {
    const policy = row.policy ?? {};
    const scheduleTime = policy.scheduleTime ?? '18:00';
    if (clock.time === scheduleTime) {
      if (policy.endOfDay) {
        void runOnce(row.company_id, 'local', 'end_of_day');
      } else if (policy.scheduled) {
        void runOnce(row.company_id, 'local', 'scheduled');
      }
    }
    if (policy.onDriveConnected && row.external_path) {
      const available = Boolean(
        (await stat(row.external_path).catch(() => null))?.isDirectory(),
      );
      const previous = driveAvailability.get(row.company_id) ?? false;
      driveAvailability.set(row.company_id, available);
      if (available && !previous) {
        void runOnce(row.company_id, 'external_drive', 'drive_connected');
      }
    }
  }
}

export function startBackupScheduler(): () => void {
  const timer = setInterval(() => {
    void tick().catch((error) => {
      console.error('Backup scheduler tick failed', error);
    });
  }, 60_000);
  timer.unref();
  void tick().catch((error) => {
    console.error('Initial backup scheduler tick failed', error);
  });
  return () => clearInterval(timer);
}

export async function runShutdownBackups(): Promise<void> {
  for (const row of await policies()) {
    if (!row.policy?.onServerShutdown) continue;
    if (runningCompanies.has(row.company_id)) continue;
    runningCompanies.add(row.company_id);
    try {
      await runBackup({
        companyId: row.company_id,
        userId: null,
        backupType: 'local',
        triggerType: 'server_shutdown',
      });
    } catch (error) {
      console.error(
        `Server shutdown backup failed for company ${row.company_id}`,
        error,
      );
    } finally {
      runningCompanies.delete(row.company_id);
    }
  }
}
