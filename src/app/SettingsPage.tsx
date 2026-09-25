import {
  ClipboardList,
  Clock3,
  CloudOff,
  Copy,
  DatabaseBackup,
  HardDrive,
  ImageUp,
  MessageSquareText,
  Printer,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {FormEvent, useCallback, useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {api, errorMessage, postJson} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {BrandLogo} from './BrandLogo.js';
import {appHelp} from './help-content.js';
import './settings.css';

interface SettingsPageProps {
  companyName: string;
  companyLogoUrl: string | null;
  permissions: readonly string[];
  onCompanyChanged: () => Promise<void>;
}

interface BackupPolicy {
  scheduled: boolean;
  scheduleTime: string;
  endOfDay: boolean;
  onDriveConnected: boolean;
  onServerShutdown: boolean;
}

interface BackupConfiguration {
  localDirectory: string;
  encryptionConfigured: boolean;
  installation: {
    serial: string;
    appVersion: string;
    filenamePattern: string;
  };
  externalDrive: {path?: string | null};
  policy: Partial<BackupPolicy>;
  googleDrive: {
    isEnabled: boolean;
    lastHealthStatus: string | null;
    lastHealthAt: string | null;
  };
}

interface BackupRun {
  id: string;
  backupType: string;
  triggerType: string;
  status: string;
  storagePath: string | null;
  byteSize: string | null;
  sha256: string | null;
  encrypted: boolean;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

interface SmsConfiguration {
  isEnabled: boolean;
  configuration: {deviceLabel?: string};
  lastHealthStatus: string | null;
  lastHealthAt: string | null;
  rowVersion: number;
}

interface SmsMessage {
  id: string;
  recipient: string;
  messageText: string;
  messageType: string;
  status: string;
  attemptCount: number;
  lastError: string | null;
  queuedAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
}

interface ServiceOutputSettings {
  intakePrintEnabled: boolean;
  paperSize: 'A4' | '80mm';
  printReceipt: boolean;
  printDeviceLabel: boolean;
}

interface SessionSecuritySettings {
  idleMinutes: number;
  loginLockEnabled: boolean;
  maxFailedLoginAttempts: number;
  loginLockMinutes: number;
}

const backupStatus: Record<string, string> = {
  running: '\u062f\u0631 \u062d\u0627\u0644 \u0627\u062c\u0631\u0627',
  succeeded: '\u0645\u0648\u0641\u0642',
  failed: '\u0646\u0627\u0645\u0648\u0641\u0642',
};

const backupType: Record<string, string> = {
  local: '\u062d\u0627\u0641\u0638\u0647 \u0633\u0631\u0648\u0631',
  external_drive: '\u062d\u0627\u0641\u0638\u0647 \u062e\u0627\u0631\u062c\u06cc',
  restore_verification: '\u0627\u0639\u062a\u0628\u0627\u0631\u0633\u0646\u062c\u06cc \u0628\u0627\u0632\u06cc\u0627\u0628\u06cc',
};

const triggerType: Record<string, string> = {
  manual: '\u062f\u0633\u062a\u06cc',
  scheduled: '\u0632\u0645\u0627\u0646\u200c\u0628\u0646\u062f\u06cc\u200c\u0634\u062f\u0647',
  end_of_day: '\u067e\u0627\u06cc\u0627\u0646 \u0631\u0648\u0632',
  server_shutdown: '\u062e\u0631\u0648\u062c \u0633\u0631\u0648\u0631',
  drive_connected: '\u0627\u062a\u0635\u0627\u0644 \u062d\u0627\u0641\u0638\u0647',
};

const smsStatus: Record<string, string> = {
  queued: '\u062f\u0631 \u0635\u0641',
  sending: '\u062f\u0631 \u062d\u0627\u0644 \u0627\u0631\u0633\u0627\u0644',
  sent: '\u0627\u0631\u0633\u0627\u0644\u200c\u0634\u062f\u0647',
  delivered: '\u062a\u062d\u0648\u06cc\u0644\u200c\u0634\u062f\u0647',
  failed: '\u0646\u0627\u0645\u0648\u0641\u0642',
  cancelled: '\u0644\u063a\u0648\u0634\u062f\u0647',
};

function shownDate(value: string | null): string {
  if (!value) return '\u2014';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Tehran',
  }).format(date);
}

function shownBytes(value: string | null): string {
  if (!value) return '\u2014';
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return value;
  const units = ['\u0628\u0627\u06cc\u062a', '\u06a9\u06cc\u0644\u0648\u0628\u0627\u06cc\u062a', '\u0645\u06af\u0627\u0628\u0627\u06cc\u062a', '\u06af\u06cc\u06af\u0627\u0628\u0627\u06cc\u062a'];
  let shown = bytes;
  let index = 0;
  while (shown >= 1024 && index < units.length - 1) {
    shown /= 1024;
    index += 1;
  }
  return `${new Intl.NumberFormat('fa-IR', {maximumFractionDigits: 1}).format(shown)} ${units[index]}`;
}

function Feedback({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) {
  if (!error && !success) return null;
  return (
    <div
      className={error ? 'form-message error' : 'form-message success'}
      role={error ? 'alert' : 'status'}
    >
      {error ?? success}
    </div>
  );
}

export function SettingsPage({
  companyName,
  companyLogoUrl,
  permissions,
  onCompanyChanged,
}: SettingsPageProps) {
  const canManageCompany = permissions.includes('system.settings.manage');
  const canBackup = permissions.includes('backup.manage');
  const canSms = permissions.includes('sms.manage');
  const [backupConfiguration, setBackupConfiguration] =
    useState<BackupConfiguration | null>(null);
  const [policy, setPolicy] = useState<BackupPolicy>({
    scheduled: false,
    scheduleTime: '18:00',
    endOfDay: true,
    onDriveConnected: true,
    onServerShutdown: false,
  });
  const [externalDrivePath, setExternalDrivePath] = useState('');
  const [installationSerial, setInstallationSerial] = useState('');
  const [backupRuns, setBackupRuns] = useState<readonly BackupRun[]>([]);
  const [smsConfiguration, setSmsConfiguration] =
    useState<SmsConfiguration | null>(null);
  const [smsMessages, setSmsMessages] = useState<readonly SmsMessage[]>([]);
  const [serviceOutput, setServiceOutput] = useState<ServiceOutputSettings | null>(null);
  const [sessionSecurity, setSessionSecurity] = useState<SessionSecuritySettings | null>(null);
  const [serviceOutputError, setServiceOutputError] = useState<string | null>(null);
  const [serviceOutputSuccess, setServiceOutputSuccess] = useState<string | null>(null);
  const [sessionSecurityError, setSessionSecurityError] = useState<string | null>(null);
  const [sessionSecuritySuccess, setSessionSecuritySuccess] = useState<string | null>(null);
  const [loginLockError, setLoginLockError] = useState<string | null>(null);
  const [loginLockSuccess, setLoginLockSuccess] = useState<string | null>(null);
  const [deviceLabel, setDeviceLabel] = useState('\u06af\u0648\u0634\u06cc \u067e\u06cc\u0627\u0645\u06a9 \u0634\u0631\u06a9\u062a');
  const [gatewayToken, setGatewayToken] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [smsSuccess, setSmsSuccess] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSuccess, setLogoSuccess] = useState<string | null>(null);

  const loadBackup = useCallback(async () => {
    if (!canBackup) return;
    const [configuration, runs] = await Promise.all([
      api<BackupConfiguration>('/api/backups/configuration'),
      api<readonly BackupRun[]>('/api/backups/runs?limit=30'),
    ]);
    setBackupConfiguration(configuration);
    setExternalDrivePath(configuration.externalDrive.path ?? '');
    setInstallationSerial(configuration.installation.serial);
    setPolicy({
      scheduled: configuration.policy.scheduled ?? false,
      scheduleTime: configuration.policy.scheduleTime ?? '18:00',
      endOfDay: configuration.policy.endOfDay ?? true,
      onDriveConnected: configuration.policy.onDriveConnected ?? true,
      onServerShutdown: configuration.policy.onServerShutdown ?? false,
    });
    setBackupRuns(runs);
  }, [canBackup]);

  const loadSms = useCallback(async () => {
    if (!canSms) return;
    const [configuration, messages] = await Promise.all([
      api<SmsConfiguration>('/api/sms/configuration'),
      api<readonly SmsMessage[]>('/api/sms/messages?limit=50'),
    ]);
    setSmsConfiguration(configuration);
    setDeviceLabel(
      configuration.configuration.deviceLabel ?? '\u06af\u0648\u0634\u06cc \u067e\u06cc\u0627\u0645\u06a9 \u0634\u0631\u06a9\u062a',
    );
    setSmsMessages(messages);
  }, [canSms]);

  const loadServiceOutput = useCallback(async () => {
    if (!canManageCompany) return;
    setServiceOutput(
      await api<ServiceOutputSettings>('/api/settings/service-output'),
    );
  }, [canManageCompany]);

  const loadSessionSecurity = useCallback(async () => {
    if (!canManageCompany) return;
    setSessionSecurity(await api<SessionSecuritySettings>('/api/settings/session-security'));
  }, [canManageCompany]);

  const reloadAll = useCallback(async () => {
    const jobs: Promise<void>[] = [];
    if (canBackup) jobs.push(loadBackup());
    if (canSms) jobs.push(loadSms());
    if (canManageCompany) jobs.push(loadServiceOutput(), loadSessionSecurity());
    await Promise.all(jobs);
  }, [canBackup, canManageCompany, canSms, loadBackup, loadServiceOutput, loadSessionSecurity, loadSms]);

  useEffect(() => {
    setPendingAction('initial-load');
    void reloadAll()
      .catch((caught) => {
        const message = errorMessage(caught);
        if (canBackup) setBackupError(message);
        if (canSms) setSmsError(message);
        if (canManageCompany) setServiceOutputError(message);
      })
      .finally(() => setPendingAction(null));
  }, [canBackup, canManageCompany, canSms, reloadAll]);

  async function saveBackupConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction) return;
    setPendingAction('backup-config');
    setBackupError(null);
    setBackupSuccess(null);
    try {
      await postJson<void>(
        '/api/backups/configuration',
        {
          externalDrivePath: externalDrivePath.trim() || null,
          installationSerial: installationSerial.trim().toUpperCase(),
          ...policy,
        },
        'PUT',
      );
      await loadBackup();
      setBackupSuccess('\u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u200c\u06af\u06cc\u0631\u06cc \u0628\u0627 \u0645\u0648\u0641\u0642\u06cc\u062a \u0630\u062e\u06cc\u0631\u0647 \u0634\u062f.');
    } catch (caught) {
      setBackupError(errorMessage(caught));
    } finally {
      setPendingAction(null);
    }
  }

  async function runBackup(backupTarget: 'local' | 'external_drive') {
    if (pendingAction) return;
    setPendingAction(`backup-${backupTarget}`);
    setBackupError(null);
    setBackupSuccess(null);
    try {
      await postJson('/api/backups/runs', {backupType: backupTarget});
      await loadBackup();
      setBackupSuccess('\u0646\u0633\u062e\u0647 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646 \u0648\u0627\u0642\u0639\u06cc \u0627\u06cc\u062c\u0627\u062f \u0648 \u0631\u0645\u0632\u06af\u0630\u0627\u0631\u06cc \u0634\u062f.');
    } catch (caught) {
      setBackupError(errorMessage(caught));
      await loadBackup().catch(() => undefined);
    } finally {
      setPendingAction(null);
    }
  }

  async function verifyBackup(id: string) {
    if (pendingAction) return;
    setPendingAction(`verify-${id}`);
    setBackupError(null);
    setBackupSuccess(null);
    try {
      await postJson(`/api/backups/runs/${id}/verify`, {});
      await loadBackup();
      setBackupSuccess('\u0641\u0627\u06cc\u0644 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646 \u0631\u0645\u0632\u06af\u0634\u0627\u06cc\u06cc \u0648 \u0633\u0627\u062e\u062a\u0627\u0631 \u0628\u0627\u0632\u06cc\u0627\u0628\u06cc \u0622\u0646 \u0628\u0627 \u0645\u0648\u0641\u0642\u06cc\u062a \u0628\u0631\u0631\u0633\u06cc \u0634\u062f.');
    } catch (caught) {
      setBackupError(errorMessage(caught));
    } finally {
      setPendingAction(null);
    }
  }

  async function updateSms(enabled: boolean) {
    if (pendingAction || deviceLabel.trim().length < 2) return;
    setPendingAction('sms-config');
    setSmsError(null);
    setSmsSuccess(null);
    setGatewayToken(null);
    try {
      const result = await postJson<{
        isEnabled: boolean;
        deviceLabel: string;
        gatewayToken: string | null;
      }>(
        '/api/sms/configuration',
        {enabled, deviceLabel: deviceLabel.trim()},
        'PUT',
      );
      setGatewayToken(result.gatewayToken);
      await loadSms();
      setSmsSuccess(
        enabled
          ? '\u062f\u0631\u06af\u0627\u0647 \u067e\u06cc\u0627\u0645\u06a9 \u0641\u0639\u0627\u0644 \u0634\u062f. \u062a\u0648\u06a9\u0646 \u0631\u0627 \u0647\u0645\u06cc\u0646 \u062d\u0627\u0644\u0627 \u062f\u0631 \u06af\u0648\u0634\u06cc \u062b\u0628\u062a \u06a9\u0646\u06cc\u062f.'
          : '\u062f\u0631\u06af\u0627\u0647 \u067e\u06cc\u0627\u0645\u06a9 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644 \u0634\u062f \u0648 \u06af\u0648\u0634\u06cc \u062f\u06cc\u06af\u0631 \u067e\u06cc\u0627\u0645 \u062c\u062f\u06cc\u062f \u062f\u0631\u06cc\u0627\u0641\u062a \u0646\u0645\u06cc\u200c\u06a9\u0646\u062f.',
      );
    } catch (caught) {
      setSmsError(errorMessage(caught));
    } finally {
      setPendingAction(null);
    }
  }

  async function saveServiceOutput(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serviceOutput || pendingAction) return;
    setPendingAction('service-output');
    setServiceOutputError(null);
    setServiceOutputSuccess(null);
    try {
      const saved = await postJson<ServiceOutputSettings>(
        '/api/settings/service-output',
        serviceOutput,
        'PUT',
      );
      setServiceOutput(saved);
      setServiceOutputSuccess('تنظیمات چاپ پذیرش و برچسب ذخیره شد.');
    } catch (caught) {
      setServiceOutputError(errorMessage(caught));
    } finally {
      setPendingAction(null);
    }
  }

  async function saveSessionSecurity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionSecurity || pendingAction) return;
    setPendingAction('session-security');
    setSessionSecurityError(null);
    setSessionSecuritySuccess(null);
    try {
      const saved = await postJson<SessionSecuritySettings>(
        '/api/settings/session-security',
        sessionSecurity,
        'PUT',
      );
      setSessionSecurity(saved);
      setSessionSecuritySuccess('مدت قفل خودکار نشست ذخیره شد و برای نشست‌های فعال اعمال شد.');
    } catch (caught) {
      setSessionSecurityError(errorMessage(caught));
    } finally {
      setPendingAction(null);
    }
  }

  async function saveLoginLockSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionSecurity || pendingAction) return;
    setPendingAction('login-lock');
    setLoginLockError(null);
    setLoginLockSuccess(null);
    try {
      const saved = await postJson<SessionSecuritySettings>(
        '/api/settings/session-security',
        sessionSecurity,
        'PUT',
      );
      setSessionSecurity(saved);
      setLoginLockSuccess('تنظیمات قفل موقت ورود با موفقیت ذخیره شد.');
    } catch (caught) {
      setLoginLockError(errorMessage(caught));
    } finally {
      setPendingAction(null);
    }
  }

  async function copyToken() {
    if (!gatewayToken) return;
    setSmsError(null);
    try {
      await navigator.clipboard.writeText(gatewayToken);
      setSmsSuccess('\u062a\u0648\u06a9\u0646 \u062f\u0631 \u062d\u0627\u0641\u0638\u0647 \u0645\u0648\u0642\u062a \u06a9\u067e\u06cc \u0634\u062f.');
    } catch {
      setSmsError('\u0645\u0631\u0648\u0631\u06af\u0631 \u0627\u062c\u0627\u0632\u0647 \u06a9\u067e\u06cc \u062e\u0648\u062f\u06a9\u0627\u0631 \u0646\u062f\u0627\u062f\u061b \u062a\u0648\u06a9\u0646 \u0631\u0627 \u0628\u0647\u200c\u0635\u0648\u0631\u062a \u062f\u0633\u062a\u06cc \u0627\u0646\u062a\u062e\u0627\u0628 \u0648 \u06a9\u067e\u06cc \u06a9\u0646\u06cc\u062f.');
    }
  }

  async function uploadCompanyLogo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!logoFile || uploadingLogo) return;
    setUploadingLogo(true);
    setLogoError(null);
    setLogoSuccess(null);
    try {
      const payload = new FormData();
      payload.set('logo', logoFile);
      await api<{logoUrl: string}>('/api/settings/company/logo', {
        method: 'POST',
        body: payload,
      });
      await onCompanyChanged();
      setLogoFile(null);
      event.currentTarget.reset();
      setLogoSuccess('لوگوی شرکت با موفقیت ذخیره و در سامانه به‌روزرسانی شد.');
    } catch (caught) {
      setLogoError(errorMessage(caught));
    } finally {
      setUploadingLogo(false);
    }
  }

  return (
    <section className="content-page">
      <header className="page-heading compact">
        <ContextHelpButton help={appHelp.settings} />
        <div>
          <p>{'\u0634\u0631\u06a9\u062a\u060c \u06a9\u0627\u0631\u0628\u0631\u0627\u0646\u060c \u0632\u06cc\u0631\u0633\u0627\u062e\u062a \u0648 \u0627\u062a\u0635\u0627\u0644\u200c\u0647\u0627'}</p>
          <h1>{'\u062a\u0646\u0638\u06cc\u0645\u0627\u062a'}</h1>
        </div>
      </header>

      <div className="info-card settings-company-card">
        <ShieldCheck aria-hidden />
        <div>
          <strong>{companyName}</strong>
          <p>{'\u0648\u0627\u062d\u062f \u067e\u0627\u06cc\u0647 \u0630\u062e\u06cc\u0631\u0647\u200c\u0633\u0627\u0632\u06cc: \u0631\u06cc\u0627\u0644 \u00b7 \u0645\u0646\u0637\u0642\u0647 \u0632\u0645\u0627\u0646\u06cc: \u062a\u0647\u0631\u0627\u0646 \u00b7 \u0627\u0637\u0644\u0627\u0639\u0627\u062a \u0647\u0631 \u06a9\u0627\u0631\u0628\u0631 \u0647\u0646\u06af\u0627\u0645 \u0646\u0645\u0627\u06cc\u0634 \u062a\u0628\u062f\u06cc\u0644 \u0645\u06cc\u200c\u0634\u0648\u062f.'}</p>
        </div>
      </div>

      <div className="settings-compact-grid">

      {canManageCompany ? (
        <section className="settings-section settings-section--compact">
          <div className="section-heading settings-section-heading">
            <ContextHelpButton help={appHelp.settings} />
            <div>
              <p>کنترل نشست فعال و بازگشت امن پس از بی‌کاری</p>
              <h2>قفل خودکار نشست</h2>
            </div>
            <Clock3 aria-hidden />
          </div>
          <Feedback error={sessionSecurityError} success={sessionSecuritySuccess} />
          {sessionSecurity ? (
            <form className="form-card" onSubmit={(event) => void saveSessionSecurity(event)}>
              <div className="form-grid">
                <label className="field">
                  <span>مدت بی‌کاری پیش از قفل‌شدن (دقیقه)</span>
                  <input
                    inputMode="numeric"
                    max={90}
                    min={1}
                    onChange={(event) => setSessionSecurity((current) => current ? ({...current, idleMinutes: Number(event.target.value)}) : current)}
                    required
                    type="number"
                    value={sessionSecurity.idleMinutes}
                  />
                  <small className="field-help">
                    مقدار استاندارد ۳۰ دقیقه است. برای آزمون می‌توانید موقتاً ۱ دقیقه انتخاب کنید و پس از پایان تست آن را به ۳۰ برگردانید.
                  </small>
                </label>
              </div>
              <div className="form-actions">
                <button className="button primary" disabled={Boolean(pendingAction)} type="submit">
                  <Clock3 aria-hidden />
                  {pendingAction === 'session-security' ? 'در حال ذخیره…' : 'ذخیره زمان قفل خودکار'}
                </button>
              </div>
            </form>
          ) : (
            <div className="empty-state card">در حال دریافت تنظیمات امنیت نشست…</div>
          )}
        </section>
      ) : null}

      {canManageCompany ? (
        <section className="settings-section settings-section--compact login-lock-section">
          <div className="section-heading settings-section-heading">
            <ContextHelpButton help={appHelp.settings} />
            <div>
              <p>پس از چند ورود ناموفق، دسترسی ورود برای مدت کوتاه متوقف می‌شود</p>
              <h2>قفل موقت ورود</h2>
            </div>
            <ShieldAlert aria-hidden />
          </div>
          <Feedback error={loginLockError} success={loginLockSuccess} />
          {sessionSecurity ? (
            <form className="form-card security-lock-form" onSubmit={(event) => void saveLoginLockSettings(event)}>
              <div className="security-lock-status">
                <label className="toggle-row">
                  <input
                    checked={sessionSecurity.loginLockEnabled}
                    onChange={(event) => setSessionSecurity((current) => current ? ({...current, loginLockEnabled: event.target.checked}) : current)}
                    type="checkbox"
                  />
                  <span>قفل موقت ورود فعال باشد</span>
                </label>
                <p>در حالت غیرفعال، تلاش‌های ناموفق ثبت می‌شوند اما قفل خودکار جدید ایجاد نمی‌شود.</p>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>تعداد تلاش ناموفق مجاز</span>
                  <input
                    inputMode="numeric"
                    max={20}
                    min={1}
                    onChange={(event) => setSessionSecurity((current) => current ? ({...current, maxFailedLoginAttempts: Number(event.target.value)}) : current)}
                    required
                    type="number"
                    value={sessionSecurity.maxFailedLoginAttempts}
                  />
                  <small className="field-help">پیشنهاد پیش‌فرض: ۵ تلاش ناموفق.</small>
                </label>
                <label className="field">
                  <span>مدت قفل موقت ورود (دقیقه)</span>
                  <input
                    inputMode="numeric"
                    max={1440}
                    min={1}
                    onChange={(event) => setSessionSecurity((current) => current ? ({...current, loginLockMinutes: Number(event.target.value)}) : current)}
                    required
                    type="number"
                    value={sessionSecurity.loginLockMinutes}
                  />
                  <small className="field-help">پیشنهاد پیش‌فرض: ۱۵ دقیقه.</small>
                </label>
              </div>
              <div className="form-actions">
                <button className="button primary" disabled={Boolean(pendingAction)} type="submit">
                  <ShieldAlert aria-hidden />
                  {pendingAction === 'login-lock' ? 'در حال ذخیره…' : 'ذخیره تنظیمات قفل ورود'}
                </button>
              </div>
            </form>
          ) : (
            <div className="empty-state card">در حال دریافت تنظیمات قفل ورود…</div>
          )}
          {permissions.includes('system.audit.view') ? (
            <Link className="security-audit-card" to="/audit">
              <ClipboardList aria-hidden />
              <span>
                <strong>گزارش لاگ امنیتی</strong>
                <small>سابقه ورود، تلاش ناموفق، قفل، رفع قفل و خروج را جداگانه ببینید.</small>
              </span>
              <span className="security-audit-card__action">مشاهده گزارش</span>
            </Link>
          ) : null}
        </section>
      ) : null}
      {canManageCompany ? (
        <section className="settings-section settings-section--compact company-logo-section">
          <div className="section-heading settings-section-heading">
            <ContextHelpButton help={appHelp.settings} />
            <div>
              <p>نمایش در صفحه ورود و هدر سامانه</p>
              <h2>لوگوی شرکت</h2>
            </div>
            <ImageUp aria-hidden />
          </div>
          <Feedback error={logoError} success={logoSuccess} />
          <form className="form-card company-logo-form" onSubmit={uploadCompanyLogo}>
            <div className="company-logo-preview">
              <BrandLogo variant="mobile" logoUrl={companyLogoUrl} />
              <div>
                <strong>لوگوی فعال</strong>
                <p>با ذخیره لوگوی جدید، لوگوی قبلی حفظ می‌شود و فقط لوگوی فعال جایگزین خواهد شد.</p>
              </div>
            </div>
            <label className="field">
              <span>انتخاب فایل لوگو</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                required
              />
              <small className="field-help">
                فقط PNG، JPEG یا WebP با حداکثر حجم ۲ مگابایت.
              </small>
            </label>
            <div className="form-actions">
              <button className="button primary" type="submit" disabled={!logoFile || uploadingLogo}>
                <ImageUp aria-hidden />
                {uploadingLogo ? 'در حال ذخیره لوگو…' : 'ذخیره لوگوی جدید'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {canManageCompany ? (
        <section className="settings-section settings-section--compact">
          <div className="section-heading settings-section-heading">
            <ContextHelpButton help={appHelp.settings} />
            <div>
              <p>خروجی خودکار پس از ثبت واقعی پذیرش</p>
              <h2>چاپ رسید و برچسب خدمات</h2>
            </div>
            <Printer aria-hidden />
          </div>
          <div className="service-output-content">
            <Feedback error={serviceOutputError} success={serviceOutputSuccess} />
            {serviceOutput ? (
              <form className="form-card service-output-form" onSubmit={(event) => void saveServiceOutput(event)}>
              <div className="form-card-heading">
                <h2>{serviceOutput.intakePrintEnabled ? 'چاپ پذیرش فعال است' : 'چاپ پذیرش غیرفعال است'}</h2>
                <p>
                  مرورگر پس از پذیرش پنجره چاپ را باز می‌کند. اگر چاپ غیرفعال باشد،
                  پیامک پذیرش در صورت فعال‌بودن درگاه برای مشتری صف می‌شود.
                </p>
              </div>
              <div className="form-grid">
                <label className="toggle-row">
                  <input
                    checked={serviceOutput.intakePrintEnabled}
                    onChange={(event) => setServiceOutput((current) => current ? ({
                      ...current,
                      intakePrintEnabled: event.target.checked,
                    }) : current)}
                    type="checkbox"
                  />
                  <span>بازکردن خودکار پنجره چاپ بعد از پذیرش</span>
                </label>
                <label className="field">
                  <span>اندازه کاغذ</span>
                  <select
                    disabled={!serviceOutput.intakePrintEnabled}
                    onChange={(event) => setServiceOutput((current) => current ? ({
                      ...current,
                      paperSize: event.target.value as 'A4' | '80mm',
                    }) : current)}
                    value={serviceOutput.paperSize}
                  >
                    <option value="A4">A4 برای HP 1005</option>
                    <option value="80mm">حرارتی ۸۰ میلی‌متری</option>
                  </select>
                </label>
                <div className="toggle-list full">
                  <label className="toggle-row">
                    <input
                      checked={serviceOutput.printReceipt}
                      disabled={!serviceOutput.intakePrintEnabled}
                      onChange={(event) => setServiceOutput((current) => current ? ({
                        ...current,
                        printReceipt: event.target.checked,
                      }) : current)}
                      type="checkbox"
                    />
                    <span>چاپ رسید پذیرش مشتری</span>
                  </label>
                  <label className="toggle-row">
                    <input
                      checked={serviceOutput.printDeviceLabel}
                      disabled={!serviceOutput.intakePrintEnabled}
                      onChange={(event) => setServiceOutput((current) => current ? ({
                        ...current,
                        printDeviceLabel: event.target.checked,
                      }) : current)}
                      type="checkbox"
                    />
                    <span>چاپ برچسب دستگاه</span>
                  </label>
                </div>
              </div>
              <div className="form-actions">
                <button className="button primary" disabled={Boolean(pendingAction)} type="submit">
                  <Printer aria-hidden />
                  {pendingAction === 'service-output' ? 'در حال ذخیره…' : 'ذخیره تنظیمات چاپ'}
                </button>
              </div>
              </form>
            ) : (
              <div className="empty-state card">در حال دریافت تنظیمات چاپ…</div>
            )}
          </div>
        </section>
      ) : null}

      </div>

      {canBackup ? (
        <section className="settings-section">
          <div className="section-heading settings-section-heading">
            <ContextHelpButton help={appHelp.backup} />
            <div>
              <p>{'\u0646\u0633\u062e\u0647 \u0631\u0645\u0632\u06af\u0630\u0627\u0631\u06cc\u200c\u0634\u062f\u0647 \u0648 \u0642\u0627\u0628\u0644 \u0627\u0639\u062a\u0628\u0627\u0631\u0633\u0646\u062c\u06cc'}</p>
              <h2>{'\u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u200c\u06af\u06cc\u0631\u06cc'}</h2>
            </div>
            <DatabaseBackup aria-hidden />
          </div>

          <Feedback error={backupError} success={backupSuccess} />

          {backupConfiguration ? (
            <>
              <div className="settings-summary-grid">
                <article className="summary-card blue">
                  <DatabaseBackup aria-hidden />
                  <div>
                    <span>{'\u062d\u0627\u0641\u0638\u0647 \u062f\u0627\u062e\u0644\u06cc \u0633\u0631\u0648\u0631'}</span>
                    <strong dir="ltr">{backupConfiguration.localDirectory}</strong>
                  </div>
                </article>
                <article className="summary-card green">
                  <ShieldCheck aria-hidden />
                  <div>
                    <span>{'\u0631\u0645\u0632\u06af\u0630\u0627\u0631\u06cc \u0646\u0633\u062e\u0647\u200c\u0647\u0627'}</span>
                    <strong>
                      {backupConfiguration.encryptionConfigured
                        ? '\u06a9\u0644\u06cc\u062f \u0633\u0631\u0648\u0631 \u0622\u0645\u0627\u062f\u0647 \u0627\u0633\u062a'
                        : '\u06a9\u0644\u06cc\u062f \u0633\u0631\u0648\u0631 \u062a\u0646\u0638\u06cc\u0645 \u0646\u0634\u062f\u0647'}
                    </strong>
                  </div>
                </article>
                <article className="summary-card amber">
                  <CloudOff aria-hidden />
                  <div>
                    <span>{'Google Drive'}</span>
                    <strong>
                      {backupConfiguration.googleDrive.isEnabled
                        ? '\u0645\u062a\u0635\u0644'
                        : '\u0631\u0632\u0631\u0648 \u0648 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644'}
                    </strong>
                  </div>
                </article>
              </div>

              {!backupConfiguration.encryptionConfigured ? (
                <div className="form-message error" role="alert">
                  {'\u0628\u0631\u0627\u06cc \u0627\u06cc\u062c\u0627\u062f \u0628\u06a9\u0627\u067e\u060c \u0645\u062a\u063a\u06cc\u0631 BACKUP_ENCRYPTION_KEY \u0631\u0648\u06cc \u0633\u0631\u0648\u0631 \u0628\u0627\u06cc\u062f \u0628\u0627 \u06cc\u06a9 \u06a9\u0644\u06cc\u062f Base64 \u0633\u06cc\u200c\u0648\u062f\u0648 \u0628\u0627\u06cc\u062a\u06cc \u062a\u0646\u0638\u06cc\u0645 \u0648 \u0633\u0631\u0648\u0631 \u062f\u0648\u0628\u0627\u0631\u0647 \u0627\u062c\u0631\u0627 \u0634\u0648\u062f.'}
                </div>
              ) : null}

              <form className="form-card backup-policy-form" onSubmit={saveBackupConfiguration}>
                <div className="form-card-heading">
                  <ContextHelpButton help={appHelp.backupSchedule} />
                  <h2>{'\u0627\u0644\u06af\u0648\u06cc \u0627\u062c\u0631\u0627\u06cc \u062e\u0648\u062f\u06a9\u0627\u0631'}</h2>
                  <p>{'\u0647\u0645\u0647 \u0633\u0627\u0639\u062a\u200c\u0647\u0627 \u0628\u0631\u0627\u0633\u0627\u0633 \u0645\u0646\u0637\u0642\u0647 \u0632\u0645\u0627\u0646\u06cc \u062a\u0647\u0631\u0627\u0646 \u0627\u062c\u0631\u0627 \u0645\u06cc\u200c\u0634\u0648\u0646\u062f.'}</p>
                </div>
                <div className="backup-identity-summary">
                  <div>
                    <span>نسخه برنامه</span>
                    <strong dir="ltr">v{backupConfiguration.installation.appVersion}</strong>
                  </div>
                  <div>
                    <span>شناسه مستقل این نصب</span>
                    <strong dir="ltr">{backupConfiguration.installation.serial}</strong>
                  </div>
                  <small>{backupConfiguration.installation.filenamePattern}</small>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>شماره سریال نصب *</span>
                    <input
                      dir="ltr"
                      value={installationSerial}
                      minLength={6}
                      maxLength={48}
                      pattern="[A-Za-z0-9][A-Za-z0-9-]{5,47}"
                      required
                      onChange={(event) => setInstallationSerial(event.target.value.toUpperCase())}
                    />
                    <small className="field-help">
                      برای هر نصب متفاوت باشد؛ فقط حروف انگلیسی، عدد و خط تیره مجاز است.
                    </small>
                  </label>
                  <label className="field full">
                    <span>{'\u0645\u0633\u06cc\u0631 \u062d\u0627\u0641\u0638\u0647 \u062e\u0627\u0631\u062c\u06cc \u0631\u0648\u06cc \u06a9\u0627\u0645\u067e\u06cc\u0648\u062a\u0631 \u0633\u0631\u0648\u0631'}</span>
                    <input
                      dir="ltr"
                      value={externalDrivePath}
                      maxLength={1000}
                      placeholder="E:\Diaco-Backups"
                      onChange={(event) => setExternalDrivePath(event.target.value)}
                    />
                    <small className="field-help">
                      {'\u0645\u0633\u06cc\u0631 \u0628\u0627\u06cc\u062f \u0645\u0637\u0644\u0642 \u0648 \u06cc\u06a9 \u067e\u0648\u0634\u0647 \u0628\u0627\u0634\u062f\u061b \u0627\u0646\u062a\u062e\u0627\u0628 \u0631\u06cc\u0634\u0647 \u06cc\u06a9 \u062f\u0631\u0627\u06cc\u0648 \u0645\u062c\u0627\u0632 \u0646\u06cc\u0633\u062a.'}
                    </small>
                  </label>
                  <label className="field">
                    <span>{'\u0633\u0627\u0639\u062a \u0627\u062c\u0631\u0627\u06cc \u0631\u0648\u0632\u0627\u0646\u0647'}</span>
                    <input
                      type="time"
                      value={policy.scheduleTime}
                      onChange={(event) =>
                        setPolicy((current) => ({
                          ...current,
                          scheduleTime: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <div className="toggle-list">
                    {([
                      ['scheduled', '\u0627\u062c\u0631\u0627\u06cc \u0632\u0645\u0627\u0646\u200c\u0628\u0646\u062f\u06cc\u200c\u0634\u062f\u0647'],
                      ['endOfDay', '\u067e\u0634\u062a\u06cc\u0628\u0627\u0646 \u067e\u0627\u06cc\u0627\u0646 \u0631\u0648\u0632'],
                      ['onDriveConnected', '\u0627\u062c\u0631\u0627 \u067e\u0633 \u0627\u0632 \u0627\u062a\u0635\u0627\u0644 \u062d\u0627\u0641\u0638\u0647 \u062e\u0627\u0631\u062c\u06cc'],
                      ['onServerShutdown', '\u067e\u0634\u062a\u06cc\u0628\u0627\u0646 \u0647\u0646\u06af\u0627\u0645 \u062e\u0631\u0648\u062c \u0633\u0631\u0648\u0631'],
                    ] as const).map(([key, label]) => (
                      <label className="toggle-row" key={key}>
                        <input
                          type="checkbox"
                          checked={policy[key]}
                          onChange={(event) =>
                            setPolicy((current) => ({
                              ...current,
                              [key]: event.target.checked,
                            }))
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-actions split-actions">
                  <div>
                    <button
                      className="button secondary"
                      type="button"
                      disabled={
                        Boolean(pendingAction) ||
                        !backupConfiguration.encryptionConfigured
                      }
                      onClick={() => void runBackup('local')}
                    >
                      <DatabaseBackup aria-hidden />
                      {pendingAction === 'backup-local'
                        ? '\u062f\u0631 \u062d\u0627\u0644 \u0627\u06cc\u062c\u0627\u062f\u2026'
                        : '\u0628\u06a9\u0627\u067e \u062f\u0627\u062e\u0644\u06cc \u0627\u06a9\u0646\u0648\u0646'}
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      disabled={
                        Boolean(pendingAction) ||
                        !backupConfiguration.encryptionConfigured ||
                        !externalDrivePath.trim()
                      }
                      onClick={() => void runBackup('external_drive')}
                    >
                      <HardDrive aria-hidden />
                      {pendingAction === 'backup-external_drive'
                        ? '\u062f\u0631 \u062d\u0627\u0644 \u0627\u06cc\u062c\u0627\u062f\u2026'
                        : '\u0628\u06a9\u0627\u067e \u062d\u0627\u0641\u0638\u0647 \u062e\u0627\u0631\u062c\u06cc'}
                    </button>
                  </div>
                  <button
                    className="button primary"
                    type="submit"
                    disabled={Boolean(pendingAction)}
                  >
                    {pendingAction === 'backup-config'
                      ? '\u062f\u0631 \u062d\u0627\u0644 \u0630\u062e\u06cc\u0631\u0647\u2026'
                      : '\u0630\u062e\u06cc\u0631\u0647 \u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u067e\u0634\u062a\u06cc\u0628\u0627\u0646'}
                  </button>
                </div>
              </form>

              <div className="table-card">
                <div className="card-table-heading">
                  <div>
                    <strong>{'\u0633\u0627\u0628\u0642\u0647 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u200c\u0647\u0627'}</strong>
                    <span>{'\u0648\u0636\u0639\u06cc\u062a \u0627\u0632 \u0627\u062c\u0631\u0627\u06cc \u0648\u0627\u0642\u0639\u06cc pg_dump \u062e\u0648\u0627\u0646\u062f\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f.'}</span>
                  </div>
                </div>
                {backupRuns.length === 0 ? (
                  <div className="empty-state">{'\u0647\u0646\u0648\u0632 \u0646\u0633\u062e\u0647 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc \u062b\u0628\u062a \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.'}</div>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{'\u0632\u0645\u0627\u0646'}</th>
                          <th>{'\u0645\u0642\u0635\u062f'}</th>
                          <th>{'\u0639\u0644\u062a \u0627\u062c\u0631\u0627'}</th>
                          <th>{'\u062d\u062c\u0645'}</th>
                          <th>{'\u0648\u0636\u0639\u06cc\u062a'}</th>
                          <th>{'\u06a9\u0646\u062a\u0631\u0644'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backupRuns.map((run) => (
                          <tr key={run.id}>
                            <td>{shownDate(run.startedAt)}</td>
                            <td>{backupType[run.backupType] ?? run.backupType}</td>
                            <td>{triggerType[run.triggerType] ?? run.triggerType}</td>
                            <td>{shownBytes(run.byteSize)}</td>
                            <td>
                              <span className={`status-pill status-${run.status}`}>
                                {backupStatus[run.status] ?? run.status}
                              </span>
                              {run.errorMessage ? (
                                <small className="table-error">{run.errorMessage}</small>
                              ) : null}
                            </td>
                            <td>
                              {run.status === 'succeeded' &&
                              run.backupType !== 'restore_verification' ? (
                                <button
                                  className="table-action"
                                  type="button"
                                  disabled={Boolean(pendingAction)}
                                  onClick={() => void verifyBackup(run.id)}
                                >
                                  {pendingAction === `verify-${run.id}`
                                    ? '\u062f\u0631 \u062d\u0627\u0644 \u0628\u0631\u0631\u0633\u06cc\u2026'
                                    : '\u0627\u0639\u062a\u0628\u0627\u0631\u0633\u0646\u062c\u06cc'}
                                </button>
                              ) : (
                                '\u2014'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state card">{'\u062f\u0631 \u062d\u0627\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u2026'}</div>
          )}
        </section>
      ) : null}

      {canSms ? (
        <section className="settings-section">
          <div className="section-heading settings-section-heading">
            <ContextHelpButton help={appHelp.sms} />
            <div>
              <p>{'\u0635\u0641 \u0648\u0627\u0642\u0639\u06cc \u067e\u06cc\u0627\u0645 \u0648 \u06af\u0632\u0627\u0631\u0634 \u062a\u062d\u0648\u06cc\u0644 \u06af\u0648\u0634\u06cc'}</p>
              <h2>{'\u062f\u0631\u06af\u0627\u0647 \u067e\u06cc\u0627\u0645\u06a9 \u0627\u0646\u062f\u0631\u0648\u06cc\u062f\u06cc'}</h2>
            </div>
            <MessageSquareText aria-hidden />
          </div>

          <Feedback error={smsError} success={smsSuccess} />

          {smsConfiguration ? (
            <>
              <form
                className="form-card sms-configuration-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void updateSms(!smsConfiguration.isEnabled);
                }}
              >
                <div className="form-card-heading">
                  <ContextHelpButton help={appHelp.smsStatus} />
                  <h2>
                    {smsConfiguration.isEnabled
                      ? '\u062f\u0631\u06af\u0627\u0647 \u0641\u0639\u0627\u0644 \u0627\u0633\u062a'
                      : '\u062f\u0631\u06af\u0627\u0647 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062a'}
                  </h2>
                  <p>
                    {'\u06af\u0648\u0634\u06cc \u0627\u0632 \u0645\u0633\u06cc\u0631 API \u067e\u06cc\u0627\u0645\u200c\u0647\u0627\u06cc \u0635\u0641 \u0631\u0627 \u0645\u06cc\u200c\u06af\u06cc\u0631\u062f \u0648 \u0646\u062a\u06cc\u062c\u0647 \u0627\u0631\u0633\u0627\u0644 \u0631\u0627 \u0628\u0647 \u0633\u0631\u0648\u0631 \u0628\u0631\u0645\u06cc\u200c\u06af\u0631\u062f\u0627\u0646\u062f.'}
                  </p>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>{'\u0646\u0627\u0645 \u062f\u0633\u062a\u06af\u0627\u0647 \u0627\u0646\u062f\u0631\u0648\u06cc\u062f\u06cc *'}</span>
                    <input
                      value={deviceLabel}
                      minLength={2}
                      maxLength={120}
                      required
                      onChange={(event) => setDeviceLabel(event.target.value)}
                    />
                  </label>
                  <div className="connector-state">
                    <span>{'\u0622\u062e\u0631\u06cc\u0646 \u0648\u0636\u0639\u06cc\u062a \u0627\u062a\u0635\u0627\u0644'}</span>
                    <strong>
                      {smsConfiguration.lastHealthStatus ?? '\u0647\u0646\u0648\u0632 \u06af\u0632\u0627\u0631\u0634\u06cc \u062f\u0631\u06cc\u0627\u0641\u062a \u0646\u0634\u062f\u0647'}
                    </strong>
                    <small>{shownDate(smsConfiguration.lastHealthAt)}</small>
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    className={
                      smsConfiguration.isEnabled
                        ? 'button danger'
                        : 'button primary'
                    }
                    type="submit"
                    disabled={
                      Boolean(pendingAction) || deviceLabel.trim().length < 2
                    }
                  >
                    {pendingAction === 'sms-config'
                      ? '\u062f\u0631 \u062d\u0627\u0644 \u062b\u0628\u062a\u2026'
                      : smsConfiguration.isEnabled
                        ? '\u063a\u06cc\u0631\u0641\u0639\u0627\u0644\u200c\u06a9\u0631\u062f\u0646 \u062f\u0631\u06af\u0627\u0647'
                        : '\u0641\u0639\u0627\u0644\u200c\u06a9\u0631\u062f\u0646 \u0648 \u0633\u0627\u062e\u062a \u062a\u0648\u06a9\u0646'}
                  </button>
                </div>
              </form>

              {gatewayToken ? (
                <div className="token-card" role="status">
                  <div>
                    <strong>{'\u062a\u0648\u06a9\u0646 \u0627\u062a\u0635\u0627\u0644\u061b \u0641\u0642\u0637 \u0647\u0645\u06cc\u0646 \u06cc\u06a9\u200c\u0628\u0627\u0631 \u0646\u0645\u0627\u06cc\u0634 \u062f\u0627\u062f\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f'}</strong>
                    <p>{'\u0622\u0646 \u0631\u0627 \u062f\u0631 \u0628\u0631\u0646\u0627\u0645\u0647 \u062f\u0631\u06af\u0627\u0647 \u067e\u06cc\u0627\u0645\u06a9 \u06af\u0648\u0634\u06cc \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f \u0648 \u062f\u0631 \u0645\u062d\u0644 \u0627\u0645\u0646 \u0646\u06af\u0647 \u062f\u0627\u0631\u06cc\u062f.'}</p>
                  </div>
                  <code dir="ltr">{gatewayToken}</code>
                  <button className="button secondary" type="button" onClick={() => void copyToken()}>
                    <Copy aria-hidden />
                    {'\u06a9\u067e\u06cc \u062a\u0648\u06a9\u0646'}
                  </button>
                </div>
              ) : null}

              <div className="table-card">
                <div className="card-table-heading">
                  <div>
                    <strong>{'\u0622\u062e\u0631\u06cc\u0646 \u067e\u06cc\u0627\u0645\u200c\u0647\u0627'}</strong>
                    <span>{'\u0645\u0648\u0641\u0642\u06cc\u062a \u062a\u0646\u0647\u0627 \u067e\u0633 \u0627\u0632 \u06af\u0632\u0627\u0631\u0634 \u0648\u0627\u0642\u0639\u06cc \u06af\u0648\u0634\u06cc \u0646\u0645\u0627\u06cc\u0634 \u062f\u0627\u062f\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f.'}</span>
                  </div>
                </div>
                {smsMessages.length === 0 ? (
                  <div className="empty-state">{'\u0647\u0646\u0648\u0632 \u067e\u06cc\u0627\u0645\u06cc \u062f\u0631 \u0635\u0641 \u062b\u0628\u062a \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.'}</div>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{'\u0632\u0645\u0627\u0646 \u0635\u0641'}</th>
                          <th>{'\u06af\u06cc\u0631\u0646\u062f\u0647'}</th>
                          <th>{'\u0645\u062a\u0646'}</th>
                          <th>{'\u062a\u0644\u0627\u0634'}</th>
                          <th>{'\u0648\u0636\u0639\u06cc\u062a'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {smsMessages.map((message) => (
                          <tr key={message.id}>
                            <td>{shownDate(message.queuedAt)}</td>
                            <td dir="ltr">{message.recipient}</td>
                            <td className="message-cell">{message.messageText}</td>
                            <td>{new Intl.NumberFormat('fa-IR').format(message.attemptCount)}</td>
                            <td>
                              <span className={`status-pill status-${message.status}`}>
                                {smsStatus[message.status] ?? message.status}
                              </span>
                              {message.lastError ? (
                                <small className="table-error">{message.lastError}</small>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state card">{'\u062f\u0631 \u062d\u0627\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u067e\u06cc\u0627\u0645\u06a9\u2026'}</div>
          )}
        </section>
      ) : null}

      {!canBackup && !canSms ? (
        <div className="empty-state card">
          {'\u0628\u0631\u0627\u06cc \u0645\u062f\u06cc\u0631\u06cc\u062a \u067e\u0634\u062a\u06cc\u0628\u0627\u0646 \u06cc\u0627 \u067e\u06cc\u0627\u0645\u06a9\u060c \u0645\u062c\u0648\u0632 \u0645\u0631\u0628\u0648\u0637 \u0628\u0627\u06cc\u062f \u0628\u0647 \u0646\u0642\u0634 \u0634\u0645\u0627 \u062f\u0627\u062f\u0647 \u0634\u0648\u062f.'}
        </div>
      ) : null}
    </section>
  );
}
