import {
  CheckCircle2,
  Factory,
  Play,
  Save,
  X,
  XCircle,
} from 'lucide-react';
import {
  useState,
  type FormEvent,
} from 'react';
import type {AmountUnit} from '../../shared/contracts.js';
import {errorMessage, postJson} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {formatJalaliDate} from './jalali-date.js';
import {appHelp} from './help-content.js';
import {
  amountInputToIrr,
  amountIrrToInput,
} from './master-data.helpers.js';
import {formatIrrAmount} from './purchase.helpers.js';
import {
  parseAndValidateProductionSerials,
  positiveProductionQuantity,
  validateCompletionMaterials,
} from './production.helpers.js';
import {ProductionSerialField} from './ProductionSerialField.js';
import type {
  ProductionOrderDetail,
  ProductionStageStatus,
} from './production.types.js';

interface ProductionOrderDetailPanelProps {
  detail: ProductionOrderDetail;
  amountUnit: AmountUnit;
  canManage: boolean;
  canPost: boolean;
  onClose: () => void;
  onChanged: (message: string) => Promise<void>;
}

function statusText(status: string): string {
  const labels: Record<string, string> = {
    draft: 'پیش‌نویس',
    planned: 'برنامه‌ریزی‌شده',
    released: 'آزادشده',
    in_progress: 'در حال تولید',
    completed: 'تکمیل‌شده',
    cancelled: 'لغوشده',
    reversed: 'اصلاح‌شده',
    pending: 'در انتظار',
    skipped: 'ردشده با دلیل',
  };
  return labels[status] ?? status;
}

