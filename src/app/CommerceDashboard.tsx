import {
  Boxes,
  Calculator,
  FileText,
  ReceiptText,
  ShoppingCart,
  Users,
} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import {NavLink} from 'react-router-dom';
import {api, errorMessage} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import './commerce-dashboard.css';

interface CommerceDashboardProps {
  permissions: readonly string[];
}

interface CommerceSummary {
  salesInvoices: number;
  purchaseInvoices: number;
  activeProducts: number;
  activeParties: number;
}

const emptySummary: CommerceSummary = {
  salesInvoices: 0,
  purchaseInvoices: 0,
  activeProducts: 0,
  activeParties: 0,
};

export function CommerceDashboard({permissions}: CommerceDashboardProps) {
  const [summary, setSummary] = useState<CommerceSummary>(emptySummary);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canOpen = (permission: string) => permissions.includes(permission);

  const load = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      setSummary(await api<CommerceSummary>('/api/accounting/dashboard'));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = [
    {label: 'فاکتورهای فروش', value: summary.salesInvoices, icon: ReceiptText, tone: 'blue'},
    {label: 'فاکتورهای خرید', value: summary.purchaseInvoices, icon: ShoppingCart, tone: 'amber'},
    {label: 'کالاهای فعال', value: summary.activeProducts, icon: Boxes, tone: 'green'},
    {label: 'طرف‌حساب‌های فعال', value: summary.activeParties, icon: Users, tone: 'violet'},
  ] as const;
  const actions = [
    {title: 'فاکتور فروش', detail: 'ثبت، پیگیری و قطعی‌سازی فروش', to: '/sales', icon: ReceiptText, permission: 'sales.view'},
    {title: 'فاکتور خرید', detail: 'ثبت خرید و ورود کالا به انبار', to: '/purchases', icon: ShoppingCart, permission: 'purchase.view'},
    {title: 'کالا و خدمات', detail: 'تعریف کالا، قطعه، محصول و خدمت', to: '/products', icon: Boxes, permission: 'inventory.view'},
    {title: 'طرف‌حساب‌ها', detail: 'مدیریت مشتریان و تأمین‌کنندگان', to: '/parties', icon: Users, permission: 'parties.view'},
    {title: 'اسناد حسابداری', detail: 'ثبت سند، سال مالی و دفاتر', to: '/accounting/records', icon: Calculator, permission: 'accounting.view'},
    {title: 'گزارش‌های مالی', detail: 'دفاتر، تراز، سود و زیان و ترازنامه', to: '/reports', icon: FileText, permission: 'reports.view'},
  ] as const;

  return (
    <section className="content-page commerce-dashboard">
      <header className="page-heading compact">
        <ContextHelpButton help={appHelp.accounting} />
        <div>
          <p>نمای واقعی عملیات خرید، فروش، کالا و طرف‌حساب</p>
          <h1>داشبورد حسابداری و بازرگانی</h1>
        </div>
      </header>
      {error ? <div className="form-message error" role="alert">{error}</div> : null}
      <div className="commerce-metric-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className={'commerce-metric commerce-metric--' + metric.tone} key={metric.label}>
              <Icon aria-hidden />
              <div>
                <span>{metric.label}</span>
                <strong>{pending ? '—' : new Intl.NumberFormat('fa-IR').format(metric.value)}</strong>
              </div>
            </article>
          );
        })}
      </div>
      <div className="commerce-actions-heading">
        <h2>دسترسی‌های عملیاتی</h2>
        <p>هر کارت شما را به بخش واقعی و مجاز سامانه می‌برد.</p>
      </div>
      <div className="commerce-action-grid">
        {actions.filter((action) => canOpen(action.permission)).map((action) => {
          const Icon = action.icon;
          return (
            <NavLink className="commerce-action-card" key={action.to} to={action.to}>
              <span className="commerce-action-icon"><Icon aria-hidden /></span>
              <span><strong>{action.title}</strong><small>{action.detail}</small></span>
            </NavLink>
          );
        })}
      </div>
    </section>
  );
}
