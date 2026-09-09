import Decimal from 'decimal.js';
import {
  Activity,
  CircleDollarSign,
  ClipboardList,
  PackagePlus,
  Paperclip,
  Save,
  ShieldCheck,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import type {AmountUnit} from '../../shared/contracts.js';
import {api, errorMessage, postJson} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {formatJalaliDate, formatJalaliDateTime} from './jalali-date.js';
import {appHelp, type HelpDefinition} from './help-content.js';
import {amountIrrToInput} from './master-data.helpers.js';
import {ActionFeedback} from './MasterDataUi.js';
import {formatIrrAmount} from './purchase.helpers.js';
import {
  allowedServiceTransitions,
  estimateStatusText,
  nonNegativeServiceAmount,
  positiveServiceQuantity,
  removedDispositionText,
  serviceRemainingIrr,
  serviceStatusText,
  warrantyDecisionText,
} from './service.helpers.js';
import type {
  AvailableServicePartSerial,
  RemovedDisposition,
  ServiceOptions,
  ServiceOrderDetail,
  ServiceStatus,
  WarrantyDecision,
} from './service.types.js';

interface Props {
  order: ServiceOrderDetail;
  options: ServiceOptions;
  amountUnit: AmountUnit;
  canRepair: boolean;
  canRejectWarranty: boolean;
  canDeliver: boolean;
  canUseTreasury: boolean;
  canAttach: boolean;
  onClose: () => void;
  onReload: () => Promise<void>;
}

const dispositions: readonly RemovedDisposition[] = [
  'returned_customer',
  'supplier_warranty',
  'repaired_reused',
  'scrapped',
];

function SectionHeading({
  title,
  description,
  help,
  icon: Icon,
}: {
  title: string;
  description: string;
  help: HelpDefinition;
  icon: typeof Wrench;
}) {
  return (
    <div className="service-panel-heading">
      <ContextHelpButton help={help} />
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <Icon aria-hidden />
    </div>
  );
}

export function ServiceOrderDetailPanel({
  order,
  options,
  amountUnit,
  canRepair,
  canRejectWarranty,
  canDeliver,
  canUseTreasury,
  canAttach,
  onClose,
  onReload,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warrantyChoice, setWarrantyChoice] = useState<WarrantyDecision>(order.warrantyDecision);
  const [partUsage, setPartUsage] = useState<'installed' | 'removed'>('installed');
  const [partProductId, setPartProductId] = useState(options.products[0]?.id ?? '');
  const [partWarehouseId, setPartWarehouseId] = useState(options.warehouses[0]?.id ?? '');
  const [partSerials, setPartSerials] = useState<AvailableServicePartSerial[]>([]);
  const [serialPending, setSerialPending] = useState(false);

  const transitions = allowedServiceTransitions(order.status);
  const selectedProduct = options.products.find(
    (product) => product.id === partProductId,
  );
  const selectedBalance = options.balances.find(
    (balance) =>
      balance.productId === partProductId &&
      balance.warehouseId === partWarehouseId,
  );
  const remainingIrr = serviceRemainingIrr(order.finalCostIrr, order.paidIrr);
  const active = !['delivered', 'cancelled'].includes(order.status);
  const canRecordParts =
    canRepair &&
    ['diagnosis', 'waiting_part', 'repairing'].includes(order.status);

  useEffect(() => {
    if (
      !canRecordParts ||
      partUsage !== 'installed' ||
      selectedProduct?.trackingType !== 'serial' ||
      !partProductId ||
      !partWarehouseId
    ) {
      setPartSerials([]);
      return;
    }
    let cancelled = false;
    setSerialPending(true);
    const params = new URLSearchParams({
      productId: partProductId,
      warehouseId: partWarehouseId,
    });
    void api<AvailableServicePartSerial[]>(
      '/api/service/available-part-serials?' + params.toString(),
    )
      .then((rows) => {
        if (!cancelled) setPartSerials(rows);
      })
      .catch((caught) => {
        if (!cancelled) setError(errorMessage(caught));
      })
      .finally(() => {
        if (!cancelled) setSerialPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    canRecordParts,
    partProductId,
    partUsage,
    partWarehouseId,
    selectedProduct?.trackingType,
  ]);

  const chargeablePartsIrr = useMemo(
    () =>
      order.parts.reduce(
        (sum, part) =>
          part.usageType === 'installed' && part.isChargeable
            ? sum +
              BigInt(
                new Decimal(part.quantity)
                  .times(part.unitPriceIrr)
                  .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
                  .toFixed(0),
              )
            : sum,
        0n,
      ),
    [order.parts],
  );

  async function run(
    key: string,
    message: string,
    action: () => Promise<unknown>,
  ): Promise<void> {
    if (busy) return;
    setBusy(key);
    setError(null);
    setSuccess(null);
    try {
      await action();
      await onReload();
      setSuccess(message);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  function submitWarranty(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const decision = String(form.get('decision')) as WarrantyDecision;
    const body =
      decision === 'rejected'
        ? {
            decision,
            reason: String(form.get('reason') ?? '').trim(),
            evidence: String(form.get('evidence') ?? '').trim(),
          }
        : {decision};
    void run('warranty', 'تصمیم گارانتی ثبت شد.', () =>
      postJson('/api/service/orders/' + order.id + '/warranty-decision', body),
    );
  }

  function submitEstimate(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let estimatedCostIrr: string;
    try {
      estimatedCostIrr = nonNegativeServiceAmount(
        String(form.get('estimatedCost') ?? ''),
        amountUnit,
        'برآورد هزینه',
      );
    } catch (caught) {
      setError(errorMessage(caught));
      return;
    }
    void run('estimate', 'برآورد و پاسخ مشتری ثبت شد.', () =>
      postJson('/api/service/orders/' + order.id + '/estimate', {
        estimatedCostIrr,
        status: String(form.get('estimateStatus')),
        note: String(form.get('note') ?? '').trim(),
      }),
    );
  }

  function submitStatus(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run('status', 'مرحله پرونده تغییر کرد.', () =>
      postJson('/api/service/orders/' + order.id + '/status', {
        status: String(form.get('status')),
        description: String(form.get('description') ?? '').trim(),
        rowVersion: order.rowVersion,
      }),
    );
  }

  function submitPart(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let quantity: string;
    try {
      quantity = positiveServiceQuantity(
        selectedProduct?.trackingType === 'serial'
          ? '1'
          : String(form.get('quantity') ?? ''),
      );
    } catch (caught) {
      setError(errorMessage(caught));
      return;
    }
    if (partUsage === 'removed') {
      void run('part', 'قطعه بازشده و سرنوشت آن ثبت شد.', () =>
        postJson('/api/service/orders/' + order.id + '/parts', {
          usageType: 'removed',
          productId: partProductId,
          quantity,
          removedDisposition: String(form.get('removedDisposition')),
        }),
      );
      return;
    }
    let unitPriceIrr: string;
    try {
      unitPriceIrr = nonNegativeServiceAmount(
        String(form.get('unitPrice') ?? ''),
        amountUnit,
        'قیمت قطعه',
      );
    } catch (caught) {
      setError(errorMessage(caught));
      return;
    }
    void run('part', 'قطعه از موجودی واقعی انبار کسر و در پرونده ثبت شد.', () =>
      postJson('/api/service/orders/' + order.id + '/parts', {
        usageType: 'installed',
        productId: partProductId,
        warehouseId: partWarehouseId,
        quantity,
        serialId: String(form.get('serialId') ?? '') || null,
        isChargeable:
          order.warrantyDecision !== 'in_warranty' &&
          form.get('isChargeable') === 'on',
        unitPriceIrr,
      }),
    );
  }


  function submitAttachment(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setError('فایل مستند را انتخاب کنید.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('حجم فایل مستند نباید بیشتر از پنج مگابایت باشد.');
      return;
    }
    void run('attachment', 'مستند پرونده با موفقیت ذخیره شد.', () =>
      api('/api/service/orders/' + order.id + '/attachments', {
        method: 'POST',
        body: form,
      }),
    );
  }

  function submitFinalize(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let finalCostIrr: string;
    try {
      finalCostIrr = nonNegativeServiceAmount(
        String(form.get('finalCost') ?? ''),
        amountUnit,
        'هزینه نهایی',
      );
    } catch (caught) {
      setError(errorMessage(caught));
      return;
    }
    void run('finalize', 'تعمیر نهایی و دستگاه آماده تحویل شد.', () =>
      postJson('/api/service/orders/' + order.id + '/finalize', {
        finalCostIrr,
        description: String(form.get('description') ?? '').trim(),
      }),
    );
  }

  function submitDelivery(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run('deliver', 'تحویل دستگاه و گارانتی خدمات ثبت شد.', () =>
      postJson('/api/service/orders/' + order.id + '/deliver', {
        serviceWarrantyMonths: Number(form.get('serviceWarrantyMonths')),
        warrantyDescription:
          String(form.get('warrantyDescription') ?? '').trim() || null,
        deliveryNote: String(form.get('deliveryNote') ?? '').trim(),
      }),
    );
  }

  return (
    <section className="service-detail-card">
      <header className="service-detail-header">
        <button
          className="icon-button"
          onClick={onClose}
          type="button"
          aria-label="بستن جزئیات"
        >
          <X aria-hidden />
        </button>
        <div>
          <p>پرونده شماره {order.orderNumber}</p>
          <h2>{order.productName}</h2>
          <span>{order.serialNumber}</span>
        </div>
        <span className={'status-pill service-status-' + order.status}>
          {serviceStatusText(order.status)}
        </span>
      </header>

      <div className="service-summary-grid">
        <dl>
          <dt>مشتری</dt><dd>{order.customerName}</dd>
          <dt>تلفن</dt><dd>{order.customerMobile || 'ثبت نشده'}</dd>
        </dl>
        <dl>
          <dt>پذیرش</dt><dd>{formatJalaliDate(order.receivedAt)}</dd>
          <dt>شعبه</dt><dd>{order.branchName}</dd>
        </dl>
        <dl>
          <dt>گارانتی دستگاه</dt><dd>{warrantyDecisionText(order.warrantyDecision)}</dd>
          <dt>باقی‌مانده اعتبار</dt>
          <dd>{new Intl.NumberFormat('fa-IR').format(order.warrantyRemainingDays)} روز</dd>
        </dl>
        <dl>
          <dt>هزینه نهایی</dt><dd>{formatIrrAmount(order.finalCostIrr, amountUnit)}</dd>
          <dt>مانده</dt><dd>{formatIrrAmount(remainingIrr, amountUnit)}</dd>
        </dl>
      </div>

      <article className="service-complaint">
        <h3>شرح پذیرش</h3>
        <p>{order.complaint}</p>
        <dl>
          <div><dt>وضعیت ظاهری</dt><dd>{order.intakeCondition || 'ثبت نشده'}</dd></div>
          <div><dt>متعلقات</dt><dd>{order.receivedAccessories || 'ثبت نشده'}</dd></div>
          <div><dt>کد پیگیری مشتری</dt><dd className="tracking-code">{order.trackingCode}</dd></div>
        </dl>
      </article>

      <ActionFeedback error={error} success={success} />

      {canRepair && transitions.length > 0 ? (
        <form className="service-action-panel" onSubmit={submitStatus}>
          <SectionHeading
            description="فقط انتقال‌های مجاز مرحله فعلی قابل انتخاب هستند."
            help={appHelp.serviceWorkflow}
            icon={Activity}
            title="تغییر مرحله تعمیر"
          />
          <div className="form-grid">
            <label className="field">
              <span>مرحله بعدی *</span>
              <select defaultValue={transitions[0]} name="status" required>
                {transitions.map((status) => (
                  <option key={status} value={status}>{serviceStatusText(status)}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>شرح اقدام یا نتیجه *</span>
              <textarea maxLength={2000} minLength={2} name="description" required rows={2} />
            </label>
          </div>
          <div className="form-actions">
            <button className="button primary" disabled={busy !== null} type="submit">
              <Save aria-hidden /> ثبت مرحله
            </button>
          </div>
        </form>
      ) : null}

      {canRepair && active ? (
        <form className="service-action-panel" onSubmit={submitWarranty}>
          <SectionHeading
            description="تصمیم باید با فروش و اعتبار واقعی سریال سازگار باشد."
            help={appHelp.serviceWarrantyDecision}
            icon={ShieldCheck}
            title="تصمیم گارانتی"
          />
          <div className="form-grid">
            <label className="field">
              <span>نتیجه بررسی *</span>
              <select name="decision" onChange={(event) => setWarrantyChoice(event.target.value as WarrantyDecision)} required value={warrantyChoice}>
                <option value="in_warranty">تحت گارانتی</option>
                <option value="out_of_warranty">خارج از گارانتی</option>
                {canRejectWarranty ? <option value="rejected">رد گارانتی</option> : null}
              </select>
            </label>
            <label className="field">
              <span>دلیل رد (فقط برای رد گارانتی)</span>
              <textarea disabled={warrantyChoice !== 'rejected'} maxLength={2000} minLength={3} name="reason" required={warrantyChoice === 'rejected'} rows={2} />
            </label>
            <label className="field full">
              <span>مستند یا توضیح اثبات (فقط برای رد گارانتی)</span>
              <textarea disabled={warrantyChoice !== 'rejected'} maxLength={4000} minLength={3} name="evidence" required={warrantyChoice === 'rejected'} rows={2} />
            </label>
          </div>
          <div className="form-actions">
            <button className="button secondary" disabled={busy !== null} type="submit">
              <ShieldCheck aria-hidden /> ثبت تصمیم
            </button>
          </div>
        </form>
      ) : null}

      {canRepair && active && order.warrantyDecision !== 'in_warranty' ? (
        <form className="service-action-panel" onSubmit={submitEstimate}>
          <SectionHeading
            description="پاسخ واقعی مشتری درباره برآورد هزینه در پرونده ثبت می‌شود."
            help={appHelp.serviceEstimate}
            icon={CircleDollarSign}
            title="برآورد هزینه"
          />
          <div className="form-grid">
            <label className="field">
              <span>مبلغ برآورد ({amountUnit === 'IRR' ? 'ریال' : 'تومان'}) *</span>
              <input
                defaultValue={amountIrrToInput(order.estimatedCostIrr, amountUnit)}
                inputMode="decimal"
                name="estimatedCost"
                required
              />
            </label>
            <label className="field">
              <span>پاسخ مشتری *</span>
              <select defaultValue={order.estimateStatus === 'not_required' ? 'pending' : order.estimateStatus} name="estimateStatus">
                <option value="pending">منتظر پاسخ</option>
                <option value="approved">تأییدشده</option>
                <option value="rejected">ردشده</option>
              </select>
            </label>
            <label className="field full">
              <span>شرح تماس یا پاسخ *</span>
              <textarea maxLength={2000} minLength={2} name="note" required rows={2} />
            </label>
          </div>
          <p className="service-inline-note">وضعیت فعلی: {estimateStatusText(order.estimateStatus)}</p>
          <div className="form-actions">
            <button className="button secondary" disabled={busy !== null} type="submit">
              <CircleDollarSign aria-hidden /> ثبت برآورد
            </button>
          </div>
        </form>
      ) : null}

      {canRecordParts ? (
        <form className="service-action-panel" onSubmit={submitPart}>
          <SectionHeading
            description="قطعه نصب‌شده از موجودی واقعی انبار کسر می‌شود."
            help={appHelp.serviceParts}
            icon={PackagePlus}
            title="قطعات تعمیر"
          />
          <div className="service-segmented">
            <button className={partUsage === 'installed' ? 'active' : ''} onClick={() => setPartUsage('installed')} type="button">قطعه نصب‌شده</button>
            <button className={partUsage === 'removed' ? 'active' : ''} onClick={() => setPartUsage('removed')} type="button">قطعه بازشده</button>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>قطعه *</span>
              <select value={partProductId} onChange={(event) => setPartProductId(event.target.value)} required>
                <option value="">انتخاب قطعه</option>
                {options.products.map((product) => (
                  <option key={product.id} value={product.id}>{product.code} ـ {product.name}</option>
                ))}
              </select>
            </label>
            {partUsage === 'installed' ? (
              <label className="field">
                <span>انبار مصرف *</span>
                <select value={partWarehouseId} onChange={(event) => setPartWarehouseId(event.target.value)} required>
                  <option value="">انتخاب انبار</option>
                  {options.warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ـ {warehouse.branchName}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="field">
              <span>تعداد *</span>
              <input
                defaultValue="1"
                disabled={selectedProduct?.trackingType === 'serial'}
                inputMode="decimal"
                key={selectedProduct?.trackingType}
                name="quantity"
                required
              />
            </label>
            {partUsage === 'installed' && selectedProduct?.trackingType === 'serial' ? (
              <label className="field">
                <span>شماره سریال قطعه *</span>
                <select disabled={serialPending} name="serialId" required>
                  <option value="">{serialPending ? 'در حال دریافت…' : 'انتخاب سریال موجود'}</option>
                  {partSerials.map((serial) => (
                    <option key={serial.id} value={serial.id}>{serial.serialNumber}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {partUsage === 'installed' ? (
              <>
                <label className="field">
                  <span>قیمت واحد ({amountUnit === 'IRR' ? 'ریال' : 'تومان'}) *</span>
                  <input defaultValue="0" inputMode="decimal" name="unitPrice" required />
                </label>
                <label className="boolean-field service-charge-field">
                  <input
                    disabled={order.warrantyDecision === 'in_warranty'}
                    name="isChargeable"
                    type="checkbox"
                  />
                  <span>
                    <strong>قابل دریافت از مشتری</strong>
                    <small>در تعمیر گارانتی غیرفعال است.</small>
                  </span>
                </label>
              </>
            ) : (
              <label className="field">
                <span>سرنوشت قطعه بازشده *</span>
                <select name="removedDisposition" required>
                  {dispositions.map((value) => (
                    <option key={value} value={value}>{removedDispositionText(value)}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {partUsage === 'installed' ? (
            <p className="service-inline-note">
              موجودی قابل مصرف: {selectedBalance?.availableQuantity ?? '۰'} {selectedProduct?.unitName ?? ''}
            </p>
          ) : null}
          <div className="form-actions">
            <button className="button primary" disabled={busy !== null || !partProductId} type="submit">
              <PackagePlus aria-hidden /> ثبت قطعه
            </button>
          </div>
        </form>
      ) : null}

      <section className="service-action-panel">
        <SectionHeading
          description="همه قطعات نصب‌شده و بازشده این پرونده از داده واقعی نمایش داده می‌شوند."
          help={appHelp.serviceParts}
          icon={ClipboardList}
          title="سوابق قطعات"
        />
        {order.parts.length === 0 ? (
          <div className="empty-state">قطعه‌ای برای این پرونده ثبت نشده است.</div>
        ) : (
          <div className="service-parts-list">
            {order.parts.map((part) => (
              <article key={part.id}>
                <div>
                  <strong>{part.productName}</strong>
                  <span>{part.productCode}{part.serialNumber ? ' · ' + part.serialNumber : ''}</span>
                </div>
                <div>
                  <b>{part.quantity}</b>
                  <span>{part.usageType === 'installed' ? 'نصب‌شده' : removedDispositionText(part.removedDisposition!)}</span>
                </div>
                <div>
                  <b>{part.usageType === 'installed' ? formatIrrAmount(part.unitPriceIrr, amountUnit) : '—'}</b>
                  <span>{part.isChargeable ? 'قابل دریافت' : 'بدون دریافت'}</span>
                </div>
              </article>
            ))}
          </div>
        )}
        {chargeablePartsIrr > 0n ? (
          <p className="service-inline-note">جمع قطعات قابل دریافت: {formatIrrAmount(chargeablePartsIrr, amountUnit)}</p>
        ) : null}
      </section>


      <section className="service-action-panel">
        <SectionHeading
          description="عکس یا PDF اختیاری پرونده با دسترسی داخلی نگهداری می‌شود."
          help={appHelp.serviceAttachments}
          icon={Paperclip}
          title="عکس‌ها و مستندات"
        />
        {canAttach ? (
          <form className="service-attachment-form" onSubmit={submitAttachment}>
            <div className="form-grid">
              <label className="field">
                <span>نوع مستند *</span>
                <select defaultValue="diagnosis" name="attachmentType">
                  <option value="intake">هنگام پذیرش</option>
                  <option value="diagnosis">عیب‌یابی</option>
                  <option value="warranty_evidence">مستند گارانتی</option>
                  <option value="repair">تعمیر</option>
                  <option value="delivery">تحویل</option>
                </select>
              </label>
              <label className="field">
                <span>فایل اختیاری (حداکثر ۵ مگابایت) *</span>
                <input
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  name="file"
                  required
                  type="file"
                />
              </label>
              <label className="field full">
                <span>توضیح فایل</span>
                <input maxLength={1000} name="caption" />
              </label>
            </div>
            <div className="form-actions">
              <button className="button secondary" disabled={busy !== null} type="submit">
                <Paperclip aria-hidden /> ذخیره مستند
              </button>
            </div>
          </form>
        ) : null}
        {order.attachments.length === 0 ? (
          <div className="empty-state">مستندی برای این پرونده ثبت نشده است.</div>
        ) : (
          <div className="service-attachment-list">
            {order.attachments.map((attachment) => (
              <article key={attachment.id}>
                <Paperclip aria-hidden />
                <div>
                  <strong>{attachment.originalName}</strong>
                  <span>{attachment.caption || 'بدون توضیح'} · {formatJalaliDateTime(attachment.createdAt)}</span>
                </div>
                <a
                  className="button secondary"
                  href={'/api/service/attachments/' + attachment.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  مشاهده
                </a>
              </article>
            ))}
          </div>
        )}
      </section>

      {canRepair && order.status === 'final_test' ? (
        <form className="service-action-panel" onSubmit={submitFinalize}>
          <SectionHeading
            description="هزینه نهایی سند حسابداری واقعی ایجاد می‌کند و پرونده را آماده تحویل می‌سازد."
            help={appHelp.serviceFinalize}
            icon={Wrench}
            title="نهایی‌سازی تعمیر"
          />
          <div className="form-grid">
            <label className="field">
              <span>هزینه نهایی ({amountUnit === 'IRR' ? 'ریال' : 'تومان'}) *</span>
              <input
                defaultValue={amountIrrToInput(
                  order.warrantyDecision === 'in_warranty' ? '0' : order.estimatedCostIrr,
                  amountUnit,
                )}
                disabled={order.warrantyDecision === 'in_warranty'}
                inputMode="decimal"
                name="finalCost"
                required
              />
            </label>
            <label className="field">
              <span>نتیجه آزمون و شرح نهایی *</span>
              <textarea maxLength={3000} minLength={3} name="description" required rows={2} />
            </label>
          </div>
          <div className="form-actions">
            <button className="button primary" disabled={busy !== null} type="submit">
              <Wrench aria-hidden /> تأیید آزمون و آماده تحویل
            </button>
          </div>
        </form>
      ) : null}

      {order.status === 'ready_delivery' ? (
        <form className="service-action-panel" onSubmit={submitDelivery}>
          <SectionHeading
            description="تحویل فقط پس از تسویه و با ثبت گارانتی یک یا سه‌ماهه خدمات انجام می‌شود."
            help={appHelp.serviceDelivery}
            icon={Truck}
            title="تحویل دستگاه"
          />
          {remainingIrr > 0n ? (
            <div className="form-message error">
              مانده قابل دریافت {formatIrrAmount(remainingIrr, amountUnit)} است.
              {canUseTreasury ? (
                <> برای ثبت دریافت به <Link to="/treasury">خزانه</Link> بروید.</>
              ) : (
                <> ثبت دریافت باید توسط کاربر مجاز خزانه انجام شود.</>
              )}
            </div>
          ) : null}
          <div className="form-grid">
            <label className="field">
              <span>مدت گارانتی خدمات *</span>
              <select defaultValue="1" name="serviceWarrantyMonths">
                <option value="1">یک ماه</option>
                <option value="3">سه ماه</option>
              </select>
            </label>
            <label className="field">
              <span>توضیح گارانتی خدمات</span>
              <textarea maxLength={2000} name="warrantyDescription" rows={2} />
            </label>
            <label className="field full">
              <span>یادداشت تحویل *</span>
              <textarea maxLength={2000} minLength={2} name="deliveryNote" required rows={2} />
            </label>
          </div>
          <div className="form-actions">
            <button
              className="button primary"
              disabled={!canDeliver || busy !== null || remainingIrr > 0n}
              type="submit"
            >
              <Truck aria-hidden /> ثبت تحویل
            </button>
          </div>
        </form>
      ) : null}

      {order.serviceWarranty ? (
        <article className="service-warranty-card">
          <ShieldCheck aria-hidden />
          <div>
            <h3>گارانتی خدمات ثبت‌شده</h3>
            <p>
              {order.serviceWarranty.durationMonths === 1 ? 'یک ماه' : 'سه ماه'}، از{' '}
              {formatJalaliDate(order.serviceWarranty.startsOn)} تا{' '}
              {formatJalaliDate(order.serviceWarranty.endsOn)}
            </p>
            {order.serviceWarranty.description ? <span>{order.serviceWarranty.description}</span> : null}
          </div>
        </article>
      ) : null}

      <section className="service-action-panel">
        <SectionHeading
          description="رویدادها حذف یا بازنویسی نمی‌شوند و سابقه پرونده را نگه می‌دارند."
          help={appHelp.serviceHistory}
          icon={Activity}
          title="تاریخچه پرونده"
        />
        <ol className="service-timeline">
          {[...order.events].reverse().map((event, index) => (
            <li key={event.createdAt + '-' + index}>
              <span />
              <div>
                <strong>{event.toStatus ? serviceStatusText(event.toStatus) : event.eventType}</strong>
                <p>{event.description}</p>
                <time>{formatJalaliDateTime(event.createdAt)}</time>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
