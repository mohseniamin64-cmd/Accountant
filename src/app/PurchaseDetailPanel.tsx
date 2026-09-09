import {CheckCircle2, RotateCcw, X, XCircle} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import type {AmountUnit} from '../../shared/contracts.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import type {HelpDefinition} from './help-content.js';
import {formatJalaliDate} from './jalali-date.js';
import {formatIrrAmount} from './purchase.helpers.js';
import {TradeReturnForm} from './TradeReturnForm.js';
import type {TradeReturnSelection} from './trade-return.types.js';
import type {
  PurchaseDetail,
  PurchaseStatus,
  PurchaseSummary,
} from './purchase.types.js';

interface PurchaseDetailPanelProps {
  amountUnit: AmountUnit;
  summary: PurchaseSummary;
  detail: PurchaseDetail | null;
  pending: boolean;
  acting: boolean;
  canPost: boolean;
  canCancel: boolean;
  help: HelpDefinition;
  onClose: () => void;
  onPost: () => void;
  onCancel: (reason: string) => void;
  onReturn: (
    returnDate: string,
    reason: string,
    lines: TradeReturnSelection[],
  ) => void;
}

function statusText(status: PurchaseStatus): string {
  if (status === 'draft') return '\u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633';
  if (status === 'posted') return '\u0642\u0637\u0639\u06cc';
  return 'لغو/برگشت‌شده';
}

