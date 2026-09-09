import Decimal from 'decimal.js';
import {CirclePlus, Eye, Plus, RefreshCw, Save, Search, Trash2, X} from 'lucide-react';
import {useCallback, useEffect, useState, type FormEvent} from 'react';
import type {AmountUnit} from '../../shared/contracts.js';
import {api, errorMessage, postJson} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {formatJalaliDate, jalaliInputToIso} from './jalali-date.js';
import {JalaliDateField} from './JalaliDateField.js';
import {appHelp} from './help-content.js';
import {ActionFeedback, Pager} from './MasterDataUi.js';
import {formatIrrAmount} from './purchase.helpers.js';
import {positiveProductionQuantity, validateProductionStages} from './production.helpers.js';
import {ProductionOrderDetailPanel} from './ProductionOrderDetailPanel.js';
import type {
  ProductionAvailability,
  ProductionOptions,
  ProductionOrderDetail,
  ProductionOrderStatus,
  ProductionOrderSummary,
} from './production.types.js';

interface Props {
  options: ProductionOptions;
  amountUnit: AmountUnit;
  canManage: boolean;
  canPost: boolean;
  onChanged: () => Promise<void>;
}

type StatusFilter = ProductionOrderStatus | 'all';
interface StageDraft {key: string; code: string; title: string}

const PAGE_SIZE = 25;
let stageSequence = 0;

function newStage(code = '', title = ''): StageDraft {
  stageSequence += 1;
  return {key: 'production-stage-' + stageSequence, code, title};
}

function statusText(status: ProductionOrderStatus): string {
  const labels: Record<ProductionOrderStatus, string> = {
    draft: 'پیش‌نویس',
    planned: 'برنامه‌ریزی‌شده',
    released: 'آزادشده',
    in_progress: 'در حال تولید',
    completed: 'تکمیل‌شده',
    cancelled: 'لغوشده',
    reversed: 'اصلاح‌شده',
  };
  return labels[status];
}

