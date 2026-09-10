import {
  Boxes,
  Building2,
  Calculator,
  ChevronLeft,
  Factory,
  FileText,
  Home,
  LogOut,
  Menu,
  PackageCheck,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  WalletCards,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  FormEvent,
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
  useNavigate,
} from 'react-router-dom';
import type {
  AmountUnit,
  AuthenticatedUser,
  BootstrapResponse,
  CompanyProfile,
} from '../../shared/contracts.js';
import {api, errorMessage, getBootstrap, postJson} from './api.js';
import {AccountingPage} from './AccountingPage.js';
import {ContextHelpButton} from './ContextHelpButton.js';
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
import {ServiceTrackingPage} from './ServiceTrackingPage.js';
import {SettingsPage} from './SettingsPage.js';
import {TreasuryPage} from './TreasuryPage.js';

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

const navigation: readonly NavigationItem[] = [
  {to: '/', title: 'خانه', icon: Home},
  {
    to: '/accounting',
    title: 'حسابداری',
    icon: Calculator,
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
    to: '/service',
    title: 'خدمات و گارانتی',
    icon: Wrench,
    permission: 'service.view',
  },
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
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? <b aria-label="الزامی"> *</b> : null}
      </span>
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
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await postJson('/api/auth/login', {
        username: String(form.get('username') ?? ''),
        password: String(form.get('password') ?? ''),
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
        <div className="brand-mark"><Building2 aria-hidden /></div>
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
        <form className="auth-card" onSubmit={submit}>
          <div className="mobile-brand">
            <div className="brand-mark"><Building2 aria-hidden /></div>
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
          />
          <PasswordField
            label="رمز عبور"
            name="password"
            required
            autoComplete="current-password"
          />
          <SubmitMessage error={error} />
          <button className="button primary wide" disabled={pending} type="submit">
            {pending ? 'در حال بررسی…' : 'ورود به سامانه'}
          </button>
          <button
            className="auth-recovery-link"
            type="button"
            aria-expanded={showRecoveryHelp}
            onClick={() => setShowRecoveryHelp((visible) => !visible)}
          >
            نام کاربری یا رمز عبور را فراموش کرده‌اید؟
          </button>
          {showRecoveryHelp ? (
            <div className="auth-recovery-note" role="status">
              <strong>بازیابی فقط از روی کامپیوتر سرور</strong>
              <p>
                ترمینال را با دسترسی مدیر ویندوز باز کنید و دستور زیر را در
                پوشه برنامه اجرا کنید. هیچ اطلاعات مالی یا عملیاتی حذف نمی‌شود.
              </p>
              <code dir="ltr">npm run recovery</code>
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
    <section className="content-page">
      <header className="page-heading compact">
        <ContextHelpButton help={help} />
        <div>
          <p>{description}</p>
          <h1>{title}</h1>
        </div>
        <button className="button secondary" type="button" onClick={() => void load()}>
          بازخوانی
        </button>
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
  const visibleModules = navigation.filter(
    (item) =>
      item.to !== '/' &&
      (!item.permission || session.user.permissions.includes(item.permission)),
  );
  return (
    <section className="content-page">
      <header className="welcome-card">
        <ContextHelpButton help={appHelp.dashboard} />
        <div>
          <p>امروز به کدام بخش نیاز دارید؟</p>
          <h1>{session.user.fullName}، خوش آمدید</h1>
          <span>
            اطلاعات این صفحه از مجوزهای حساب شما خوانده شده است.
          </span>
        </div>
        <div className="welcome-mark"><Building2 aria-hidden /></div>
      </header>
      <div className="section-heading">
        <ContextHelpButton help={appHelp.dashboardModules} />
        <div>
          <p>دسترسی‌های فعال</p>
          <h2>فضاهای کاری شما</h2>
        </div>
      </div>
      <div className="module-grid">
        {visibleModules.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink className="module-card" to={item.to} key={item.to}>
              <span className="module-icon"><Icon aria-hidden /></span>
              <span>
                <strong>{item.title}</strong>
                <small>ورود به بخش</small>
              </span>
              <ChevronLeft aria-hidden />
            </NavLink>
          );
        })}
      </div>
      <div className="info-card">
        <ShieldCheck aria-hidden />
        <div>
          <strong>نقش‌های فعال</strong>
          <p>{session.user.roles.map((role) => role.name).join('، ') || 'بدون نقش'}</p>
        </div>
      </div>
    </section>
  );
}

function AppShell({session, onSessionChanged}: ShellProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [updatingUnit, setUpdatingUnit] = useState(false);
  const visibleNavigation = useMemo(
    () =>
      navigation.filter(
        (item) =>
          !item.permission ||
          session.user.permissions.includes(item.permission),
      ),
    [session.user.permissions],
  );

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
    <div className="app-shell">
      <header className="topbar">
        <button
          className="icon-button mobile-only"
          type="button"
          aria-label="بازکردن منو"
          onClick={() => setMenuOpen(true)}
        >
          <Menu aria-hidden />
        </button>
        <div className="topbar-brand">
          <div className="brand-mark small"><Building2 aria-hidden /></div>
          <div>
            <strong>{session.company.nameFa}</strong>
            <span>سامانه مدیریت یکپارچه</span>
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
          <div className="user-chip">
            <span>{session.user.fullName.slice(0, 1)}</span>
            <div>
              <strong>{session.user.fullName}</strong>
              <small>{session.user.roles[0]?.name ?? 'کاربر'}</small>
            </div>
          </div>
        </div>
      </header>
      {menuOpen ? (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="بستن منو"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <div className="sidebar-mobile-heading">
          <strong>منوی سامانه</strong>
          <button
            className="icon-button"
            type="button"
            aria-label="بستن منو"
            onClick={() => setMenuOpen(false)}
          >
            <X aria-hidden />
          </button>
        </div>

        <nav>
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
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
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage session={session} />} />
          <Route
            path="/accounting"
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
          <Route path="/service" element={<ServicePage amountUnit={session.user.preferredAmountUnit} permissions={session.user.permissions} />} />
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
                permissions={session.user.permissions}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Application() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
