import {ScanLine, Search, ShieldCheck, X} from 'lucide-react';
import {useEffect, useState, type FormEvent} from 'react';
import {api, errorMessage} from './api.js';
import {formatJalaliDateTime} from './jalali-date.js';
import {ActionFeedback} from './MasterDataUi.js';
import {SerialBarcodeScanner} from './SerialBarcodeScanner.js';
import {serviceStatusText} from './service.helpers.js';
import type {ServiceSerialLookup} from './service.types.js';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ServiceSerialTrackingDialog({open, onClose}: Props) {
  const [serialNumber, setSerialNumber] = useState('');
  const [result, setResult] = useState<ServiceSerialLookup | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSerialNumber('');
    setResult(null);
    setError(null);
    setScannerOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  async function lookupSerial(value: string): Promise<void> {
    if (!value || pending) return;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await api<ServiceSerialLookup>(
          '/api/service/serial-lookup/' + encodeURIComponent(value),
        ),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void lookupSerial(serialNumber.trim());
  }

  function handleDetectedSerial(value: string): void {
    setSerialNumber(value);
    setScannerOpen(false);
    void lookupSerial(value);
  }

  if (!open) return null;

  return (
    <div
      aria-modal="true"
      className="service-serial-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-labelledby="service-serial-dialog-title"
    >
      <section className="service-serial-dialog">
        <header>
          <span className="service-serial-dialog-icon"><Search aria-hidden /></span>
          <div>
            <p>استعلام از اطلاعات واقعی فروش، گارانتی و خدمات</p>
            <h2 id="service-serial-dialog-title">رهگیری مشتری با شماره سریال</h2>
          </div>
          <button aria-label="بستن پنجره رهگیری" className="icon-button" onClick={onClose} type="button">
            <X aria-hidden />
          </button>
        </header>
        <form onSubmit={submit}>
          <label className="field">
            <span>شماره سریال دستگاه *</span>
            <input
              autoComplete="off"
              autoFocus
              disabled={pending}
              maxLength={160}
              onChange={(event) => setSerialNumber(event.target.value)}
              placeholder="شماره درج‌شده روی دستگاه"
              required
              value={serialNumber}
            />
          </label>
          <button className="button primary" disabled={pending} type="submit">
            <Search aria-hidden />
            {pending ? 'در حال استعلام…' : 'استعلام سریال'}
          </button>
          <button
            aria-expanded={scannerOpen}
            className="button secondary service-serial-scan-toggle"
            disabled={pending}
            onClick={() => setScannerOpen((value) => !value)}
            type="button"
          >
            <ScanLine aria-hidden />
            بارکدخوان
          </button>
        </form>
        <SerialBarcodeScanner
          onClose={() => setScannerOpen(false)}
          onDetected={handleDetectedSerial}
          open={scannerOpen}
        />
        <ActionFeedback error={error} success={null} />
        {result ? (
          <div className="service-serial-result">
            <div className="service-serial-result-heading">
              <ShieldCheck aria-hidden />
              <div>
                <strong>{result.productName}</strong>
                <span className="tracking-code">{result.serialNumber}</span>
              </div>
              <span className={result.isInWarranty ? 'service-good' : 'service-warning'}>
                {result.isInWarranty ? 'گارانتی معتبر' : 'خارج از گارانتی'}
              </span>
            </div>
            <dl>
              <div><dt>مشتری</dt><dd>{result.customerName}</dd></div>
              <div><dt>فاکتور فروش</dt><dd>{result.saleInvoiceNumber}</dd></div>
              <div><dt>سابقه خدمات</dt><dd>{result.serviceHistory.length} پرونده</dd></div>
            </dl>
            {result.serviceHistory.length > 0 ? (
              <div className="service-serial-history">
                <strong>آخرین پرونده‌های خدمات</strong>
                {result.serviceHistory.slice(0, 3).map((history) => (
                  <span key={history.id}>
                    {history.orderNumber} · {serviceStatusText(history.status)} · {formatJalaliDateTime(history.receivedAt)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