export function ProductionOrderDetailPanel({
  detail,
  amountUnit,
  canManage,
  canPost,
  onClose,
  onChanged,
}: ProductionOrderDetailPanelProps) {
  const [pending, setPending] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startOrder(): Promise<void> {
    if (
      pending ||
      !window.confirm(
        'با شروع تولید، موجودی برنامه‌ریزی‌شده تمام مواد برای این دستور رزرو می‌شود. ادامه می‌دهید؟',
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await postJson('/api/production/orders/' + detail.id + '/start', {});
      await onChanged('دستور تولید شروع و مواد موردنیاز آن رزرو شد.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function updateStage(
    event: FormEvent<HTMLFormElement>,
    stageId: string,
  ): Promise<void> {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await postJson(
        '/api/production/orders/' + detail.id + '/stages/' + stageId,
        {
          status: String(form.get('status')) as ProductionStageStatus,
          notes: String(form.get('notes') ?? '').trim() || null,
        },
        'PATCH',
      );
      await onChanged('وضعیت مرحله تولید ثبت شد.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function completeOrder(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (pending) return;
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const actualQuantity = positiveProductionQuantity(
        String(form.get('actualQuantity') ?? ''),
        'مقدار واقعی محصول نهایی',
      );
      const values = new Map(
        detail.materials.map((material) => [
          material.id,
          {
            actualQuantity: String(
              form.get('actual-' + material.id) ?? '',
            ),
            returnedQuantity: String(
              form.get('returned-' + material.id) ?? '0',
            ),
            serialText: String(
              form.get('serials-' + material.id) ?? '',
            ),
          },
        ]),
      );
      const materials = validateCompletionMaterials(detail.materials, values);
      const outputSerialNumbers = parseAndValidateProductionSerials(
        String(form.get('outputSerials') ?? ''),
        detail.trackingType,
        actualQuantity,
        'محصول نهایی',
      );
      if (
        !window.confirm(
          'پایان تولید، موجودی مواد و حسابداری را قطعی و محصول نهایی را وارد انبار می‌کند. این عملیات با ویرایش ساده قابل بازگشت نیست. ادامه می‌دهید؟',
        )
      ) {
        return;
      }
      setPending(true);
      await postJson('/api/production/orders/' + detail.id + '/complete', {
        actualQuantity,
        outputSerialNumbers,
        directLaborCostIrr: amountInputToIrr(
          String(form.get('directLaborCost') ?? '0'),
          amountUnit,
        ),
        subcontractCostIrr: amountInputToIrr(
          String(form.get('subcontractCost') ?? '0'),
          amountUnit,
        ),
        overheadCostIrr: amountInputToIrr(
          String(form.get('overheadCost') ?? '0'),
          amountUnit,
        ),
        packagingCostIrr: amountInputToIrr(
          String(form.get('packagingCost') ?? '0'),
          amountUnit,
        ),
        materials,
      });
      await onChanged(
        'تولید نهایی شد؛ مواد مصرف، محصول وارد انبار و سند بهای تمام‌شده ثبت شد.',
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function cancelOrder(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '')
      .trim();
    if (
      !window.confirm(
        'این دستور بدون گردش موجودی لغو می‌شود و سابقه دلیل باقی می‌ماند. ادامه می‌دهید؟',
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await postJson(
        '/api/production/orders/' + detail.id + '/cancel',
        {reason},
      );
      await onChanged('دستور تولید لغو و دلیل آن ثبت شد.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  const allStagesDone = detail.stages.every((stage) =>
    ['completed', 'skipped'].includes(stage.status),
  );

  return (
    <section className="form-card production-order-detail">
      <button
        aria-label="بستن جزئیات"
        className="production-detail-close"
        onClick={onClose}
        type="button"
      >
        <X aria-hidden />
      </button>
      <div className="form-card-heading production-detail-heading">
        <ContextHelpButton help={appHelp.productionOrderDetail} />
        <h2>
          دستور {new Intl.NumberFormat('fa-IR').format(Number(detail.orderNumber))}
          {' — '}{detail.productName}
        </h2>
        <p>
          {detail.bomName}، نسخه{' '}
          {new Intl.NumberFormat('fa-IR').format(detail.bomVersionNumber)}
        </p>
      </div>

      {error ? <div className="form-message error" role="alert">{error}</div> : null}

      <div className="production-detail-summary">
        <div><span>وضعیت</span><strong>{statusText(detail.status)}</strong></div>
        <div><span>شعبه</span><strong>{detail.branchName}</strong></div>
        <div><span>مقدار برنامه</span><strong>{detail.plannedQuantity}</strong></div>
        <div><span>مقدار واقعی</span><strong>{detail.actualQuantity ?? '—'}</strong></div>
        <div>
          <span>شروع برنامه</span>
          <strong>{detail.plannedStartOn ? formatJalaliDate(detail.plannedStartOn) : '—'}</strong>
        </div>
        <div>
          <span>پایان برنامه</span>
          <strong>{detail.plannedEndOn ? formatJalaliDate(detail.plannedEndOn) : '—'}</strong>
        </div>
        <div><span>انبار مواد</span><strong>{detail.materialWarehouseName}</strong></div>
        <div><span>انبار محصول</span><strong>{detail.outputWarehouseName}</strong></div>
        <div className="production-summary-wide">
          <span>بهای تمام‌شده</span>
          <strong>{formatIrrAmount(detail.totalCostIrr, amountUnit)}</strong>
        </div>
      </div>

      <div className="production-subheading">
        <ContextHelpButton help={appHelp.productionStages} />
        <h3>مراحل تولید</h3>
      </div>
      <div className="production-stage-list">
        {detail.stages.map((stage) => (
          <form
            className="production-stage-card"
            key={stage.id}
            onSubmit={(event) => void updateStage(event, stage.id)}
          >
            <header>
              <span>مرحله {new Intl.NumberFormat('fa-IR').format(stage.sequenceNumber)}</span>
              <strong>{stage.title}</strong>
              <span className={'status-pill production-status-' + stage.status}>
                {statusText(stage.status)}
              </span>
            </header>
            {detail.status === 'in_progress' && canManage ? (
              <div className="production-stage-controls">
                <label className="field">
                  <span>وضعیت جدید</span>
                  <select defaultValue={stage.status} name="status">
                    <option value="pending">در انتظار</option>
                    <option value="in_progress">در حال اجرا</option>
                    <option value="completed">تکمیل‌شده</option>
                    <option value="skipped">ردشده با دلیل</option>
                  </select>
                </label>
                <label className="field">
                  <span>یادداشت یا دلیل رد</span>
                  <input defaultValue={stage.notes ?? ''} name="notes" maxLength={1000} />
                </label>
                <button className="button secondary" disabled={pending} type="submit">
                  <Save aria-hidden /> ثبت مرحله
                </button>
              </div>
            ) : stage.notes ? (
              <p>{stage.notes}</p>
            ) : null}
          </form>
        ))}
      </div>

      <div className="production-subheading">
        <ContextHelpButton help={appHelp.productionMaterials} />
        <h3>مواد برنامه‌ریزی‌شده و مصرف واقعی</h3>
      </div>
      <div className="production-material-list">
        {detail.materials.map((material) => (
          <article className="production-material-card" key={material.id}>
            <header>
              <strong>{material.productCode} — {material.productName}</strong>
              <span>{material.warehouseName}</span>
            </header>
            <dl>
              <dt>برنامه</dt><dd>{material.plannedQuantity} {material.unitName}</dd>
              <dt>مصرف واقعی</dt><dd>{material.actualQuantity} {material.unitName}</dd>
              <dt>برگشت ثبت‌شده</dt><dd>{material.returnedQuantity} {material.unitName}</dd>
            </dl>
            {material.serialNumbers.length > 0 ? (
              <div className="production-serial-chips">
                {material.serialNumbers.map((serial) => (
                  <code key={serial}>{serial}</code>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {detail.outputs.length > 0 ? (
        <>
          <div className="production-subheading"><h3>خروجی ثبت‌شده</h3></div>
          <div className="production-material-list">
            {detail.outputs.map((output) => (
              <article className="production-material-card" key={output.id}>
                <header>
                  <strong>{output.quantity} عدد/واحد</strong>
                  <span>{output.warehouseName}</span>
                </header>
                <p>بهای واحد: {formatIrrAmount(output.unitCostIrr.split('.')[0] ?? '0', amountUnit)}</p>
                <div className="production-serial-chips">
                  {output.serialNumbers.map((serial) => <code key={serial}>{serial}</code>)}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}

      <div className="production-detail-actions">
        {canManage && ['planned', 'released'].includes(detail.status) ? (
          <button
            className="button primary"
            disabled={pending}
            onClick={() => void startOrder()}
            type="button"
          >
            <Play aria-hidden /> شروع و رزرو مواد
          </button>
        ) : null}
        {canPost && detail.status === 'in_progress' ? (
          <button
            className="button primary"
            disabled={pending || !allStagesDone}
            onClick={() => setShowCompletion((value) => !value)}
            type="button"
          >
            <CheckCircle2 aria-hidden /> ثبت پایان تولید
          </button>
        ) : null}
        {canManage && ['draft', 'planned', 'released'].includes(detail.status) ? (
          <button
            className="button danger"
            disabled={pending}
            onClick={() => setShowCancel((value) => !value)}
            type="button"
          >
            <XCircle aria-hidden /> لغو دستور
          </button>
        ) : null}
      </div>
      {!allStagesDone && detail.status === 'in_progress' ? (
        <p className="production-action-hint">
          برای نهایی‌کردن تولید، همه مراحل باید تکمیل یا با یادداشت رد شوند.
        </p>
      ) : null}

      {showCancel ? (
        <form className="production-cancel-form" onSubmit={(event) => void cancelOrder(event)}>
          <label className="field">
            <span>دلیل لغو *</span>
            <textarea name="reason" required minLength={5} maxLength={1000} />
          </label>
          <button className="button danger" disabled={pending} type="submit">
            ثبت لغو با سابقه
          </button>
        </form>
      ) : null}

      {showCompletion ? (
        <form className="production-completion-form" onSubmit={(event) => void completeOrder(event)}>
          <div className="form-card-heading">
            <ContextHelpButton help={appHelp.productionCompletion} />
            <Factory aria-hidden />
            <h2>نهایی‌کردن تولید</h2>
            <p>مقادیر واقعی و هزینه‌های همان دستور را وارد کنید.</p>
          </div>
          <div className="production-form-grid">
            <label className="field">
              <span>مقدار واقعی محصول نهایی *</span>
              <input
                defaultValue={detail.plannedQuantity}
                inputMode="decimal"
                name="actualQuantity"
                required
              />
            </label>
            <label className="field">
              <span>دستمزد مستقیم ({amountUnit === 'IRR' ? 'ریال' : 'تومان'})</span>
              <input
                defaultValue={amountIrrToInput(detail.directLaborCostIrr, amountUnit)}
                inputMode="decimal"
                name="directLaborCost"
                required
              />
            </label>
            <label className="field">
              <span>برون‌سپاری ({amountUnit === 'IRR' ? 'ریال' : 'تومان'})</span>
              <input
                defaultValue={amountIrrToInput(detail.subcontractCostIrr, amountUnit)}
                inputMode="decimal"
                name="subcontractCost"
                required
              />
            </label>
            <label className="field">
              <span>سربار ({amountUnit === 'IRR' ? 'ریال' : 'تومان'})</span>
              <input
                defaultValue={amountIrrToInput(detail.overheadCostIrr, amountUnit)}
                inputMode="decimal"
                name="overheadCost"
                required
              />
            </label>
            <label className="field">
              <span>بسته‌بندی ({amountUnit === 'IRR' ? 'ریال' : 'تومان'})</span>
              <input
                defaultValue={amountIrrToInput(detail.packagingCostIrr, amountUnit)}
                inputMode="decimal"
                name="packagingCost"
                required
              />
            </label>
          </div>

          <div className="production-completion-materials">
            {detail.materials.map((material) => (
              <article className="production-completion-material" key={material.id}>
                <header>
                  <strong>{material.productName}</strong>
                  <span>برنامه: {material.plannedQuantity} {material.unitName}</span>
                </header>
                <div className="production-form-grid">
                  <label className="field">
                    <span>مصرف واقعی *</span>
                    <input
                      defaultValue={material.plannedQuantity}
                      inputMode="decimal"
                      name={'actual-' + material.id}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>برگشت از خط</span>
                    <input
                      defaultValue="0"
                      inputMode="decimal"
                      name={'returned-' + material.id}
                      required
                    />
                  </label>
                </div>
                {material.trackingType === 'serial' ? (
                  <ProductionSerialField
                    allowInventoryLookup
                    label={'سریال‌های مصرفی ' + material.productName}
                    name={'serials-' + material.id}
                    productId={material.productId}
                    warehouseId={material.warehouseId}
                  />
                ) : null}
              </article>
            ))}
          </div>

          {detail.trackingType === 'serial' ? (
            <ProductionSerialField
              label="سریال‌های محصول نهایی"
              name="outputSerials"
            />
          ) : null}

          <div className="production-form-actions">
            <button className="button primary" disabled={pending} type="submit">
              <CheckCircle2 aria-hidden />
              {pending ? 'در حال نهایی‌سازی…' : 'نهایی‌سازی واقعی تولید'}
            </button>
            <button
              className="button secondary"
              disabled={pending}
              onClick={() => setShowCompletion(false)}
              type="button"
            >
              <X aria-hidden /> انصراف
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
