import {
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  ClipboardCheck,
  ClipboardPlus,
  Factory,
  FileText,
  Home,
  LogOut,
  Menu,
  PackageCheck,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  User,
  UserCog,
  Users,
  WalletCards,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import type {
  AmountUnit,
  AuthenticatedUser,
  BootstrapResponse,
  CompanyProfile,
} from '../../shared/contracts.js';
import {
  api,
  AUTHENTICATION_REQUIRED_EVENT,
  errorMessage,
  getBootstrap,
  postJson,
} from './api.js';
import {AccountingPage} from './AccountingPage.js';
import {AdminRecoveryLauncher} from './AdminRecoveryLauncher.js';
import {BrandLogo} from './BrandLogo.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {CommerceDashboard} from './CommerceDashboard.js';
import {ThemeControl} from './ThemeControl.js';
import {readThemeMode, type ThemeMode} from './theme.js';
import {JalaliDateField} from './JalaliDateField.js';
import {PasswordField} from './PasswordField.js';
import {formatJalaliDate, jalaliInputToIso} from './jalali-date.js';
import {appHelp, type HelpDefinition} from './help-content.js';
import {OrganizationPage} from './OrganizationPage.js';
import {PartiesPage} from './PartiesPage.js';
import {ProductsPage} from './ProductsPage.js';
import {ProductionPage} from './ProductionPage.js';
import {PurchasesPage} from './PurchasesPage.js';
import {SalesPage} from './SalesPage.js';
import {ServicePage} from './ServicePage.js';
import {ServiceReceptionPage} from './ServiceReceptionPage.js';
import {ServiceReportsPanel} from './ServiceReportsPanel.js';
import {ServiceTrackingPage} from './ServiceTrackingPage.js';
import {SettingsPage} from './SettingsPage.js';
import {TreasuryPage} from './TreasuryPage.js';
import {AuditLogPage} from './AuditLogPage.js';
import {UserManagementPage} from './UserManagementPage.js';
import './user-management.css';
import './business-forms.css';

interface AppSession {
  company: CompanyProfile;
  user: AuthenticatedUser;
}

interface LoginProps {
  company: CompanyProfile | null;
  onAuthenticated: () => Promise<void>;
}

interface SetupProps {
  onCompleted: () => Promise<void>;
}

interface ShellProps {
  session: AppSession;
  onSessionChanged: () => Promise<void>;
}

const SERVICE_SIDEBAR_MIN_WIDTH = 250;
const SERVICE_SIDEBAR_MAX_WIDTH = 425;
const SERVICE_SIDEBAR_WIDTH_KEY = 'diaco-service-sidebar-width';

function clampServiceSidebarWidth(width: number): number {
  return Math.min(SERVICE_SIDEBAR_MAX_WIDTH, Math.max(SERVICE_SIDEBAR_MIN_WIDTH, width));
}

function readServiceSidebarWidth(): number {
  if (typeof window === 'undefined') return SERVICE_SIDEBAR_MIN_WIDTH;
  try {
    const stored = Number(window.localStorage.getItem(SERVICE_SIDEBAR_WIDTH_KEY));
    return Number.isFinite(stored)
      ? clampServiceSidebarWidth(stored)
      : SERVICE_SIDEBAR_MIN_WIDTH;
  } catch {
    return SERVICE_SIDEBAR_MIN_WIDTH;
  }
}

interface ListColumn {
  key: string;
  title: string;
  kind?: 'amount' | 'date';
}

interface ListPageProps {
  title: string;
  description: string;
  endpoint: string;
  columns: readonly ListColumn[];
  amountUnit: AmountUnit;
  help: HelpDefinition;
}

interface NavigationItem {
  to: string;
  title: string;
  icon: LucideIcon;
  permission?: string;
}

type WorkspaceId = 'accounting' | 'service';

interface WorkspaceDefinition {
  id: WorkspaceId;
  title: string;
  sectionTitle: string;
  defaultPath: string;
  icon: LucideIcon;
  navigationPaths: readonly string[];
}

const navigation: readonly NavigationItem[] = [
  {to: '/', title: 'خانه', icon: Home},
  {
    to: '/accounting',
    title: 'داشبورد بازرگانی',
    icon: Calculator,
    permission: 'accounting.view',
  },
  {
    to: '/accounting/records',
    title: 'اسناد حسابداری',
    icon: FileText,
    permission: 'accounting.view',
  },
  {
    to: '/treasury',
    title: 'خزانه',
    icon: WalletCards,
    permission: 'treasury.view',
  },
  {
    to: '/parties',
    title: 'طرف‌حساب‌ها',
    icon: Users,
    permission: 'parties.view',
  },
  {
    to: '/products',
    title: 'کالا و خدمات',
    icon: Boxes,
    permission: 'inventory.view',
  },
  {
    to: '/organization',
    title: '\u0634\u0639\u0628 \u0648 \u0627\u0646\u0628\u0627\u0631\u0647\u0627',
    icon: Building2,
  },
  {
    to: '/inventory',
    title: 'انبار',
    icon: PackageCheck,
    permission: 'inventory.view',
  },
  {
    to: '/purchases',
    title: 'خرید',
    icon: ShoppingCart,
    permission: 'purchase.view',
  },
  {
    to: '/sales',
    title: 'فروش',
    icon: ReceiptText,
    permission: 'sales.view',
  },
  {
    to: '/production',
    title: 'تولید',
    icon: Factory,
    permission: 'production.view',
  },
  {
    to: '/service?task=tracking',
    title: 'رهگیری مشتری',
    icon: Search,
    permission: 'service.view',
  },
  {
    to: '/service/reception',
    title: 'پذیرش دستگاه',
    icon: ClipboardPlus,
    permission: 'service.reception',
  },
  {
    to: '/service?task=queue',
    title: 'صف تعمیرات',
    icon: ClipboardCheck,
    permission: 'service.view',
  },
  {
    to: '/service?task=technical',
    title: 'بررسی فنی',
    icon: Search,
    permission: 'service.view',
  },
  {
    to: '/service?task=repair',
    title: 'در حال تعمیر',
    icon: Wrench,
    permission: 'service.view',
  },
  {
    to: '/service?task=delivery',
    title: 'آماده تحویل',
    icon: PackageCheck,
    permission: 'service.view',
  },
  {
    to: '/service/reports',
    title: 'گزارش خدمات',
    icon: BarChart3,
    permission: 'service.view',
  },
  {to: '/service?task=waiting-customer', title: 'در انتظار تأیید مشتری', icon: ClipboardCheck, permission: 'service.view'},
  {to: '/service?task=waiting-part', title: 'در انتظار قطعه', icon: ClipboardCheck, permission: 'service.view'},
  {to: '/service?task=final-test', title: 'آزمون نهایی', icon: ClipboardCheck, permission: 'service.view'},
  {to: '/service?task=archive', title: 'بایگانی پرونده‌ها', icon: ClipboardCheck, permission: 'service.view'},
  {
    to: '/reports',
    title: 'گزارش‌ها',
    icon: FileText,
    permission: 'reports.view',
  },
  {
    to: '/settings',
    title: 'تنظیمات',
    icon: Settings,
    permission: 'system.settings.manage',
  },
  {
    to: '/users',
    title: 'کاربران و دسترسی‌ها',
    icon: UserCog,
    permission: 'system.users.manage',
  },
  {
    to: '/audit',
    title: 'گزارش سابقه عملیات',
    icon: FileText,
    permission: 'system.audit.view',
  },
];

const workspaces: readonly WorkspaceDefinition[] = [
  {
    id: 'accounting',
    title: 'حسابداری',
    sectionTitle: 'واحد حسابداری و بازرگانی',
    defaultPath: '/accounting',
    icon: Calculator,
    navigationPaths: [
      '/accounting',
      '/accounting/records',
      '/treasury',
      '/parties',
      '/products',
      '/organization',
      '/inventory',
      '/purchases',
      '/sales',
      '/production',
      '/reports',
      '/settings',
      '/users',
    ],
  },
  {
    id: 'service',
    title: 'خدمات و گارانتی',
    sectionTitle: 'واحد خدمات پس از فروش و گارانتی',
    defaultPath: '/service',
    icon: Wrench,
    navigationPaths: [
      '/service?task=tracking',
      '/service/reception',
      '/service?task=queue',
      '/service?task=technical',
      '/service?task=repair',
      '/service?task=delivery',
      '/service?task=waiting-customer',
      '/service?task=waiting-part',
      '/service?task=final-test',
      '/service?task=archive',
      '/service/reports',
    ],
  },
];

function Field({
  label,
  name,
  type = 'text',
  required = false,
  autoComplete,
  defaultValue,
  min,
  minLength,
  maxLength,
  pattern,
  title,
  leadingIcon: LeadingIcon,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  defaultValue?: string;
  min?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  title?: string;
  leadingIcon?: LucideIcon;
}) {
  return (
    <label className={LeadingIcon ? 'field field--with-leading-icon' : 'field'}>
      <span>
        {label}
        {required ? <b aria-label="الزامی"> *</b> : null}
      </span>
      {LeadingIcon ? <LeadingIcon className="field-leading-icon" aria-hidden /> : null}
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        min={min}
        minLength={minLength}
        maxLength={maxLength}
        pattern={pattern}
        title={title}
      />
    </label>
  );
}

function SubmitMessage({
  error,
  success,
}: {
  error: string | null;
  success?: string | null;
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

function LoginPage({company, onAuthenticated}: LoginProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecoveryHelp, setShowRecoveryHelp] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(readThemeMode);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (!username) {
      setError('نام کاربری الزامی است');
      return;
    }
    if (!password) {
      setError('رمز عبور الزامی است');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await postJson('/api/auth/login', {
        username,
        password,
      });
      await onAuthenticated();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={`auth-page ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      <section className="auth-brand" aria-label="معرفی سامانه">
        <BrandLogo variant="auth" logoUrl={company?.logoUrl} />
        <h1>{company?.nameFa ?? 'دیاکو الکترونیکس'}</h1>
        <p>سامانه یکپارچه مدیریت مالی، تولید و خدمات</p>
        <ul>
          <li><ShieldCheck aria-hidden /> دسترسی هر کاربر براساس نقش و مجوز</li>
          <li><Factory aria-hidden /> تولید، انبار و بهای تمام‌شده یکپارچه</li>
          <li><Wrench aria-hidden /> گارانتی و رهگیری خدمات پس از فروش</li>
        </ul>
      </section>
      <section className="auth-panel">
        <div className="auth-theme-control">
          <ThemeControl onThemeChanged={setTheme} />
        </div>
        <form className="auth-card" noValidate onSubmit={submit}>
          <div className="mobile-brand">
            <BrandLogo variant="mobile" logoUrl={company?.logoUrl} />
            <strong>{company?.nameFa ?? 'دیاکو الکترونیکس'}</strong>
          </div>
          <header className="auth-card-heading">
            <ContextHelpButton help={appHelp.login} />
            <h2>خوش آمدید</h2>
          </header>
          <Field
            label="نام کاربری"
            name="username"
          required
          autoComplete="username"
          leadingIcon={User}
        />
          <PasswordField
            label="رمز عبور"
            name="password"
            required
            autoComplete="current-password"
            showLockIcon
          />
          <div className="auth-submit-message">
            <SubmitMessage error={error} />
          </div>
          <button className="button primary wide" disabled={pending} type="submit">
            {pending ? 'در حال بررسی…' : 'ورود به سامانه'}
          </button>
          <button
            className="auth-recovery-link"
            type="button"
            aria-controls="login-recovery-guide"
            aria-expanded={showRecoveryHelp}
            onClick={() => setShowRecoveryHelp((visible) => !visible)}
          >
            نام کاربری یا رمز عبور را فراموش کرده‌اید؟
          </button>
          {showRecoveryHelp ? (
            <div
              className="auth-recovery-note"
              id="login-recovery-guide"
              role="region"
              aria-label="راهنمای بازیابی اطلاعات ورود"
            >
              <h3>بازیابی اطلاعات ورود</h3>
              <section className="auth-recovery-option">
                <div className="auth-recovery-option-heading">
                  <Users aria-hidden />
                  <strong>کاربر عادی</strong>
                </div>
                <p>
                  <b>نام کاربری:</b> فقط مدیر اصلی سامانه می‌تواند آن را از
                  بخش مدیریت کاربران مشاهده و به شما اعلام کند.
                </p>
                <p>
                  <b>رمز عبور:</b> مدیر اصلی یک رمز موقت برای شما تعیین می‌کند.
                  پس از ورود با رمز موقت، باید رمز شخصی جدیدی انتخاب کنید.
                </p>
              </section>
              <section className="auth-recovery-option admin">
                <div className="auth-recovery-option-heading">
                  <ShieldCheck aria-hidden />
                  <strong>مدیر اصلی سامانه</strong>
                </div>
                <p>
                  بازیابی فقط روی کامپیوتر سرور و با تأیید مدیر ویندوز انجام
                  می‌شود. دکمه زیر مراحل را به‌صورت گرافیکی نمایش می‌دهد.
                </p>
                <AdminRecoveryLauncher />
                <p className="auth-recovery-assurance">
                  این عملیات هیچ اطلاعات مالی، انبار، تولید یا خدمات را حذف نمی‌کند.
                </p>
              </section>
            </div>
          ) : null}
        </form>
      </section>
    </main>
  );
}

function SetupPage({onCompleted}: SetupProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    const form = new FormData(event.currentTarget);
    const adminPassword = String(form.get('adminPassword') ?? '');
    const passwordConfirmation = String(
      form.get('adminPasswordConfirmation') ?? '',
    );
    if (adminPassword !== passwordConfirmation) {
      setError('رمز عبور و تکرار آن یکسان نیستند.');
      const confirmationField = event.currentTarget.elements.namedItem(
        'adminPasswordConfirmation',
      );
      if (confirmationField instanceof HTMLInputElement) {
        confirmationField.focus();
      }
      return;
    }
    setPending(true);
    try {
      await postJson('/api/setup', {
        companyName: String(form.get('companyName') ?? ''),
        companyEnglishName: String(form.get('companyEnglishName') ?? '') || null,
        branchName: String(form.get('branchName') ?? ''),
        adminFullName: String(form.get('adminFullName') ?? ''),
        adminUsername: String(form.get('adminUsername') ?? ''),
        adminPassword,
        defaultAmountUnit: String(form.get('defaultAmountUnit') ?? 'IRR'),
        fiscalYearTitle: String(form.get('fiscalYearTitle') ?? ''),
        fiscalYearStartsOn: jalaliInputToIso(String(form.get('fiscalYearStartsOn') ?? '')),
        fiscalYearEndsOn: jalaliInputToIso(String(form.get('fiscalYearEndsOn') ?? '')),
      });
      await onCompleted();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="setup-page">
      <form className="setup-card" onSubmit={submit}>
        <header className="page-heading">
          <ContextHelpButton help={appHelp.setup} />
          <div className="heading-icon"><Settings aria-hidden /></div>
          <div>
            <p>راه‌اندازی فقط یک‌بار انجام می‌شود</p>
            <h1>تنظیمات اولیه</h1>
          </div>
        </header>
        <div className="form-section">
          <div className="form-section-heading">
            <ContextHelpButton help={appHelp.setupCompany} />
            <h2>مشخصات مجموعه</h2>
          </div>
          <div className="form-grid">
            <Field
              label="نام شرکت یا کارگاه"
              name="companyName"
              required
              defaultValue="دیاکو الکترونیکس"
            />
            <Field label="نام انگلیسی" name="companyEnglishName" />
            <Field
              label="نام شعبه اصلی"
              name="branchName"
              required
              defaultValue="شعبه اصلی"
            />
            <label className="field">
              <span>واحد نمایش پیش‌فرض *</span>
              <select name="defaultAmountUnit" defaultValue="IRR">
                <option value="IRR">ریال</option>
                <option value="TOMAN">تومان</option>
              </select>
            </label>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-heading">
            <ContextHelpButton help={appHelp.setupAdmin} />
            <h2>مدیر سامانه</h2>
          </div>
          <div className="form-grid">
            <Field label="نام و نام خانوادگی" name="adminFullName" required />
            <Field
              label="نام کاربری انگلیسی"
              name="adminUsername"
              required
              autoComplete="username"
              minLength={3}
              maxLength={80}
              pattern="[A-Za-z0-9._-]+"
              title="فقط حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط مجاز است."
            />
            <PasswordField
              label="رمز عبور"
              name="adminPassword"
              required
              autoComplete="new-password"
              minLength={10}
              maxLength={256}
              pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}"
              title="حداقل ۱۰ نویسه شامل حرف بزرگ انگلیسی، حرف کوچک انگلیسی و عدد وارد کنید."
            />
            <PasswordField
              label="تکرار رمز عبور"
              name="adminPasswordConfirmation"
              required
              autoComplete="new-password"
              minLength={10}
              maxLength={256}
              pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}"
              title="رمز عبور را دقیقاً مانند فیلد قبلی وارد کنید."
            />
          </div>
          <p className="field-help">
            رمز عبور باید حداقل ۱۰ نویسه و شامل حروف بزرگ انگلیسی، حروف کوچک انگلیسی و عدد باشد؛ هر دو فیلد رمز باید کاملاً یکسان باشند.
          </p>
        </div>
        <div className="form-section">
          <div className="form-section-heading">
            <ContextHelpButton help={appHelp.setupFiscalYear} />
            <h2>سال مالی آغازین</h2>
          </div>
          <div className="form-grid">
            <Field
              label={'\u0639\u0646\u0648\u0627\u0646 \u0633\u0627\u0644 \u0645\u0627\u0644\u06cc'}
              name="fiscalYearTitle"
              required
            />
            <JalaliDateField
              label={'\u062a\u0627\u0631\u06cc\u062e \u0634\u0631\u0648\u0639'}
              name="fiscalYearStartsOn"
              required
            />
            <JalaliDateField
              label={'\u062a\u0627\u0631\u06cc\u062e \u067e\u0627\u06cc\u0627\u0646'}
              name="fiscalYearEndsOn"
              required
            />
          </div>
          <p className="field-help">
            {'\u062a\u0645\u0627\u0645 \u062a\u0627\u0631\u06cc\u062e\u200c\u0647\u0627 \u0628\u0647 \u0635\u0648\u0631\u062a \u0647\u062c\u0631\u06cc \u0634\u0645\u0633\u06cc \u0648\u0627\u0631\u062f \u0648 \u0646\u0645\u0627\u06cc\u0634 \u062f\u0627\u062f\u0647 \u0645\u06cc\u200c\u0634\u0648\u0646\u062f.'}
          </p>
        </div>
        <SubmitMessage error={error} />
        <div className="form-actions">
          <button className="button primary" disabled={pending} type="submit">
            {pending ? 'در حال ایجاد…' : 'ایجاد سامانه و ورود'}
          </button>
        </div>
      </form>
    </main>
  );
}

function formatAmount(value: unknown, unit: AmountUnit): string {
  if (value === null || value === undefined || value === '') return '—';
  try {
    const amount = BigInt(String(value));
    const displayed = unit === 'TOMAN' ? amount / 10n : amount;
    return `${new Intl.NumberFormat('fa-IR').format(displayed)} ${unit === 'TOMAN' ? 'تومان' : 'ریال'}`;
  } catch {
    return String(value);
  }
}

function formatDate(value: unknown): string {
  return formatJalaliDate(value);
}

function ListPage({
  title,
  description,
  endpoint,
  columns,
  amountUnit,
  help,
}: ListPageProps) {
  const [rows, setRows] = useState<ReadonlyArray<Record<string, unknown>>>([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const data = await api<ReadonlyArray<Record<string, unknown>>>(endpoint);
      setRows(data);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={'content-page' + (endpoint.startsWith('/api/inventory/') ? ' business-forms' : '')}>
      <header className="page-heading compact">
        <ContextHelpButton help={help} />
        <div>
          <p>{description}</p>
          <h1>{title}</h1>
        </div>
      </header>
      <SubmitMessage error={error} />
      <div className="table-card">
        {pending ? (
          <div className="empty-state">در حال دریافت اطلاعات…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">هنوز رکوردی ثبت نشده است.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((column) => <th key={column.key}>{column.title}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={String(row.id ?? index)}>
                    {columns.map((column) => {
                      const value = row[column.key];
                      const shown =
                        column.kind === 'amount'
                          ? formatAmount(value, amountUnit)
                          : column.kind === 'date'
                            ? formatDate(value)
                            : String(value ?? '—');
                      return <td key={column.key}>{shown}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function HomePage({session}: {session: AppSession}) {
  const hasAnyPermission = (permissions: readonly string[]) =>
    permissions.some((permission) => session.user.permissions.includes(permission));
  const canUseCommerce = hasAnyPermission([
    'accounting.view',
    'treasury.view',
    'purchase.view',
    'sales.view',
    'inventory.view',
    'reports.view',
  ]);
  const canUseService = hasAnyPermission(['service.view']);

  return (
    <section className="content-page system-hub-page">
      <div className="section-heading system-hub-heading">
        <ContextHelpButton help={appHelp.dashboardModules} />
        <div>
          <h2>انتخاب سامانه کاری</h2>
          <p>دو فضای مستقل با اطلاعات مشترک کالا، مشتری، فروش و گارانتی</p>
        </div>
      </div>
      <div className="system-hub-grid">
        {canUseCommerce && (
          <NavLink
            className="system-hub-card system-hub-card--commerce"
            to="/accounting"
            aria-label="ورود به حسابداری و بازرگانی"
          >
            <span className="system-hub-card-accent" aria-hidden />
            <span className="system-hub-card-heading">
              <span className="system-hub-icon"><Calculator aria-hidden /></span>
              <strong>حسابداری و بازرگانی</strong>
              <small>مدیریت گردش مالی و عملیات تجاری</small>
            </span>
            <span className="system-hub-features">
              <span><ReceiptText aria-hidden /> خرید، فروش و فاکتورهای تجاری</span>
              <span><Boxes aria-hidden /> انبار، کالا و موجودی</span>
              <span><WalletCards aria-hidden /> خزانه، اسناد و گزارش‌های مالی</span>
            </span>
            <span className="system-hub-action">ورود به حسابداری و بازرگانی</span>
          </NavLink>
        )}
        {canUseService && (
          <NavLink
            className="system-hub-card system-hub-card--service"
            to="/service"
            aria-label="ورود به خدمات پس از فروش و گارانتی"
          >
            <span className="system-hub-card-accent" aria-hidden />
            <span className="system-hub-card-heading">
              <span className="system-hub-icon"><Wrench aria-hidden /></span>
              <strong>خدمات پس از فروش و گارانتی</strong>
              <small>پیگیری دستگاه، تعمیر و تعهدات گارانتی</small>
            </span>
            <span className="system-hub-features">
              <span><PackageCheck aria-hidden /> استعلام سریال و وضعیت گارانتی</span>
              <span><Wrench aria-hidden /> پذیرش، تعمیر و قطعات مصرفی</span>
              <span><ShieldCheck aria-hidden /> تحویل، سوابق خدمات و رهگیری</span>
            </span>
            <span className="system-hub-action">ورود به خدمات و گارانتی</span>
          </NavLink>
        )}
      </div>
      {!canUseCommerce && !canUseService && (
        <div className="system-hub-empty">
          برای نقش فعلی شما دسترسی به هیچ‌یک از سامانه‌ها تعریف نشده است.
        </div>
      )}
    </section>
  );
}

function AppShell({session, onSessionChanged}: ShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [updatingUnit, setUpdatingUnit] = useState(false);
  const [serviceSidebarWidth, setServiceSidebarWidth] = useState(readServiceSidebarWidth);
  const isSystemSelection = location.pathname === '/';
  const visibleNavigation = useMemo(
    () =>
      navigation.filter(
        (item) =>
          !item.permission ||
          session.user.permissions.includes(item.permission),
      ),
    [session.user.permissions],
  );
  const activeWorkspace: WorkspaceId =
    location.pathname.startsWith('/service') ||
    new URLSearchParams(location.search).get('workspace') === 'service'
      ? 'service'
      : 'accounting';
  const availableWorkspaces = useMemo(
    () =>
      workspaces.filter((workspace) =>
        visibleNavigation.some((item) =>
          workspace.navigationPaths.includes(item.to),
        ),
      ),
    [visibleNavigation],
  );
  const workspace = workspaces.find((item) => item.id === activeWorkspace) ?? workspaces[0]!;
  const workspaceNavigation = useMemo(
    () =>
      visibleNavigation.filter((item) =>
        workspace.navigationPaths.includes(item.to),
      ),
    [visibleNavigation, workspace],
  );

  function openWorkspace(nextWorkspace: WorkspaceDefinition) {
    setMenuOpen(false);
    navigate(nextWorkspace.defaultPath);
  }

  function workspaceDestination(item: NavigationItem): string {
    if (activeWorkspace === 'service' && !item.to.startsWith('/service')) {
      return item.to + '?workspace=service';
    }
    return item.to;
  }

  function sidebarItemClass(item: NavigationItem, isRouteActive: boolean): string {
    if (!item.to.startsWith('/service?task=')) return isRouteActive ? 'active' : '';
    const itemTask = new URL(item.to, window.location.origin).searchParams.get('task');
    const activeTask = new URLSearchParams(location.search).get('task');
    return itemTask === activeTask ? 'active' : '';
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(SERVICE_SIDEBAR_WIDTH_KEY, String(serviceSidebarWidth));
    } catch {
      // The current layout remains usable if browser storage is unavailable.
    }
  }, [serviceSidebarWidth]);

  useEffect(() => {
    let disposed = false;
    const sendHeartbeat = () => {
      if (disposed || document.visibilityState === 'hidden') return;
      void postJson('/api/auth/heartbeat', {}).catch(() => {
        // The normal authentication-required event handles an expired session.
      });
    };
    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') sendHeartbeat();
    };
    const onFocus = () => sendHeartbeat();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [session.user.id]);

  function updateServiceSidebarWidth(width: number): void {
    setServiceSidebarWidth(clampServiceSidebarWidth(width));
  }

  function beginServiceSidebarResize(event: PointerEvent<HTMLDivElement>): void {
    if (activeWorkspace !== 'service') return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = serviceSidebarWidth;
    const onMove = (moveEvent: globalThis.PointerEvent) => {
      updateServiceSidebarWidth(startWidth + startX - moveEvent.clientX);
    };
    const onEnd = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  }

  function handleServiceSidebarResizeKey(event: KeyboardEvent<HTMLDivElement>): void {
    let nextWidth: number | null = null;
    if (event.key === 'ArrowLeft') nextWidth = serviceSidebarWidth + 15;
    if (event.key === 'ArrowRight') nextWidth = serviceSidebarWidth - 15;
    if (event.key === 'Home') nextWidth = SERVICE_SIDEBAR_MIN_WIDTH;
    if (event.key === 'End') nextWidth = SERVICE_SIDEBAR_MAX_WIDTH;
    if (nextWidth === null) return;
    event.preventDefault();
    updateServiceSidebarWidth(nextWidth);
  }

  async function logout() {
    await api('/api/auth/logout', {method: 'POST'});
    await onSessionChanged();
    navigate('/');
  }

  async function changeUnit(unit: AmountUnit) {
    if (unit === session.user.preferredAmountUnit || updatingUnit) return;
    setUpdatingUnit(true);
    try {
      await postJson(
        '/api/auth/me/preferences',
        {
          preferredAmountUnit: unit,
          preferredWorkspace: session.user.preferredWorkspace,
        },
        'PATCH',
      );
      await onSessionChanged();
    } finally {
      setUpdatingUnit(false);
    }
  }

  return (
    <div
      style={
        activeWorkspace === 'service'
          ? ({'--service-sidebar-width': `${serviceSidebarWidth}px`} as CSSProperties)
          : undefined
      }
      className={
        isSystemSelection
          ? 'app-shell app-shell--system-selection'
          : activeWorkspace === 'service'
            ? 'app-shell app-shell--workspace-service'
            : 'app-shell'
      }
    >
      <header className="topbar">
        {!isSystemSelection && (
          <button
            className="icon-button mobile-only"
            type="button"
            aria-label="بازکردن منو"
            onClick={() => setMenuOpen(true)}
          >
            <Menu aria-hidden />
          </button>
        )}
        <BrandLogo variant="topbar" logoUrl={session.company.logoUrl} />
        <div className="topbar-title">
          <div>
            <strong>{session.company.nameFa}</strong>
          </div>
        </div>
        <div className="topbar-tools">

          <div className="unit-switch" aria-label="واحد نمایش مبلغ">
            <button
              type="button"
              className={session.user.preferredAmountUnit === 'IRR' ? 'active' : ''}
              disabled={updatingUnit}
              onClick={() => void changeUnit('IRR')}
            >
              ریال
            </button>
            <button
              type="button"
              className={session.user.preferredAmountUnit === 'TOMAN' ? 'active' : ''}
              disabled={updatingUnit}
              onClick={() => void changeUnit('TOMAN')}
            >
              تومان
            </button>
          </div>
        </div>
      </header>
      {!isSystemSelection && menuOpen ? (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="بستن منو"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      {!isSystemSelection && (
        <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        {activeWorkspace === 'service' ? (
          <div
            aria-label="تغییر عرض منوی خدمات"
            aria-orientation="vertical"
            aria-valuemax={SERVICE_SIDEBAR_MAX_WIDTH}
            aria-valuemin={SERVICE_SIDEBAR_MIN_WIDTH}
            aria-valuenow={serviceSidebarWidth}
            className="service-sidebar-resize-handle"
            onKeyDown={handleServiceSidebarResizeKey}
            onPointerDown={beginServiceSidebarResize}
            role="slider"
            tabIndex={0}
            title="برای تغییر عرض منو بکشید"
          />
        ) : null}
        <div className="sidebar-mobile-heading">
          <strong>{workspace.title}</strong>
          <button
            className="icon-button"
            type="button"
            aria-label="بستن منو"
            onClick={() => setMenuOpen(false)}
          >
            <X aria-hidden />
          </button>
        </div>

        <button
          className="workspace-hub-link"
          type="button"
          onClick={() => {
            setMenuOpen(false);
            navigate('/');
          }}
        >
          <Home aria-hidden />
          انتخاب سامانه
        </button>
        <div
          className={
            availableWorkspaces.length === 1
              ? 'workspace-switch workspace-switch--single'
              : 'workspace-switch'
          }
          aria-label="جابجایی سامانه"
        >
          {availableWorkspaces.map((item) => {
            const Icon = item.icon;
            return (
              <button
                aria-pressed={activeWorkspace === item.id}
                className={activeWorkspace === item.id ? 'active' : ''}
                key={item.id}
                onClick={() => openWorkspace(item)}
                type="button"
              >
                <Icon aria-hidden />
                <span>{item.title}</span>
              </button>
            );
          })}
        </div>
        <div className={'workspace-section-heading workspace-section-heading--' + workspace.id}>
          <span>{workspace.sectionTitle}</span>
          <workspace.icon aria-hidden />
        </div>
        <nav className={'workspace-navigation workspace-navigation--' + workspace.id}>
          {workspaceNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                className={({isActive}) => sidebarItemClass(item, isActive)}
                key={item.to}
                to={workspaceDestination(item)}
                end={item.to.startsWith('/service')}
                onClick={() => setMenuOpen(false)}
              >
                <Icon aria-hidden />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
        <button className="logout-button" type="button" onClick={() => void logout()}>
          <LogOut aria-hidden />
          خروج از سامانه
        </button>
        </aside>
      )}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage session={session} />} />
          <Route
            path="/accounting"
            element={
              <CommerceDashboard permissions={session.user.permissions} />
            }
          />
          <Route
            path="/accounting/records"
            element={
              <AccountingPage
                amountUnit={session.user.preferredAmountUnit}
                permissions={session.user.permissions}
              />
            }
          />
          <Route
            path="/parties"
            element={
              <PartiesPage
                amountUnit={session.user.preferredAmountUnit}
                isMainAdmin={session.user.roles.some((role) => role.code === 'administrator')}
                permissions={session.user.permissions}
              />
            }
          />
          <Route
            path="/products"
            element={
              <ProductsPage
                amountUnit={session.user.preferredAmountUnit}
                permissions={session.user.permissions}
              />
            }
          />
          <Route
            path="/organization"
            element={<OrganizationPage permissions={session.user.permissions} />}
          />
          <Route
            path="/inventory"
            element={
              <ListPage
                title="موجودی انبارها"
                description="موجودی واقعی و میانگین موزون"
                endpoint="/api/inventory/balances"
                help={appHelp.inventory}
                amountUnit={session.user.preferredAmountUnit}
                columns={[
                  {key: 'warehouseName', title: 'انبار'},
                  {key: 'productCode', title: 'کد کالا'},
                  {key: 'productName', title: 'کالا'},
                  {key: 'quantity', title: 'موجودی'},
                  {key: 'averageCostIrr', title: 'میانگین بها', kind: 'amount'},
                ]}
              />
            }
          />
          <Route
            path="/purchases"
            element={
              <PurchasesPage
                amountUnit={session.user.preferredAmountUnit}
                permissions={session.user.permissions}
              />
            }
          />
          <Route
            path="/sales"
            element={
              <SalesPage
                amountUnit={session.user.preferredAmountUnit}
                permissions={session.user.permissions}
              />
            }
          />
          <Route
            path="/production"
            element={
              <ProductionPage
                amountUnit={session.user.preferredAmountUnit}
                permissions={session.user.permissions}
              />
            }
          />
          <Route path="/service" element={<ServicePage amountUnit={session.user.preferredAmountUnit} companyName={session.company.nameFa} permissions={session.user.permissions} />} />
          <Route path="/service/reception" element={<ServiceReceptionPage companyName={session.company.nameFa} permissions={session.user.permissions} />} />
          <Route path="/service/reports" element={<ServiceReportsPanel amountUnit={session.user.preferredAmountUnit} />} />
          <Route
            path="/treasury"
            element={
              <TreasuryPage
                amountUnit={session.user.preferredAmountUnit}
                permissions={session.user.permissions}
              />
            }
          />
          <Route
            path="/reports"
            element={
              <AccountingPage
                amountUnit={session.user.preferredAmountUnit}
                initialTab="reports"
                permissions={session.user.permissions}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <SettingsPage
                companyName={session.company.nameFa}
                companyLogoUrl={session.company.logoUrl}
                permissions={session.user.permissions}
                onCompanyChanged={onSessionChanged}
              />
            }
          />
          <Route path="/users" element={<UserManagementPage permissions={session.user.permissions} />} />
          <Route path="/audit" element={<AuditLogPage permissions={session.user.permissions} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Application() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      setBootstrap(await getBootstrap());
    } catch (caught) {
      setLoadError(errorMessage(caught));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleAuthenticationRequired = () => {
      void refresh().finally(() => navigate('/', {replace: true}));
    };
    window.addEventListener(AUTHENTICATION_REQUIRED_EVENT, handleAuthenticationRequired);
    return () => window.removeEventListener(AUTHENTICATION_REQUIRED_EVENT, handleAuthenticationRequired);
  }, [navigate, refresh]);

  if (loadError) {
    return (
      <main className="fatal-page">
        <div className="fatal-card">
          <ShieldCheck aria-hidden />
          <h1>ارتباط با سرور برقرار نشد</h1>
          <p>{loadError}</p>
          <button className="button primary" type="button" onClick={() => void refresh()}>
            تلاش دوباره
          </button>
        </div>
      </main>
    );
  }
  if (!bootstrap) {
    return <main className="loading-page">در حال آماده‌سازی سامانه…</main>;
  }
  if (bootstrap.setupRequired) {
    return <SetupPage onCompleted={refresh} />;
  }
  if (!bootstrap.user || !bootstrap.company) {
    return <LoginPage company={bootstrap.company} onAuthenticated={refresh} />;
  }
  return (
    <AppShell
      session={{company: bootstrap.company, user: bootstrap.user}}
      onSessionChanged={refresh}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/track" element={<ServiceTrackingPage />} />
        <Route path="/track/:trackingCode" element={<ServiceTrackingPage />} />
        <Route path="*" element={<Application />} />
      </Routes>
    </BrowserRouter>
  );
}
