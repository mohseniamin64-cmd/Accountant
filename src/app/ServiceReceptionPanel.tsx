import {ClipboardCheck, PackageCheck, ScanLine, Search} from 'lucide-react';
import {useCallback, useRef, useState, type FormEvent} from 'react';
import {api, errorMessage, postJson} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {formatJalaliDate} from './jalali-date.js';
import {appHelp} from './help-content.js';
import {ActionFeedback} from './MasterDataUi.js';
import {SerialBarcodeScanner} from './SerialBarcodeScanner.js';
import {
  ServiceIntakePrint,
  type ServiceIntakePrintData,
} from './ServiceIntakePrint.js';
import type {
  ServiceOptions,
  ServiceSerialLookup,
} from './service.types.js';

interface Props {
  companyName: string;
  options: ServiceOptions;
  pending: boolean;
  onCreated: () => Promise<void>;
}

export function ServiceReceptionPanel({
  companyName,
  options,
  pending: optionsPending,
  onCreated,
}: Props) {
  const [lookup, setLookup] = useState<ServiceSerialLookup | null>(null);
  const [lookedUpSerial, setLookedUpSerial] = useState('');
  const [working, setWorking] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [printData, setPrintData] = useState<ServiceIntakePrintData | null>(null);
  const serialInputRef = useRef<HTMLInputElement | null>(null);

  async function lookupSerial(serialNumber: string): Promise<void> {
    const normalizedSerial = serialNumber.trim();
    if (!normalizedSerial) {
      setError('شماره سریال دستگاه را وارد کنید.');
      return;
    }
    setWorking(true);
    setError(null);
    setSuccess(null);
    setLookup(null);
    try {
      const found = await api<ServiceSerialLookup>(
        '/api/service/serial-lookup/' + encodeURIComponent(normalizedSerial),
      );
      if (found.serialStatus !== 'sold') {
        throw new Error('این دستگاه در وضعیت قابل پذیرش برای خدمات نیست.');
      }
      setLookup(found);
      setLookedUpSerial(normalizedSerial);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking(false);
    }
  }

  function handleDetectedSerial(serialNumber: string): void {
    if (serialInputRef.current) serialInputRef.current.value = serialNumber;
    setLookup(null);
    setLookedUpSerial('');
    setScannerOpen(false);
    void lookupSerial(serialNumber);
  }

  async function receive(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (working || !lookup) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const serialNumber = String(form.get('serialNumber') ?? '').trim();
    if (serialNumber !== lookedUpSerial) {
      setLookup(null);
      setError('شماره سریال تغییر کرده است؛ دوباره استعلام بگیرید.');
      return;
    }
    setWorking(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await postJson<{
        id: string;
        orderNumber: string;
        trackingCode: string;
        printIntent?: boolean;
        smsQueued?: boolean;
        printSnapshot?: {
          companyName: string; branchName: string; orderNumber: string; trackingCode: string;
          receivedAt: string; customerName: string; customerMobile: string | null;
          productName: string; serialNumber: string; complaint: string;
          intakeCondition: string | null; receivedAccessories: string | null;
          coverageSource: 'sale_warranty' | 'service_warranty' | 'none';
          coverageEndsOn: string | null; paperSize: 'A4' | '80mm';
          printReceipt: boolean; printDeviceLabel: boolean;
        } | null;
      }>('/api/service/orders', {
        branchId: String(form.get('branchId') ?? ''),
        serialNumber,
        complaint: String(form.get('complaint') ?? '').trim(),
        intakeCondition:
          String(form.get('intakeCondition') ?? '').trim() || null,
        receivedAccessories:
          String(form.get('receivedAccessories') ?? '').trim() || null,
      });
      setSuccess(
        'پذیرش با موفقیت ثبت شد. کد پیگیری مشتری: ' +
          created.trackingCode +
          (created.smsQueued ? ' پیامک پذیرش در صف ارسال قرار گرفت.' : ''),
      );
      if (created.printIntent && created.printSnapshot) {
        const snapshot = created.printSnapshot;
        setPrintData({
          ...snapshot,
          warrantyLabel: snapshot.coverageSource === 'none'
            ? 'خارج از گارانتی'
            : 'تحت پوشش گارانتی' + (snapshot.coverageEndsOn ? ' تا ' + formatJalaliDate(snapshot.coverageEndsOn) : ''),
        });
      }
      setLookup(null);
      setLookedUpSerial('');
      formElement.reset();
      setFormVersion((value) => value + 1);
      await onCreated();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking(false);
    }
  }

  const finishPrint = useCallback(() => setPrintData(null), []);

  return (
    <>
    {printData ? <ServiceIntakePrint data={printData} onFinished={finishPrint} /> : null}
    <form
      className="form-card service-reception-card"
      key={formVersion}
      onSubmit={(event) => void receive(event)}
    >
      <div className="form-card-heading service-reception-panel-heading">
        <ContextHelpButton help={appHelp.serviceReception} />
        <h2>استعلام و ثبت پذیرش دستگاه</h2>
        <p>ابتدا شماره سریال را استعلام کنید؛ سپس اطلاعات واقعی دستگاه و گارانتی نمایش داده می‌شود.</p>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>شعبه پذیرش *</span>
          <select
            defaultValue={options.branches[0]?.id ?? ''}
            disabled={working || optionsPending}
            name="branchId"
            required
          >
            <option value="">انتخاب شعبه</option>
            {options.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>شماره سریال دستگاه *</span>
          <span className="input-action">
            <input
              autoComplete="off"
              disabled={working}
              maxLength={160}
              name="serialNumber"
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                void lookupSerial(event.currentTarget.value);
              }}
              onChange={() => {
                setLookup(null);
                setLookedUpSerial('');
              }}
              required
              ref={serialInputRef}
            />
            <button
              disabled={working}
              onClick={(event) => {
                if (serialInputRef.current) void lookupSerial(serialInputRef.current.value);
              }}
              type="button"
            >
              <Search aria-hidden /> استعلام
            </button>
            <button
              aria-expanded={scannerOpen}
              disabled={working}
              onClick={() => setScannerOpen((value) => !value)}
              type="button"
            >
              <ScanLine aria-hidden /> بارکدخوان
            </button>
          </span>
        </label>
      </div>
      <SerialBarcodeScanner
        onClose={() => setScannerOpen(false)}
        onDetected={handleDetectedSerial}
        open={scannerOpen}
      />
      {lookup ? (
        <div className="service-lookup-result" role="status">
          <PackageCheck aria-hidden />
          <dl>
            <div><dt>محصول</dt><dd>{lookup.productName}</dd></div>
            <div><dt>مشتری</dt><dd>{lookup.customerName}</dd></div>
            <div><dt>فاکتور فروش</dt><dd>{lookup.saleInvoiceNumber}</dd></div>
            <div><dt>تاریخ فروش</dt><dd>{formatJalaliDate(lookup.saleDate)}</dd></div>
            <div>
              <dt>گارانتی</dt>
              <dd className={lookup.isInWarranty ? 'service-good' : 'service-warning'}>
                {lookup.isInWarranty ? 'معتبر' : 'خارج از اعتبار'}
              </dd>
            </div>
            <div>
              <dt>پایان گارانتی</dt>
              <dd>{lookup.warrantyEndsOn ? formatJalaliDate(lookup.warrantyEndsOn) : 'ثبت نشده'}</dd>
            </div>
            <div>
              <dt>باقی‌مانده گارانتی</dt>
              <dd>{new Intl.NumberFormat('fa-IR').format(lookup.warrantyRemainingDays)} روز</dd>
            </div>
            <div>
              <dt>سوابق خدمات قبلی</dt>
              <dd>{new Intl.NumberFormat('fa-IR').format(lookup.serviceHistory.length)} پرونده</dd>
            </div>
          </dl>
        </div>
      ) : null}
      <div className="form-grid service-reception-fields">
        <label className="field full">
          <span>شرح ایراد اعلامی *</span>
          <textarea
            disabled={working}
            maxLength={4000}
            minLength={3}
            name="complaint"
            required
            rows={3}
          />
        </label>
        <label className="field">
          <span>وضعیت ظاهری هنگام پذیرش</span>
          <textarea disabled={working} maxLength={2000} name="intakeCondition" rows={3} />
        </label>
        <label className="field">
          <span>متعلقات تحویلی</span>
          <textarea disabled={working} maxLength={2000} name="receivedAccessories" rows={3} />
        </label>
      </div>
      <ActionFeedback error={error} success={success} />
      <div className="form-actions">
        <button
          className="button primary"
          disabled={working || optionsPending || !lookup}
          type="submit"
        >
          <ClipboardCheck aria-hidden />
          {working ? 'در حال ثبت…' : 'ثبت پذیرش و صدور کد پیگیری'}
        </button>
      </div>
    </form>
    </>
  );
}