export function PurchaseDetailPanel({
  amountUnit,
  summary,
  detail,
  pending,
  acting,
  canPost,
  canCancel,
  help,
  onClose,
  onPost,
  onCancel,
  onReturn,
}: PurchaseDetailPanelProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  function submitCancel(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
    onCancel(reason);
  }

  return (
    <section className="form-card purchase-detail-panel">
      <div className="form-card-heading purchase-detail-heading">
        <ContextHelpButton help={help} />
        <h2>{'\u062c\u0632\u0626\u06cc\u0627\u062a \u0641\u0627\u06a9\u062a\u0648\u0631 \u062e\u0631\u06cc\u062f \u0634\u0645\u0627\u0631\u0647 '}{summary.invoiceNumber}</h2>
        <p>{'\u067e\u06cc\u0634 \u0627\u0632 \u0642\u0637\u0639\u06cc\u200c\u06a9\u0631\u062f\u0646\u060c \u0627\u0637\u0644\u0627\u0639\u0627\u062a \u0648 \u0627\u062b\u0631 \u0627\u0646\u0628\u0627\u0631\u06cc \u0648 \u0645\u0627\u0644\u06cc \u0641\u0627\u06a9\u062a\u0648\u0631 \u0631\u0627 \u06a9\u0646\u062a\u0631\u0644 \u06a9\u0646\u06cc\u062f.'}</p>
        <button
          aria-label={'\u0628\u0633\u062a\u0646 \u062c\u0632\u0626\u06cc\u0627\u062a \u0641\u0627\u06a9\u062a\u0648\u0631'}
          className="purchase-detail-close"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden />
        </button>
      </div>

      <div className="purchase-detail-summary">
        <div><span>{'\u062a\u0623\u0645\u06cc\u0646\u200c\u06a9\u0646\u0646\u062f\u0647'}</span><strong>{summary.supplierName}</strong></div>
        <div><span>{'\u062a\u0627\u0631\u06cc\u062e \u0641\u0627\u06a9\u062a\u0648\u0631'}</span><strong>{formatJalaliDate(summary.invoiceDate)}</strong></div>
        <div><span>{'\u0634\u0645\u0627\u0631\u0647 \u0641\u0627\u06a9\u062a\u0648\u0631 \u062a\u0623\u0645\u06cc\u0646\u200c\u06a9\u0646\u0646\u062f\u0647'}</span><strong>{summary.supplierInvoiceNumber ?? '\u2014'}</strong></div>
        <div><span>{'\u0648\u0636\u0639\u06cc\u062a'}</span><strong>{summary.invoiceType === 'return' ? 'مرجوعی قطعی' : statusText(summary.status)}</strong></div>
        <div><span>{'\u0645\u0628\u0644\u063a \u06a9\u0644'}</span><strong>{formatIrrAmount(summary.totalIrr, amountUnit)}</strong></div>
        <div><span>مبلغ مرجوع‌شده</span><strong>{formatIrrAmount(summary.returnedIrr, amountUnit)}</strong></div>
        <div><span>{'\u067e\u0631\u062f\u0627\u062e\u062a\u200c\u0634\u062f\u0647'}</span><strong>{formatIrrAmount(summary.paidIrr, amountUnit)}</strong></div>
      </div>

      {pending ? (
        <div className="empty-state">{'\u062f\u0631 \u062d\u0627\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u0631\u062f\u06cc\u0641\u200c\u0647\u0627\u06cc \u0641\u0627\u06a9\u062a\u0648\u0631\u2026'}</div>
      ) : detail?.lines.length ? (
        <>
          <div className="table-card purchase-detail-desktop">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{'\u0631\u062f\u06cc\u0641'}</th>
                    <th>{'\u06a9\u0627\u0644\u0627'}</th>
                    <th>{'\u0627\u0646\u0628\u0627\u0631'}</th>
                    <th>{'\u0645\u0642\u062f\u0627\u0631'}</th>
                    <th>{'\u0642\u06cc\u0645\u062a \u0648\u0627\u062d\u062f'}</th>
                    <th>{'\u062a\u062e\u0641\u06cc\u0641'}</th>
                    <th>{'\u0645\u0627\u0644\u06cc\u0627\u062a'}</th>
                    <th>{'\u062c\u0645\u0639'}</th>
                    <th>{'\u0633\u0631\u06cc\u0627\u0644'}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{new Intl.NumberFormat('fa-IR').format(line.lineNumber)}</td>
                      <td><strong>{line.productName}</strong><small>{line.productCode}</small></td>
                      <td>{line.warehouseName}</td>
                      <td>{new Intl.NumberFormat('fa-IR', {maximumFractionDigits: 6}).format(Number(line.quantity))}</td>
                      <td>{formatIrrAmount(line.unitPriceIrr, amountUnit)}</td>
                      <td>{formatIrrAmount(line.discountIrr, amountUnit)}</td>
                      <td>{formatIrrAmount(line.taxIrr, amountUnit)}</td>
                      <td>{formatIrrAmount(line.lineTotalIrr, amountUnit)}</td>
                      <td>{new Intl.NumberFormat('fa-IR').format(line.serialCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="purchase-detail-mobile">
            {detail.lines.map((line) => (
              <article key={line.id} className="purchase-detail-line-card">
                <header><strong>{line.productName}</strong><span>{line.productCode}</span></header>
                <dl>
                  <dt>{'\u0627\u0646\u0628\u0627\u0631'}</dt><dd>{line.warehouseName}</dd>
                  <dt>{'\u0645\u0642\u062f\u0627\u0631'}</dt><dd>{new Intl.NumberFormat('fa-IR', {maximumFractionDigits: 6}).format(Number(line.quantity))}</dd>
                  <dt>{'\u062c\u0645\u0639 \u0631\u062f\u06cc\u0641'}</dt><dd>{formatIrrAmount(line.lineTotalIrr, amountUnit)}</dd>
                  <dt>{'\u062a\u0639\u062f\u0627\u062f \u0633\u0631\u06cc\u0627\u0644'}</dt><dd>{new Intl.NumberFormat('fa-IR').format(line.serialCount)}</dd>
                </dl>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">{'\u0631\u062f\u06cc\u0641\u06cc \u0628\u0631\u0627\u06cc \u0627\u06cc\u0646 \u0641\u0627\u06a9\u062a\u0648\u0631 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.'}</div>
      )}

      {summary.status === 'draft' ? (
        <div className="purchase-detail-actions">
          {canPost ? (
            <button className="button primary" disabled={acting || pending} onClick={onPost} type="button">
              <CheckCircle2 aria-hidden />
              {acting ? '\u062f\u0631 \u062d\u0627\u0644 \u0627\u0646\u062c\u0627\u0645\u2026' : '\u0642\u0637\u0639\u06cc\u200c\u06a9\u0631\u062f\u0646 \u0641\u0627\u06a9\u062a\u0648\u0631'}
            </button>
          ) : null}
          {canCancel ? (
            <button
              className="button danger"
              disabled={acting}
              onClick={() => setCancelOpen((current) => !current)}
              type="button"
            >
              <XCircle aria-hidden />
              {'\u0644\u063a\u0648 \u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633'}
            </button>
          ) : null}
        </div>
      ) : null}

      {summary.status === 'posted' && summary.invoiceType !== 'return' && canCancel ? (
        <div className="purchase-detail-actions">
          <button
            className="button danger"
            disabled={acting || BigInt(summary.paidIrr) > 0n}
            onClick={() => setReturnOpen((current) => !current)}
            title={BigInt(summary.paidIrr) > 0n
              ? 'ابتدا پرداخت‌های تخصیص‌یافته در خزانه باید برگشت داده شوند.'
              : undefined}
            type="button"
          >
            <RotateCcw aria-hidden />
            ثبت مرجوعی خرید
          </button>
        </div>
      ) : null}

      {summary.status === 'posted' && summary.invoiceType !== 'return' &&
      BigInt(summary.paidIrr) > 0n ? (
        <p className="trade-return-blocker" role="note">برای مرجوعی، ابتدا تراکنش پرداخت تخصیص‌یافته را در تاریخچه خزانه برگشت دهید؛ این کار مانده فاکتور و سند حسابداری را با سابقه کامل اصلاح می‌کند.</p>
      ) : null}
      {returnOpen && summary.status === 'posted' && summary.invoiceType !== 'return' ? (
        <TradeReturnForm
          acting={acting}
          help={help}
          kind="purchase"
          lines={detail?.lines ?? []}
          onCancel={() => setReturnOpen(false)}
          onSubmit={onReturn}
        />
      ) : null}

      {cancelOpen && summary.status === 'draft' ? (
        <form className="purchase-cancel-form" onSubmit={submitCancel}>
          <label className="field">
            <span>{'\u062f\u0644\u06cc\u0644 \u0644\u063a\u0648 \u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633 *'}</span>
            <textarea name="reason" minLength={5} maxLength={1000} required rows={3} />
          </label>
          <div className="purchase-detail-actions">
            <button className="button danger" disabled={acting} type="submit">
              {acting ? '\u062f\u0631 \u062d\u0627\u0644 \u0644\u063a\u0648\u2026' : '\u062a\u0623\u06cc\u06cc\u062f \u0644\u063a\u0648 \u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633'}
            </button>
            <button className="button secondary" disabled={acting} onClick={() => setCancelOpen(false)} type="button">
              {'\u0627\u0646\u0635\u0631\u0627\u0641'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
