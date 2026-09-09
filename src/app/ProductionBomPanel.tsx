import {
  CirclePlus,
  Eye,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import {api, errorMessage, postJson} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {JalaliDateField} from './JalaliDateField.js';
import {jalaliInputToIso} from './jalali-date.js';
import {ActionFeedback} from './MasterDataUi.js';
import {
  positiveProductionQuantity,
  validateBomComponents,
} from './production.helpers.js';
import type {
  BomComponentDraft,
  BomDetail,
  BomSummary,
  ProductionOptions,
} from './production.types.js';
import {formatJalaliDate} from './jalali-date.js';
import {appHelp} from './help-content.js';

interface ProductionBomPanelProps {
  options: ProductionOptions;
  canManage: boolean;
  onChanged: () => Promise<void>;
}

let componentSequence = 0;

function newComponent(): BomComponentDraft {
  componentSequence += 1;
  return {
    key: 'bom-component-' + componentSequence,
    productId: '',
    quantity: '1',
    wastePercent: '0',
    stageCode: 'assembly',
    issueWarehouseId: '',
    notes: '',
  };
}

export function ProductionBomPanel({
  options,
  canManage,
  onChanged,
}: ProductionBomPanelProps) {
  const [records, setRecords] = useState<BomSummary[]>([]);
  const [selected, setSelected] = useState<BomDetail | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'version' | null>(null);
  const [components, setComponents] = useState<BomComponentDraft[]>([
    newComponent(),
  ]);
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setPending(true);
    try {
      setRecords(await api<BomSummary[]>('/api/production/boms'));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setActing(true);
    setError(null);
    try {
      setSelected(await api<BomDetail>('/api/production/boms/' + id));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setActing(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  function openCreate(): void {
    setSelected(null);
    setComponents([newComponent()]);
    setFormMode('create');
    setFormVersion((value) => value + 1);
    setError(null);
    setSuccess(null);
  }

  function openVersion(): void {
    if (!selected) return;
    const active = selected.versions.find((version) => version.status === 'active');
    const sourceComponents = active
      ? selected.components.filter(
          (component) => component.bomVersionId === active.id,
        )
      : [];
    setComponents(
      sourceComponents.length > 0
        ? sourceComponents.map((component) => ({
            key: 'bom-component-' + ++componentSequence,
            productId: component.productId,
            quantity: component.quantity,
            wastePercent: component.wastePercent,
            stageCode: component.stageCode,
            issueWarehouseId: component.issueWarehouseId ?? '',
            notes: component.notes ?? '',
          }))
        : [newComponent()],
    );
    setFormMode('version');
    setFormVersion((value) => value + 1);
    setError(null);
    setSuccess(null);
  }

  function updateComponent(
    key: string,
    field: keyof Omit<BomComponentDraft, 'key'>,
    value: string,
  ): void {
    setComponents((current) =>
      current.map((component) =>
        component.key === key ? {...component, [field]: value} : component,
      ),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (saving || !formMode) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const form = new FormData(event.currentTarget);
      const productId =
        formMode === 'create'
          ? String(form.get('productId') ?? '')
          : selected?.productId ?? '';
      validateBomComponents(productId, components);
      const outputQuantity = positiveProductionQuantity(
        String(form.get('outputQuantity') ?? ''),
        'مقدار خروجی فرمول',
      );
      const effectiveInput = String(form.get('effectiveFrom') ?? '').trim();
      const versionPayload = {
        outputQuantity,
        effectiveFrom: effectiveInput
          ? jalaliInputToIso(effectiveInput)
          : null,
        notes: String(form.get('notes') ?? '').trim() || null,
        components: components.map((component) => ({
          productId: component.productId,
          quantity: positiveProductionQuantity(
            component.quantity,
            'مقدار مصرف قطعه',
          ),
          wastePercent: Number(component.wastePercent),
          stageCode: component.stageCode.trim(),
          issueWarehouseId: component.issueWarehouseId || null,
          notes: component.notes.trim() || null,
        })),
      };
      if (formMode === 'create') {
        await postJson('/api/production/boms', {
          code: String(form.get('code') ?? '').trim(),
          name: String(form.get('name') ?? '').trim(),
          productId,
          version: versionPayload,
          activate: form.get('activate') === 'on',
        });
        setSuccess('فرمول ساخت و نسخه نخست آن ثبت شد.');
      } else if (selected) {
        await postJson(
          '/api/production/boms/' + selected.id + '/versions',
          versionPayload,
        );
        setSuccess('نسخه جدید فرمول به‌صورت پیش‌نویس ثبت شد.');
        await loadDetail(selected.id);
      }
      setFormMode(null);
      await Promise.all([loadRecords(), onChanged()]);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function activateVersion(versionId: string): Promise<void> {
    if (!selected || acting) return;
    setActing(true);
    setError(null);
    setSuccess(null);
    try {
      await postJson('/api/production/bom-versions/' + versionId + '/activate', {});
      setSuccess('نسخه انتخاب‌شده فعال شد و نسخه فعال قبلی بازنشسته شد.');
      await Promise.all([
        loadDetail(selected.id),
        loadRecords(),
        onChanged(),
      ]);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setActing(false);
    }
  }

  const producibleProducts = options.products.filter(
    (product) =>
      product.isProducible &&
      ['manufactured', 'semi_finished'].includes(product.productType),
  );

  return (
    <section className="production-panel">
      <div className="production-section-heading">
        <ContextHelpButton help={appHelp.productionBom} />
        <div>
          <p>نسخه‌بندی، مواد، ضایعات و مرحله مصرف</p>
          <h2>فرمول‌های ساخت</h2>
        </div>
        <div className="production-heading-actions">
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => void loadRecords()}
            type="button"
          >
            <RefreshCw aria-hidden /> بازخوانی
          </button>
          {canManage ? (
            <button className="button primary" onClick={openCreate} type="button">
              <CirclePlus aria-hidden /> فرمول جدید
            </button>
          ) : null}
        </div>
      </div>

      <ActionFeedback error={error} success={success} />

      {formMode ? (
        <form
          className="form-card production-form"
          key={formVersion}
          onSubmit={(event) => void submit(event)}
        >
          <div className="form-card-heading">
            <ContextHelpButton help={appHelp.productionBomEditor} />
            <h2>
              {formMode === 'create'
                ? 'تعریف فرمول ساخت'
                : 'نسخه جدید فرمول «' + (selected?.name ?? '') + '»'}
            </h2>
            <p>هر نسخه پس از ثبت مستقل است و فقط یک نسخه می‌تواند فعال باشد.</p>
          </div>
          {formMode === 'create' ? (
            <div className="production-form-grid">
              <label className="field">
                <span>کد فرمول *</span>
                <input name="code" required maxLength={60} />
              </label>
              <label className="field">
                <span>نام فرمول *</span>
                <input name="name" required minLength={2} maxLength={180} />
              </label>
              <label className="field production-wide-field">
                <span>محصول نهایی *</span>
                <select name="productId" required>
                  <option value="">انتخاب محصول تولیدی</option>
                  {producibleProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.code} — {product.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          <div className="production-form-grid">
            <label className="field">
              <span>مقدار خروجی فرمول *</span>
              <input
                defaultValue="1"
                inputMode="decimal"
                name="outputQuantity"
                required
              />
            </label>
            <JalaliDateField name="effectiveFrom" label="تاریخ اثر نسخه" />
            <label className="field production-wide-field">
              <span>توضیحات نسخه</span>
              <textarea name="notes" maxLength={2000} />
            </label>
            {formMode === 'create' ? (
              <label className="production-check-field production-wide-field">
                <input defaultChecked name="activate" type="checkbox" />
                <span>
                  <strong>فعال‌سازی نسخه نخست</strong>
                  <small>با فعال‌سازی، این فرمول برای دستور تولید قابل انتخاب می‌شود.</small>
                </span>
              </label>
            ) : null}
          </div>

          <div className="production-subheading">
            <ContextHelpButton help={appHelp.productionBomComponents} />
            <h3>قطعات و مواد فرمول</h3>
            <button
              className="button secondary"
              onClick={() =>
                setComponents((current) => [...current, newComponent()])
              }
              type="button"
            >
              <Plus aria-hidden /> افزودن قطعه
            </button>
          </div>

          <div className="production-component-list">
            {components.map((component, index) => (
              <article className="production-component-card" key={component.key}>
                <header>
                  <strong>ردیف {new Intl.NumberFormat('fa-IR').format(index + 1)}</strong>
                  <button
                    aria-label="حذف قطعه"
                    className="button danger"
                    disabled={components.length === 1}
                    onClick={() =>
                      setComponents((current) =>
                        current.filter((item) => item.key !== component.key),
                      )
                    }
                    type="button"
                  >
                    <Trash2 aria-hidden /> حذف
                  </button>
                </header>
                <div className="production-component-grid">
                  <label className="field production-component-product">
                    <span>قطعه یا ماده *</span>
                    <select
                      required
                      value={component.productId}
                      onChange={(event) =>
                        updateComponent(
                          component.key,
                          'productId',
                          event.target.value,
                        )
                      }
                    >
                      <option value="">انتخاب قطعه</option>
                      {options.products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.code} — {product.name} ({product.unitName})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>مقدار مصرف *</span>
                    <input
                      inputMode="decimal"
                      required
                      value={component.quantity}
                      onChange={(event) =>
                        updateComponent(
                          component.key,
                          'quantity',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>درصد ضایعات</span>
                    <input
                      inputMode="decimal"
                      value={component.wastePercent}
                      onChange={(event) =>
                        updateComponent(
                          component.key,
                          'wastePercent',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>کد مرحله *</span>
                    <input
                      dir="ltr"
                      required
                      value={component.stageCode}
                      onChange={(event) =>
                        updateComponent(
                          component.key,
                          'stageCode',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>انبار برداشت اختصاصی</span>
                    <select
                      value={component.issueWarehouseId}
                      onChange={(event) =>
                        updateComponent(
                          component.key,
                          'issueWarehouseId',
                          event.target.value,
                        )
                      }
                    >
                      <option value="">انبار مواد دستور</option>
                      {options.warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.branchName} — {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field production-component-notes">
                    <span>یادداشت</span>
                    <input
                      maxLength={1000}
                      value={component.notes}
                      onChange={(event) =>
                        updateComponent(
                          component.key,
                          'notes',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>

          <div className="production-form-actions">
            <button className="button primary" disabled={saving} type="submit">
              <Save aria-hidden />
              {saving ? 'در حال ثبت…' : 'ثبت واقعی فرمول'}
            </button>
            <button
              className="button secondary"
              disabled={saving}
              onClick={() => setFormMode(null)}
              type="button"
            >
              <X aria-hidden /> انصراف
            </button>
          </div>
        </form>
      ) : null}

      {selected ? (
        <section className="form-card production-detail-card">
          <button
            className="production-detail-close"
            onClick={() => setSelected(null)}
            type="button"
            aria-label="بستن جزئیات"
          >
            <X aria-hidden />
          </button>
          <div className="form-card-heading production-detail-heading">
            <ContextHelpButton help={appHelp.productionBomVersions} />
            <h2>{selected.code} — {selected.name}</h2>
            <p>محصول نهایی: {selected.productName}</p>
          </div>
          <div className="production-version-list">
            {selected.versions.map((version) => {
              const versionComponents = selected.components.filter(
                (component) => component.bomVersionId === version.id,
              );
              return (
                <article className="production-version-card" key={version.id}>
                  <header>
                    <div>
                      <strong>نسخه {new Intl.NumberFormat('fa-IR').format(version.versionNumber)}</strong>
                      <span className={'status-pill production-status-' + version.status}>
                        {version.status === 'active'
                          ? 'فعال'
                          : version.status === 'draft'
                            ? 'پیش‌نویس'
                            : 'بازنشسته'}
                      </span>
                    </div>
                    {canManage && version.status === 'draft' ? (
                      <button
                        className="button primary"
                        disabled={acting}
                        onClick={() => void activateVersion(version.id)}
                        type="button"
                      >
                        فعال‌کردن
                      </button>
                    ) : null}
                  </header>
                  <p>
                    خروجی پایه: {version.outputQuantity}
                    {version.effectiveFrom
                      ? ' · تاریخ اثر: ' + formatJalaliDate(version.effectiveFrom)
                      : ''}
                  </p>
                  <div className="production-version-components">
                    {versionComponents.map((component) => (
                      <span key={component.id}>
                        {component.productName}: {component.quantity} {component.unitName}
                        {Number(component.wastePercent) > 0
                          ? ' + ' + component.wastePercent + '٪ ضایعات'
                          : ''}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
          {canManage ? (
            <div className="production-form-actions">
              <button className="button primary" onClick={openVersion} type="button">
                <Plus aria-hidden /> نسخه جدید از فرمول
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="table-card">
        {pending ? (
          <div className="empty-state">در حال دریافت فرمول‌ها…</div>
        ) : records.length === 0 ? (
          <div className="empty-state">هنوز فرمول ساختی ثبت نشده است.</div>
        ) : (
          <>
            <div className="production-list-desktop table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>کد فرمول</th>
                    <th>نام</th>
                    <th>محصول نهایی</th>
                    <th>نسخه فعال</th>
                    <th>مقدار خروجی</th>
                    <th>جزئیات</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.code}</td>
                      <td>{record.name}</td>
                      <td>{record.productCode} — {record.productName}</td>
                      <td>{record.activeVersionNumber ?? '—'}</td>
                      <td>{record.outputQuantity ?? '—'}</td>
                      <td>
                        <button
                          className="button secondary production-small-button"
                          disabled={acting}
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
                <article className="production-mobile-card" key={record.id}>
                  <header>
                    <span>{record.code}</span>
                    <strong>{record.name}</strong>
                  </header>
                  <p>{record.productName}</p>
                  <dl>
                    <dt>نسخه فعال</dt>
                    <dd>{record.activeVersionNumber ?? 'ندارد'}</dd>
                    <dt>خروجی پایه</dt>
                    <dd>{record.outputQuantity ?? '—'}</dd>
                  </dl>
                  <button
                    className="button secondary"
                    onClick={() => void loadDetail(record.id)}
                    type="button"
                  >
                    <Eye aria-hidden /> مشاهده جزئیات
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
