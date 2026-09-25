import {
  BarChart3,
  ClipboardCheck,
  ClipboardPlus,
  PackageCheck,
  Search,
  Truck,
  Wrench,
} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import type {AmountUnit} from '../../shared/contracts.js';
import {api, errorMessage} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {
  ServiceOrderPanel,
  type ServiceOrderStatusFilter,
} from './ServiceOrderPanel.js';
import {ServiceSerialTrackingDialog} from './ServiceSerialTrackingDialog.js';
import type {ServiceOptions} from './service.types.js';
import './service.css';

interface Props {
  amountUnit: AmountUnit;
  companyName: string;
  permissions: readonly string[];
}

type ServiceWorkflowSelection = 'tracking' | ServiceOrderStatusFilter;

const emptyOptions: ServiceOptions = {
  branches: [],
  warehouses: [],
  products: [],
  balances: [],
};
interface ServiceDashboard {statusCounts: Record<string, number>; activeCount: string; assignedToMe: string; unassigned: string; overdue: string; highPriority: string}

export function ServicePage({amountUnit, companyName, permissions}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [options, setOptions] = useState<ServiceOptions>(emptyOptions);
  const [dashboard, setDashboard] = useState<ServiceDashboard | null>(null);
  const [statusFilter, setStatusFilter] = useState<ServiceOrderStatusFilter>('all');
  const [selectedWorkflow, setSelectedWorkflow] = useState<ServiceWorkflowSelection>('all');
  const [serialTrackerOpen, setSerialTrackerOpen] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canReceive = permissions.includes('service.reception');

  const loadOptions = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const [nextOptions, nextDashboard] = await Promise.all([api<ServiceOptions>('/api/service/options'), api<ServiceDashboard>('/api/service/dashboard')]);
      setOptions(nextOptions); setDashboard(nextDashboard);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  async function handleChanged(): Promise<void> {
    await loadOptions();
  }

  async function handleCreated(): Promise<void> {
    setRefreshVersion((value) => value + 1);
    await loadOptions();
  }

  function focusQueue(status: ServiceOrderStatusFilter): void {
    setStatusFilter(status);
    setSelectedWorkflow(status);
    window.requestAnimationFrame(() => {
      document.getElementById('service-queue')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  function openReception(): void {
    navigate('/service/reception');
  }

  function openSerialTracker(): void {
    setSelectedWorkflow('tracking');
    setSerialTrackerOpen(true);
  }

  function openReport(): void {
    navigate('/service/reports');
  }

  function handleStatusFilterChange(status: ServiceOrderStatusFilter): void {
    setStatusFilter(status);
    setSelectedWorkflow(status);
  }

  function closeSerialTracker(): void {
    setSerialTrackerOpen(false);
    if (new URLSearchParams(location.search).has('task')) {
      navigate('/service', {replace: true});
    }
  }

  useEffect(() => {
    const task = new URLSearchParams(location.search).get('task');
    if (!task) return;
    if (task === 'tracking') {
      openSerialTracker();
      return;
    }
    if (task === 'reception' && canReceive) {
      openReception();
      return;
    }
    if (task === 'queue') focusQueue('received');
    if (task === 'technical') focusQueue('diagnosis');
    if (task === 'repair') focusQueue('repairing');
    if (task === 'delivery') focusQueue('ready_delivery');
    if (task === 'waiting-customer') focusQueue('waiting_customer');
    if (task === 'waiting-part') focusQueue('waiting_part');
    if (task === 'final-test') focusQueue('final_test');
    if (task === 'archive') focusQueue('archive');
  }, [location.search]);

  return (
    <section className="content-page service-page">
      <header className="page-heading compact">
        <ContextHelpButton help={appHelp.service} />
        <div>
          <h1>خدمات و گارانتی</h1>
          <p>پذیرش، گارانتی، تعمیر، قطعات، هزینه، تحویل و رهگیری</p>
        </div>
      </header>

      {error ? <div className="form-message error" role="alert">{error}</div> : null}
      {pending && options.branches.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">در حال دریافت اطلاعات واقعی خدمات…</div>
        </div>
      ) : (
        <>
          <ServiceSerialTrackingDialog
            onClose={closeSerialTracker}
            open={serialTrackerOpen}
          />
          <section className="service-workflow" aria-label="دسترسی سریع خدمات و گارانتی">
            <div className="service-workflow-heading">
              <div>
                <h2>میز کار خدمات و گارانتی</h2>
              </div>
            </div>
            {dashboard ? <div className="service-queue-metrics"><span>فعال <strong>{dashboard.activeCount}</strong></span><span>مسئول من <strong>{dashboard.assignedToMe}</strong></span><span>بدون مسئول <strong>{dashboard.unassigned}</strong></span><span>اولویت بالا <strong>{dashboard.highPriority}</strong></span><span className={Number(dashboard.overdue) ? 'is-overdue' : ''}>از موعد گذشته <strong>{dashboard.overdue}</strong></span></div> : null}
            <div className="service-workflow-grid">
              <button
                aria-pressed={selectedWorkflow === 'tracking'}
                className={'service-workflow-card service-workflow-card--tracking' + (selectedWorkflow === 'tracking' ? ' is-active' : '')}
                onClick={openSerialTracker}
                type="button"
              >
                <span className="service-workflow-icon"><PackageCheck aria-hidden /></span>
                <strong>رهگیری مشتری</strong>
                <small>استعلام وضعیت دستگاه با شماره سریال</small>
              </button>
              {canReceive ? (
                <button
                  className="service-workflow-card service-workflow-card--reception"
                  onClick={openReception}
                  type="button"
                >
                  <span className="service-workflow-icon"><ClipboardPlus aria-hidden /></span>
                  <strong>پذیرش دستگاه</strong>
                  <small>ثبت دستگاه، سریال، مشتری و بررسی اولیه گارانتی</small>
                </button>
              ) : null}
              <button
                aria-pressed={selectedWorkflow === 'received'}
                className={'service-workflow-card' + (selectedWorkflow === 'received' ? ' is-active' : '')}
                onClick={() => focusQueue('received')}
                type="button"
              >
                <span className="service-workflow-icon"><ClipboardCheck aria-hidden /></span>
                <strong>صف تعمیرات</strong>
                <small>دستگاه‌های تازه‌پذیرش‌شده و آماده شروع بررسی</small>
              </button>
              <button
                aria-pressed={selectedWorkflow === 'diagnosis'}
                className={'service-workflow-card' + (selectedWorkflow === 'diagnosis' ? ' is-active' : '')}
                onClick={() => focusQueue('diagnosis')}
                type="button"
              >
                <span className="service-workflow-icon"><Search aria-hidden /></span>
                <strong>بررسی فنی</strong>
                <small>تشخیص ایراد و تعیین نیاز به تعمیر یا قطعه</small>
              </button>
              <button
                aria-pressed={selectedWorkflow === 'repairing'}
                className={'service-workflow-card' + (selectedWorkflow === 'repairing' ? ' is-active' : '')}
                onClick={() => focusQueue('repairing')}
                type="button"
              >
                <span className="service-workflow-icon"><Wrench aria-hidden /></span>
                <strong>در حال تعمیر</strong>
                <small>پرونده‌های تعمیر، تعویض قطعه و ثبت هزینه</small>
              </button>
              <button
                aria-pressed={selectedWorkflow === 'ready_delivery'}
                className={'service-workflow-card' + (selectedWorkflow === 'ready_delivery' ? ' is-active' : '')}
                onClick={() => focusQueue('ready_delivery')}
                type="button"
              >
                <span className="service-workflow-icon"><Truck aria-hidden /></span>
                <strong>آماده تحویل</strong>
                <small>نتیجه نهایی و دستگاه‌های آماده تحویل به مشتری</small>
              </button>
              {([
                ['waiting_customer', 'در انتظار تأیید مشتری'],
                ['waiting_part', 'در انتظار قطعه'],
                ['final_test', 'آزمون نهایی'],
                ['archive', 'بایگانی پرونده‌ها'],
              ] as const).map(([status, title]) => <button key={status} type="button" className={'service-workflow-card' + (selectedWorkflow === status ? ' is-active' : '')} aria-pressed={selectedWorkflow === status} onClick={() => focusQueue(status)}><span className="service-workflow-icon"><ClipboardCheck aria-hidden /></span><strong>{title}</strong><small>{dashboard ? (status === 'archive' ? (dashboard.statusCounts.delivered ?? 0) + (dashboard.statusCounts.cancelled ?? 0) : dashboard.statusCounts[status] ?? 0) + ' پرونده' : 'در حال دریافت…'}</small></button>)}
              <button
                className="service-workflow-card service-workflow-card--report"
                onClick={openReport}
                type="button"
              >
                <span className="service-workflow-icon"><BarChart3 aria-hidden /></span>
                <strong>گزارش خدمات</strong>
                <small>عملکرد واقعی پذیرش، گارانتی، تعمیر و تحویل</small>
              </button>
            </div>
          </section>
          <ServiceOrderPanel
            amountUnit={amountUnit}
            onChanged={handleChanged}
            onStatusFilterChange={handleStatusFilterChange}
            options={options}
            permissions={permissions}
            refreshVersion={refreshVersion}
            statusFilter={statusFilter}
          />
        </>
      )}
    </section>
  );
}
