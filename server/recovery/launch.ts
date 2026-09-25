import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {AppError} from '../common/errors.js';

const execFileAsync = promisify(execFile);
const LAUNCH_COOLDOWN_MS = 30_000;
const LOOPBACK_ADDRESSES = new Set([
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
]);

let lastLaunchAt = 0;
let launchInProgress = false;

export function isLoopbackAddress(address: string | null | undefined): boolean {
  return address ? LOOPBACK_ADDRESSES.has(address) : false;
}

function powerShellLiteral(value: string): string {
  return "'" + value.replaceAll("'", "''") + "'";
}

async function findNpmCommand(): Promise<string> {
  const result = await execFileAsync('where.exe', ['npm.cmd'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const npmCommand = result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean);
  if (!npmCommand) {
    throw new Error('npm.cmd پیدا نشد.');
  }
  return npmCommand;
}

export async function launchAdminRecovery(): Promise<void> {
  if (process.platform !== 'win32') {
    throw new AppError(
      409,
      'RECOVERY_WINDOWS_REQUIRED',
      'ابزار بازیابی فقط روی کامپیوتر سرور ویندوز اجرا می‌شود.',
    );
  }

  if (
    launchInProgress ||
    (lastLaunchAt > 0 && Date.now() - lastLaunchAt < LAUNCH_COOLDOWN_MS)
  ) {
    throw new AppError(
      429,
      'RECOVERY_LAUNCH_THROTTLED',
      'درخواست بازیابی به‌تازگی اجرا شده است؛ پنجره ویندوز را بررسی کنید.',
    );
  }

  launchInProgress = true;
  try {
    const npmCommand = await findNpmCommand();
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new AppError(
        500,
        'RECOVERY_DATABASE_CONFIG_MISSING',
        'تنظیم اتصال دیتابیس برای ابزار بازیابی در دسترس نیست.',
      );
    }
    const script = [
      "$ErrorActionPreference = 'Stop';",
      '$env:DATABASE_URL = ' + powerShellLiteral(databaseUrl) + ';',
      'Start-Process',
      '-FilePath ' + powerShellLiteral(npmCommand),
      "-ArgumentList @('run','recovery')",
      '-WorkingDirectory ' + powerShellLiteral(process.cwd()),
      '-Verb RunAs',
      '-WindowStyle Hidden',
    ].join(' ');

    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      {
        encoding: 'utf8',
        timeout: 60_000,
        windowsHide: true,
      },
    );
    lastLaunchAt = Date.now();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      500,
      'RECOVERY_LAUNCH_FAILED',
      'اجرای ابزار بازیابی تأیید نشد. پنجره دسترسی ویندوز را بررسی و دوباره تلاش کنید.',
    );
  } finally {
    launchInProgress = false;
  }
}