export function ProductionOrderPanel({
  options,
  amountUnit,
  canManage,
  canPost,
  onChanged,
}: Props) {
  const [records, setRecords] = useState<ProductionOrderSummary[]>([]);
  const [selected, setSelected] = useState<ProductionOrderDetail | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [selectedBomVersion, setSelectedBomVersion] = useState('');
  const [materialWarehouseId, setMaterialWarehouseId] = useState('');
  const [plannedQuantity, setPlannedQuantity] = useState('1');
  const [stages, setStages] = useState<StageDraft[]>([
    newStage('assembly', 'مونتاژ نهایی'),
    newStage('packing', 'بسته‌بندی'),
  ]);
  const [availability, setAvailability] =
    useState<ProductionAvailability | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [offset, setOffset] = useState(0);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detailPending, setDetailPending] = useState(false);
  const [availabilityPending, setAvailabilityPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        search,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      setRecords(
        await api<ProductionOrderSummary[]>(
          '/api/production/orders?' + params.toString(),
        ),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }, [fromDate, offset, search, statusFilter, toDate]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailPending(true);
    setError(null);
    try {
      setSelected(
        await api<ProductionOrderDetail>('/api/production/orders/' + id),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setDetailPending(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords, reloadVersion]);

  function openForm(): void {
    setSelected(null);
    setShowForm(true);
    setSelectedBomVersion(options.boms[0]?.activeVersionId ?? '');
    setMaterialWarehouseId(options.warehouses[0]?.id ?? '');
    setPlannedQuantity('1');
    setStages([
      newStage('assembly', 'مونتاژ نهایی'),
      newStage('packing', 'بسته‌بندی'),
    ]);
    setAvailability(null);
    setFormVersion((value) => value + 1);
    setError(null);
    setSuccess(null);
  }

  async function loadAvailability(): Promise<void> {
    if (!selectedBomVersion || !materialWarehouseId) {
      setError('فرمول فعال و انبار مواد را انتخاب کنید.');
      return;
    }
    setAvailabilityPending(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        bomVersionId: selectedBomVersion,
        warehouseId: materialWarehouseId,
      });
      setAvailability(
        await api<ProductionAvailability>(
          '/api/production/availability?' + params.toString(),
        ),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setAvailabilityPending(false);
    }
  }

  function updateStage(
    key: string,
    field: 'code' | 'title',
    value: string,
  ): void {
    setStages((current) =>
      current.map((stage) =>
        stage.key === key ? {...stage, [field]: value} : stage,
      ),
    );
  }

  async function createOrder(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const form = new FormData(event.currentTarget);
      const quantity = positiveProductionQuantity(
        plannedQuantity,
        'مقدار برنامه تولید',
      );
      validateProductionStages(stages);
      if (!availability) {
        throw new Error('پیش از ثبت، کفایت موجودی قطعات را بررسی کنید.');
      }
      if (new Decimal(quantity).greaterThan(availability.maximumQuantity)) {
        throw new Error(
          'مقدار برنامه از حداکثر قابل تولید براساس موجودی بیشتر است.',
        );
      }
      const startInput = String(form.get('plannedStartOn') ?? '').trim();
      const endInput = String(form.get('plannedEndOn') ?? '').trim();
      const plannedStartOn = startInput ? jalaliInputToIso(startInput) : null;
      const plannedEndOn = endInput ? jalaliInputToIso(endInput) : null;
      if (plannedStartOn && plannedEndOn && plannedStartOn > plannedEndOn) {
        throw new Error('تاریخ پایان نمی‌تواند پیش از تاریخ شروع باشد.');
      }
      const created = await postJson<{id: string; orderNumber: string}>(
        '/api/production/orders',
        {
          branchId: String(form.get('branchId') ?? ''),
          bomVersionId: selectedBomVersion,
          plannedQuantity: quantity,
          materialWarehouseId,
          wipWarehouseId:
            String(form.get('wipWarehouseId') ?? '') || null,
          outputWarehouseId: String(
            form.get('outputWarehouseId') ?? '',
          ),
          plannedStartOn,
          plannedEndOn,
          description:
            String(form.get('description') ?? '').trim() || null,
          stages: stages.map((stage) => ({
            code: stage.code.trim(),
            title: stage.title.trim(),
          })),
        },
      );
      setShowForm(false);
      setSuccess(
        'دستور تولید شماره ' +
          new Intl.NumberFormat('fa-IR').format(Number(created.orderNumber)) +
          ' ثبت شد.',
      );
      await Promise.all([loadRecords(), onChanged()]);
      await loadDetail(created.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function detailChanged(message: string): Promise<void> {
    setSuccess(message);
    setError(null);
    setReloadVersion((value) => value + 1);
    await onChanged();
    if (selected) await loadDetail(selected.id);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const fromInput = String(form.get('from') ?? '').trim();
      const toInput = String(form.get('to') ?? '').trim();
      const nextFrom = fromInput ? jalaliInputToIso(fromInput) : '';
      const nextTo = toInput ? jalaliInputToIso(toInput) : '';
      if (nextFrom && nextTo && nextFrom > nextTo) {
        throw new Error('ابتدای بازه نمی‌تواند پس از انتهای بازه باشد.');
      }
      setSearch(String(form.get('search') ?? '').trim());
      setStatusFilter(
        String(form.get('status') ?? 'all') as StatusFilter,
      );
      setFromDate(nextFrom);
      setToDate(nextTo);
      setOffset(0);
      setReloadVersion((value) => value + 1);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <section className="production-panel">
      <div className="production-section-heading">
        <ContextHelpButton help={appHelp.productionOrders} />
        <div>
          <p>برنامه، رزرو مواد، مراحل و بهای تمام‌شده</p>
          <h2>دستورهای تولید</h2>
        </div>
        {canManage ? (
          <button
            className="button primary"
            onClick={openForm}
            type="button"
          >
            <CirclePlus aria-hidden /> دستور جدید
          </button>
        ) : null}
      </div>
      <ActionFeedback error={error} success={success} />

      {showForm ? (
        <form
          className="form-card production-form"
          key={formVersion}
          onSubmit={(event) => void createOrder(event)}
        >
          <div className="form-card-heading">
            <ContextHelpButton help={appHelp.productionOrderForm} />
            <h2>برنامه‌ریزی دستور تولید</h2>
            <p>فرمول فعال و کفایت موجودی پیش از ثبت کنترل می‌شود.</p>
          </div>
          <div className="production-form-grid">
            <label className="field">
              <span>شعبه تولید *</span>
              <select name="branchId" required>
                <option value="">انتخاب شعبه</option>
                {options.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} — {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field production-wide-field">
              <span>فرمول فعال *</span>
              <select
                required
                value={selectedBomVersion}
                onChange={(event) => {
                  setSelectedBomVersion(event.target.value);
                  setAvailability(null);
                }}
              >
                <option value="">انتخاب فرمول</option>
                {options.boms.map((bom) => (
                  <option
                    key={bom.activeVersionId}
                    value={bom.activeVersionId}
                  >
                    {bom.productCode} — {bom.productName} · نسخه{' '}
                    {bom.activeVersionNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>مقدار برنامه *</span>
              <input
                inputMode="decimal"
                required
                value={plannedQuantity}
                onChange={(event) =>
                  setPlannedQuantity(event.target.value)
                }
              />
            </label>
            <label className="field">
              <span>انبار مواد *</span>
              <select
                required
                value={materialWarehouseId}
                onChange={(event) => {
                  setMaterialWarehouseId(event.target.value);
                  setAvailability(null);
                }}
              >
                <option value="">انتخاب انبار</option>
                {options.warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.branchName} — {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>انبار کالای در جریان</span>
              <select name="wipWarehouseId">
                <option value="">بدون انبار میانی</option>
                {options.warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.branchName} — {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>انبار محصول نهایی *</span>
              <select name="outputWarehouseId" required>
                <option value="">انتخاب انبار</option>
                {options.warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.branchName} — {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <JalaliDateField
              name="plannedStartOn"
              label="تاریخ شروع برنامه"
            />
            <JalaliDateField
              name="plannedEndOn"
              label="تاریخ پایان برنامه"
            />
            <label className="field production-wide-field">
              <span>شرح دستور</span>
              <textarea name="description" maxLength={2000} />
            </label>
          </div>

          <section className="production-availability">
            <div className="production-subheading">
              <ContextHelpButton help={appHelp.productionAvailability} />
              <h3>کفایت موجودی مواد</h3>
              <button
                className="button secondary"
                disabled={availabilityPending}
                onClick={() => void loadAvailability()}
                type="button"
              >
                <RefreshCw aria-hidden />
                {availabilityPending
                  ? 'در حال محاسبه…'
                  : 'محاسبه واقعی'}
              </button>
            </div>
            {availability ? (
              <>
                <div className="production-maximum">
                  <span>حداکثر قابل تولید با موجودی آزاد فعلی</span>
                  <strong>{availability.maximumQuantity}</strong>
                </div>
                <div className="production-availability-grid">
                  {availability.components.map((component) => (
                    <article key={component.productId}>
                      <strong>
                        {component.productCode} — {component.productName}
                      </strong>
                      <span>
                        نیاز هر محصول: {component.requiredPerOutput}
                      </span>
                      <span>
                        موجودی آزاد: {component.availableQuantity}
                      </span>
                      <span>
                        حداکثر خروجی: {component.maximumOutput}
                      </span>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className="production-empty-note">
                پس از انتخاب فرمول و انبار، دکمه محاسبه واقعی را بزنید.
              </p>
            )}
          </section>

          <div className="production-subheading">
            <ContextHelpButton help={appHelp.productionStages} />
            <h3>مراحل اجرای دستور</h3>
            <button
              className="button secondary"
              onClick={() =>
                setStages((current) => [...current, newStage()])
              }
              type="button"
            >
              <Plus aria-hidden /> افزودن مرحله
            </button>
          </div>
          <div className="production-stage-editor">
            {stages.map((stage, index) => (
              <article key={stage.key}>
                <strong>
                  مرحله{' '}
                  {new Intl.NumberFormat('fa-IR').format(index + 1)}
                </strong>
                <label className="field">
                  <span>کد انگلیسی *</span>
                  <input
                    dir="ltr"
                    required
                    value={stage.code}
                    onChange={(event) =>
                      updateStage(
                        stage.key,
                        'code',
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label className="field">
                  <span>عنوان فارسی *</span>
                  <input
                    required
                    value={stage.title}
                    onChange={(event) =>
                      updateStage(
                        stage.key,
                        'title',
                        event.target.value,
                      )
                    }
                  />
                </label>
                <button
                  aria-label="حذف مرحله"
                  className="button danger"
                  disabled={stages.length === 1}
                  onClick={() =>
                    setStages((current) =>
                      current.filter(
                        (item) => item.key !== stage.key,
                      ),
                    )
                  }
                  type="button"
                >
                  <Trash2 aria-hidden /> حذف
                </button>
              </article>
            ))}
          </div>

          <div className="production-form-actions">
            <button
              className="button primary"
              disabled={saving}
              type="submit"
            >
              <Save aria-hidden />
              {saving ? 'در حال ثبت…' : 'ثبت دستور تولید'}
            </button>
            <button
              className="button secondary"
              disabled={saving}
              onClick={() => setShowForm(false)}
              type="button"
            >
              <X aria-hidden /> انصراف
            </button>
          </div>
        </form>
      ) : null}

      {selected ? (
        <ProductionOrderDetailPanel
          amountUnit={amountUnit}
          canManage={canManage}
          canPost={canPost}
          detail={selected}
          onChanged={detailChanged}
          onClose={() => setSelected(null)}
        />
      ) : null}

      <form className="production-filter-card" onSubmit={applyFilters}>
        <div className="production-subheading">
          <ContextHelpButton help={appHelp.productionFilters} />
          <h3>جستجو و فیلتر دستورها</h3>
        </div>
        <div className="production-filter-grid">
          <label className="field production-filter-search">
            <span>شماره، کد یا نام محصول</span>
            <input name="search" maxLength={160} />
          </label>
          <label className="field">
            <span>وضعیت</span>
            <select defaultValue={statusFilter} name="status">
              <option value="all">همه وضعیت‌ها</option>
              <option value="planned">برنامه‌ریزی‌شده</option>
              <option value="released">آزادشده</option>
              <option value="in_progress">در حال تولید</option>
              <option value="completed">تکمیل‌شده</option>
              <option value="cancelled">لغوشده</option>
            </select>
          </label>
          <JalaliDateField name="from" label="شروع از تاریخ" />
          <JalaliDateField name="to" label="پایان تا تاریخ" />
          <div className="production-filter-actions">
            <button
              className="button secondary"
              disabled={pending}
              type="submit"
            >
              <Search aria-hidden /> اعمال فیلتر
            </button>
            <button
              className="button secondary"
              disabled={pending}
              onClick={() =>
                setReloadVersion((value) => value + 1)
              }
              type="button"
            >
              <RefreshCw aria-hidden /> بازخوانی
            </button>
          </div>
        </div>
      </form>

      <div className="table-card">
        {pending ? (
          <div className="empty-state">
            در حال دریافت دستورهای تولید…
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            دستور تولیدی مطابق فیلتر وجود ندارد.
          </div>
        ) : (
          <>
            <div className="production-list-desktop table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>شماره</th>
                    <th>محصول</th>
                    <th>شعبه</th>
                    <th>برنامه</th>
                    <th>واقعی</th>
                    <th>شروع</th>
                    <th>وضعیت</th>
                    <th>بهای تمام‌شده</th>
                    <th>جزئیات</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>
                        {new Intl.NumberFormat('fa-IR').format(
                          Number(record.orderNumber),
                        )}
                      </td>
                      <td>
                        {record.productCode} — {record.productName}
                      </td>
                      <td>{record.branchName}</td>
                      <td>{record.plannedQuantity}</td>
                      <td>{record.actualQuantity ?? '—'}</td>
                      <td>
                        {record.plannedStartOn
                          ? formatJalaliDate(record.plannedStartOn)
                          : '—'}
                      </td>
                      <td>
                        <span
                          className={
                            'status-pill production-status-' +
                            record.status
                          }
                        >
                          {statusText(record.status)}
                        </span>
                      </td>
                      <td>
                        {formatIrrAmount(
                          record.totalCostIrr,
                          amountUnit,
                        )}
                      </td>
                      <td>
                        <button
                          className="button secondary production-small-button"
                          disabled={detailPending}
                          onClick={() => void loadDetail(record.id)}
                          type="button"
                        >
                          <Eye aria-hidden /> مشاهده
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="production-list-mobile">
              {records.map((record) => (
                <article
                  className="production-mobile-card"
                  key={record.id}
                >
                  <header>
                    <span>
                      دستور{' '}
                      {new Intl.NumberFormat('fa-IR').format(
                        Number(record.orderNumber),
                      )}
                    </span>
                    <span
                      className={
                        'status-pill production-status-' +
                        record.status
                      }
                    >
                      {statusText(record.status)}
                    </span>
                  </header>
                  <h3>{record.productName}</h3>
                  <dl>
                    <dt>شعبه</dt>
                    <dd>{record.branchName}</dd>
                    <dt>مقدار برنامه</dt>
                    <dd>{record.plannedQuantity}</dd>
                    <dt>مقدار واقعی</dt>
                    <dd>{record.actualQuantity ?? '—'}</dd>
                    <dt>شروع</dt>
                    <dd>
                      {record.plannedStartOn
                        ? formatJalaliDate(record.plannedStartOn)
                        : '—'}
                    </dd>
                  </dl>
                  <button
                    className="button secondary"
                    onClick={() => void loadDetail(record.id)}
                    type="button"
                  >
                    <Eye aria-hidden /> مشاهده و عملیات
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
        <Pager
          offset={offset}
          onPage={setOffset}
          pageSize={PAGE_SIZE}
          pending={pending}
          returned={records.length}
        />
      </div>
    </section>
  );
}
