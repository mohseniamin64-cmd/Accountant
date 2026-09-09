import {Search, ShieldCheck, Wrench} from 'lucide-react';
import {useEffect, useState, type FormEvent} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {api, errorMessage} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {formatJalaliDateTime} from './jalali-date.js';
import {appHelp} from './help-content.js';
import {ActionFeedback} from './MasterDataUi.js';
import {formatIrrAmount} from './purchase.helpers.js';
import {
  estimateStatusText,
  serviceRemainingIrr,
  serviceStatusText,
  warrantyDecisionText,
} from './service.helpers.js';
import type {PublicServiceOrder} from './service.types.js';
import './service.css';

export function ServiceTrackingPage() {
  const params = useParams<{trackingCode?: string}>();
  const navigate = useNavigate();
  const [code, setCode] = useState(params.trackingCode ?? '');
  const [order, setOrder] = useState<PublicServiceOrder | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trackingCode = (params.trackingCode ?? '').trim();
    setCode(trackingCode);
    setOrder(null);
    setError(null);
    if (!trackingCode) return;
    let cancelled = false;
    setPending(true);
    void api<PublicServiceOrder>(
      '/api/service/public/track/' + encodeURIComponent(trackingCode),
    )
      .then((result) => {
        if (!cancelled) setOrder(result);
      })
      .catch((caught) => {
        if (!cancelled) setError(errorMessage(caught));
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.trackingCode]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError('کد پیگیری را وارد کنید.');
      return;
    }
    navigate('/track/' + encodeURIComponent(normalized));
  }

  const remaining = order
    ? serviceRemainingIrr(order.finalCostIrr, order.paidIrr)
    : 0n;

  return (
    <main className="service-public-page">
      <section className="service-public-shell">
        <header className="service-public-header">
          <ContextHelpButton help={appHelp.serviceTracking} />
          <div>
            <Wrench aria-hidden />
            <p>مشاهده وضعیت با کد اختصاصی پذیرش</p>
            <h1>رهگیری خدمات و تعمیر</h1>
          </div>
          <ShieldCheck aria-hidden />
        </header>
        <form className="service-public-search" onSubmit={submit}>
          <label className="field">
            <span>کد پیگیری *</span>
            <input
              autoComplete="off"
              maxLength={40}
              onChange={(event) => setCode(event.target.value)}
              placeholder="مانند SRV-..."
              required
              value={code}
            />
          </label>
          <button className="button primary" disabled={pending} type="submit">
            <Search aria-hidden />
            {pending ? 'در حال بررسی…' : 'پیگیری پرونده'}
          </button>
        </form>
        <ActionFeedback error={error} success={null} />

        {pending ? (
          <div className="empty-state">در حال دریافت وضعیت پرونده…</div>
        ) : order ? (
          <div className="service-public-result">
            <div className="service-public-overview">
              <div>
                <span>محصول</span>
                <strong>{order.productName}</strong>
              </div>
              <div>
                <span>شماره سریال</span>
                <strong>{order.serialNumber}</strong>
              </div>
              <div>
                <span>وضعیت فعلی</span>
                <strong>{serviceStatusText(order.status)}</strong>
              </div>
              <div>
                <span>زمان پذیرش</span>
                <strong>{formatJalaliDateTime(order.receivedAt)}</strong>
              </div>
              <div>
                <span>وضعیت گارانتی</span>
                <strong>{warrantyDecisionText(order.warrantyDecision)}</strong>
              </div>
              {order.estimateStatus !== 'not_required' ? (
                <div>
                  <span>وضعیت برآورد</span>
                  <strong>{estimateStatusText(order.estimateStatus)}</strong>
                </div>
              ) : null}
              {BigInt(order.finalCostIrr || '0') > 0n ? (
                <>
                  <div>
                    <span>هزینه نهایی</span>
                    <strong>{formatIrrAmount(order.finalCostIrr, 'IRR')}</strong>
                  </div>
                  <div>
                    <span>مانده قابل پرداخت</span>
                    <strong>{formatIrrAmount(remaining, 'IRR')}</strong>
                  </div>
                </>
              ) : null}
            </div>
            <section className="service-public-timeline">
              <h2>روند پرونده</h2>
              {order.events.length === 0 ? (
                <div className="empty-state">هنوز رویدادی برای نمایش ثبت نشده است.</div>
              ) : (
                <ol>
                  {[...order.events].reverse().map((event, index) => (
                    <li key={event.createdAt + '-' + index}>
                      <span />
                      <div>
                        <strong>
                          {event.toStatus
                            ? serviceStatusText(event.toStatus)
                            : event.eventType === 'warranty_decision'
                              ? 'بررسی گارانتی'
                              : event.eventType === 'estimate'
                                ? 'برآورد هزینه'
                                : event.eventType === 'part_recorded'
                                  ? 'عملیات تعمیر'
                                  : event.eventType === 'finalized'
                                    ? 'آماده تحویل'
                                    : 'به‌روزرسانی پرونده'}
                        </strong>
                        <time>{formatJalaliDateTime(event.createdAt)}</time>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        ) : (
          <div className="service-public-placeholder">
            <ShieldCheck aria-hidden />
            <p>کد درج‌شده روی رسید پذیرش یا پیامک را وارد کنید.</p>
          </div>
        )}
      </section>
    </main>
  );
}
