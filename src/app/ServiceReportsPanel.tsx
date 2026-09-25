import {
  Banknote,
  BarChart3,
  ClipboardCheck,
  Clock3,
  PackageCheck,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import {useCallback, useEffect, useState, type FormEvent} from 'react';
import type {AmountUnit} from '../../shared/contracts.js';
import {api, errorMessage} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {JalaliDateField} from './JalaliDateField.js';
import {jalaliInputToIso} from './jalali-date.js';
import {formatIrrAmount} from './purchase.helpers.js';
import type {ServiceOptions, ServiceReport, ServiceStatus} from './service.types.js';

interface Props {
  amountUnit: AmountUnit;
}

const statusLabels: Record<ServiceStatus, string> = {
  received: 'در صف تعمیرات',
  diagnosis: 'بررسی فنی',
  waiting_customer: 'در انتظار مشتری',
  waiting_part: 'در انتظار قطعه',
  repairing: 'در حال تعمیر',
  final_test: 'آزمون نهایی',
  ready_delivery: 'آماده تحویل',
  delivered: 'تحویل‌شده',
  cancelled: 'لغوشده',
};

function number(value: string | number): string {
  return new Intl.NumberFormat('fa-IR', {maximumFractionDigits: 2}).format(Number(value));
}

function completionTime(hours: string | null): string {
  if (!hours) return '—';
  const value = Number(hours);
  if (!Number.isFinite(value)) return '—';
  if (value < 24) return number(value) + ' ساعت';
  return number(value / 24) + ' روز';
}

const emptyOptions: ServiceOptions = {
  branches: [],
  warehouses: [],
  products: [],
  balances: [],
};

export function ServiceReportsPanel({amountUnit}: Props) {
  const [options, setOptions] = useState<ServiceOptions>(emptyOptions);
  const [report, setReport] = useState<ServiceReport | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async (params: URLSearchParams) => {
    setPending(true);
    setError(null);
    try {
      setReport(await api<ServiceReport>('/api/service/report?' + params.toString()));
    } catch (caught) {
      setReport(null);
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void api<ServiceOptions>('/api/service/options')
      .then(setOptions)
      .catch((caught: unknown) => setError(errorMessage(caught)));
    void loadReport(new URLSearchParams());
  }, [loadReport]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    try {
      const form = new FormData(event.currentTarget);
      const fromInput = String(form.get('from') ?? '').trim();
      const toInput = String(form.get('to') ?? '').trim();
      const from = fromInput ? jalaliInputToIso(fromInput) : '';
      const to = toInput ? jalaliInputToIso(toInput) : '';
      if (from && to && from > to) {
        throw new Error('تاریخ پایان گزارش باید بعد از تاریخ شروع باشد.');
      }
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const branchId = String(form.get('branchId') ?? '');
      if (branchId) params.set('branchId', branchId);
      await loadReport(params);
    } catch (caught) {
      setReport(null);
      setError(errorMessage(caught));
    }
  }

  return (
    <section className="content-page service-reports business-forms" id="service-report">
      <header className="service-report-heading">
        <ContextHelpButton help={appHelp.serviceReports} />
        <div>
          <p>فقط پرونده‌ها، قطعات و دریافت‌های واقعی خدمات در بازه انتخابی</p>
          <h2>گزارش خدمات و گارانتی</h2>
        </div>
      </header>

      <form className="service-report-filter" onSubmit={(event) => void submit(event)}>
        <JalaliDateField label="از تاریخ" name="from" />
        <JalaliDateField label="تا تاریخ" name="to" />
        <label className="field">
          <span>شعبه</span>
          <select name="branchId">
            <option value="">همه شعب</option>
            {options.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        </label>
        <div className="service-report-action">
          <span aria-hidden="true">&nbsp;</span>
          <button className="button primary" disabled={pending} type="submit">
            <BarChart3 aria-hidden />
            {pending ? 'در حال محاسبه…' : 'نمایش گزارش'}
          </button>
        </div>
      </form>

      {error ? <div className="form-message error" role="alert">{error}</div> : null}
      {!report && !error ? (
        <div className="empty-state card">در حال محاسبه آمار واقعی خدمات و گارانتی…</div>
      ) : null}
      {report ? (
        <div className="service-report-result">
          {report.totalReceived === '0' ? (
            <div className="empty-state service-report-empty">در حال حاضر داده‌ای موجود نیست.</div>
          ) : (
            <>
              <div className="service-report-summary">
                <article className="service-report-card"><ClipboardCheck aria-hidden /><span>کل پذیرش‌ها</span><strong>{number(report.totalReceived)}</strong></article>
                <article className="service-report-card"><ShieldCheck aria-hidden /><span>در گارانتی</span><strong>{number(report.inWarranty)}</strong></article>
                <article className="service-report-card"><Wrench aria-hidden /><span>خارج از گارانتی</span><strong>{number(report.outOfWarranty)}</strong></article>
                <article className="service-report-card"><PackageCheck aria-hidden /><span>تحویل‌شده</span><strong>{number(report.delivered)}</strong></article>
                <article className="service-report-card"><PackageCheck aria-hidden /><span>تعداد قطعات مصرف‌شده</span><strong>{number(report.installedQuantity)}</strong></article>
                <article className="service-report-card"><Banknote aria-hidden /><span>دریافت خدمات خارج گارانتی</span><strong>{formatIrrAmount(report.receivedServiceIncomeIrr, amountUnit)}</strong></article>
                <article className="service-report-card"><Banknote aria-hidden /><span>هزینه واقعی خدمات</span><strong>{formatIrrAmount(report.actualServiceCostIrr ?? '0', amountUnit)}</strong></article>
              </div>

              <div className="service-report-details">
                <article className="service-report-statuses">
                  <h3>وضعیت پرونده‌ها</h3>
                  <div>
                    {(Object.keys(statusLabels) as ServiceStatus[]).map((status) => (
                      <p key={status}><span>{statusLabels[status]}</span><strong>{number(report.statusCounts[status])}</strong></p>
                    ))}
                  </div>
                </article>
                <article className="service-report-notes">
                  <h3>جزئیات عملیاتی</h3>
                  <dl>
                    <div><dt>ارزش ثبت‌شده قطعات قابل دریافت</dt><dd>{formatIrrAmount(report.chargeablePartsValueIrr, amountUnit)}</dd></div>
                    <div><dt>میانگین زمان رسیدگی پرونده‌های تحویل‌شده</dt><dd><Clock3 aria-hidden />{completionTime(report.averageCompletionHours)}</dd></div>
                  </dl>
                  <p>مانده مشتری، سود و زیان و گردش حسابداری عمداً در این گزارش نیستند.</p>
                </article>
              </div>
              <div className="service-report-details">
                <article className="service-report-statuses"><h3>قطعات پرتکرار</h3>{report.frequentParts?.length ? report.frequentParts.map(row => <p key={row.productName}><span>{row.productName}</span><strong>{number(row.quantity)}</strong></p>) : <p>داده‌ای ثبت نشده است.</p>}</article>
                <article className="service-report-statuses"><h3>عیب‌های پرتکرار</h3>{report.recurrentFaults?.length ? report.recurrentFaults.map(row => <p key={row.fault}><span>{row.fault}</span><strong>{number(row.count)}</strong></p>) : <p>داده‌ای ثبت نشده است.</p>}</article>
                <article className="service-report-statuses"><h3>عملکرد تعمیرکاران</h3>{report.technicianPerformance?.length ? report.technicianPerformance.map(row => <p key={row.technicianId}><span>{row.technicianName} · {number(row.deliveredCount)} تحویل</span><strong>{completionTime(row.averageCompletionHours)}</strong></p>) : <p>داده‌ای ثبت نشده است.</p>}</article>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
