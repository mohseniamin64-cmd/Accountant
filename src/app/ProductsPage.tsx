import {Edit3, Power, ShieldCheck, Trash2} from 'lucide-react';
import {useCallback, useEffect, useState, type FormEvent} from 'react';
import type {AmountUnit} from '../../shared/contracts.js';
import {api, errorMessage, postJson} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {JalaliDateField} from './JalaliDateField.js';
import {formatJalaliDate, jalaliInputToIso} from './jalali-date.js';
import {masterDataText as text} from './master-data.copy.js';
import {masterDataHelp} from './master-data.help.js';
import {
  amountInputToIrr,
  amountIrrToInput,
  buildListPath,
  nonNegativeQuantity,
  normalizeNumericInput,
  nullableText,
  type ActiveFilter,
} from './master-data.helpers.js';
import {
  ActionFeedback,
  BooleanField,
  DataToolbar,
  MasterDataHeader,
  Pager,
  StatusPill,
} from './MasterDataUi.js';

type ProductType =
  | 'purchased'
  | 'component'
  | 'manufactured'
  | 'semi_finished'
  | 'consumable'
  | 'service';
type TrackingType = 'none' | 'serial' | 'batch';

interface ProductRecord {
  id: string;
  code: string;
  name: string;
  productType: ProductType;
  trackingType: TrackingType;
  baseUnitId: string;
  unitName: string;
  barcode: string | null;
  description: string | null;
  minimumStock: string;
  defaultSalePriceIrr: string;
  defaultPurchasePriceIrr: string;
  taxRate: string;
  isSellable: boolean;
  isPurchasable: boolean;
  isProducible: boolean;
  isActive: boolean;
  canDelete: boolean;
  rowVersion: number;
}

interface UnitRecord {
  id: string;
  code: string;
  name: string;
  decimalPlaces: number;
  isActive: boolean;
}

interface WarrantyPolicy {
  id: string;
  versionNumber: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  durationMonths: number;
  isActive: boolean;
  reason: string;
  createdAt: string;
}

interface ProductsPageProps {
  permissions: readonly string[];
  amountUnit: AmountUnit;
}

const PAGE_SIZE = 30;
const productTypes: ReadonlyArray<{value: ProductType; label: string}> = [
  {value: 'purchased', label: text.purchased},
  {value: 'component', label: text.component},
  {value: 'manufactured', label: text.manufactured},
  {value: 'semi_finished', label: text.semiFinished},
  {value: 'consumable', label: text.consumable},
  {value: 'service', label: text.service},
];
const trackingTypes: ReadonlyArray<{value: TrackingType; label: string}> = [
  {value: 'none', label: text.trackingNone},
  {value: 'serial', label: text.trackingSerial},
  {value: 'batch', label: text.trackingBatch},
];
const message = {
  warrantyAction: '\u06af\u0627\u0631\u0627\u0646\u062a\u06cc',
  newWarranty: '\u0646\u0633\u062e\u0647 \u062c\u062f\u06cc\u062f \u06af\u0627\u0631\u0627\u0646\u062a\u06cc',
  warrantyFor: '\u0633\u06cc\u0627\u0633\u062a \u06af\u0627\u0631\u0627\u0646\u062a\u06cc \u0628\u0631\u0627\u06cc',
  close: '\u0628\u0633\u062a\u0646',
  confirmDeactivate: '\u0622\u06cc\u0627 \u0627\u0632 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644\u200c\u0633\u0627\u0632\u06cc \u0627\u06cc\u0646 \u0642\u0644\u0645 \u0645\u0637\u0645\u0626\u0646 \u0647\u0633\u062a\u06cc\u062f\u061f',
  unitIrr: '\u0631\u06cc\u0627\u0644',
  unitToman: '\u062a\u0648\u0645\u0627\u0646',
  from: '\u0627\u0632',
  to: '\u062a\u0627',
  ongoing: '\u0627\u062f\u0627\u0645\u0647\u200c\u062f\u0627\u0631',
} as const;

function typeLabel(value: ProductType): string {
  return productTypes.find((item) => item.value === value)?.label ?? value;
}

function trackingLabel(value: TrackingType): string {
  return trackingTypes.find((item) => item.value === value)?.label ?? value;
}

function formatAmount(value: string, unit: AmountUnit): string {
  const shown = amountIrrToInput(value, unit);
  const [whole = '0', fraction] = shown.split('.');
  const formatted = new Intl.NumberFormat('fa-IR').format(BigInt(whole));
  return (fraction ? formatted + '/' + fraction : formatted) + ' ' +
    (unit === 'IRR' ? message.unitIrr : message.unitToman);
}

function formatPriceInput(value: string): string {
  const normalized = normalizeNumericInput(value).replace(/[^0-9.]/g, '');
  if (!normalized) return '';
  const [wholeValue = '', ...fractionParts] = normalized.split('.');
  const whole = wholeValue.replace(/^0+(?=\d)/, '') || '0';
  const formattedWhole = new Intl.NumberFormat('fa-IR').format(BigInt(whole));
  if (fractionParts.length === 0) return formattedWhole;
  return formattedWhole + '٫' + fractionParts.join('').slice(0, 1);
}

function formatDate(value: string | null): string {
  return value ? formatJalaliDate(value) : message.ongoing;
}

export function ProductsPage({permissions, amountUnit}: ProductsPageProps) {
  const canManage = permissions.includes('inventory.manage');
  const canViewWarranty = permissions.includes('sales.view');
  const canManageWarranty = permissions.includes('system.settings.manage');
  const [records, setRecords] = useState<readonly ProductRecord[]>([]);
  const [units, setUnits] = useState<readonly UnitRecord[]>([]);
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<ActiveFilter>('true');
  const [offset, setOffset] = useState(0);
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [warrantyProduct, setWarrantyProduct] = useState<ProductRecord | null>(null);
  const [warrantyPolicies, setWarrantyPolicies] = useState<readonly WarrantyPolicy[]>([]);
  const [warrantyPending, setWarrantyPending] = useState(false);

  const load = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      setRecords(await api<ProductRecord[]>(
        buildListPath('/api/products', query, active, offset, PAGE_SIZE),
      ));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }, [active, offset, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let activeRequest = true;
    void api<UnitRecord[]>('/api/products/units')
      .then((data) => {
        if (activeRequest) setUnits(data.filter((unit) => unit.isActive));
      })
      .catch((caught: unknown) => {
        if (activeRequest) setError(errorMessage(caught));
      });
    return () => {
      activeRequest = false;
    };
  }, []);

  async function loadWarranty(product: ProductRecord) {
    setWarrantyProduct(product);
    setWarrantyPending(true);
    setError(null);
    try {
      setWarrantyPolicies(
        await api<WarrantyPolicy[]>('/api/products/' + product.id + '/warranty-policies'),
      );
    } catch (caught) {
      setError(errorMessage(caught));
      setWarrantyPolicies([]);
    } finally {
      setWarrantyPending(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
    setError(null);
    setSuccess(null);
  }

  function openEdit(record: ProductRecord) {
    setEditing(record);
    setFormOpen(true);
    setError(null);
    setSuccess(null);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const productType = String(form.get('productType')) as ProductType;
    const trackingType = String(form.get('trackingType')) as TrackingType;
    const isProducible = form.has('isProducible');
    if (productType === 'service' && trackingType !== 'none') {
      setError(text.invalidServiceTracking);
      return;
    }
    if (isProducible && productType !== 'manufactured' && productType !== 'semi_finished') {
      setError(text.invalidProducibleType);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        name: String(form.get('name') ?? '').trim(),
        productType,
        trackingType,
        baseUnitId: String(form.get('baseUnitId') ?? ''),
        barcode: nullableText(form.get('barcode')),
        description: nullableText(form.get('description')),
        minimumStock: nonNegativeQuantity(String(form.get('minimumStock') || '0')),
        defaultSalePriceIrr: amountInputToIrr(
          String(form.get('defaultSalePrice') || '0'),
          amountUnit,
        ),
        defaultPurchasePriceIrr: amountInputToIrr(
          String(form.get('defaultPurchasePrice') || '0'),
          amountUnit,
        ),
        taxRate: Number(form.get('taxRate') || 0),
        isSellable: form.has('isSellable'),
        isPurchasable: form.has('isPurchasable'),
        isProducible,
      };
      if (editing) {
        await postJson(
          '/api/products/' + editing.id,
          {...payload, rowVersion: editing.rowVersion},
          'PATCH',
        );
      } else {
        await postJson('/api/products', payload);
      }
      setFormOpen(false);
      setEditing(null);
      setSuccess(text.productSaved);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(record: ProductRecord) {
    if (saving) return;
    if (record.isActive && !window.confirm(message.confirmDeactivate)) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await postJson(
        '/api/products/' + record.id,
        {isActive: !record.isActive, rowVersion: record.rowVersion},
        'PATCH',
      );
      setSuccess(text.productStatusChanged);
      if (warrantyProduct?.id === record.id) setWarrantyProduct(null);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(record: ProductRecord) {
    if (saving) return;
    if (!window.confirm('آیا از حذف دائمی این قلم بدون سابقه مطمئن هستید؟')) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api<void>('/api/products/' + record.id, {method: 'DELETE'});
      setSuccess(text.productDeleted);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function saveWarranty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!warrantyProduct || saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await postJson('/api/products/' + warrantyProduct.id + '/warranty-policies', {
        effectiveFrom: jalaliInputToIso(String(form.get('effectiveFrom') ?? '')),
        durationMonths: Number(form.get('durationMonths')),
        reason: String(form.get('reason') ?? '').trim(),
      });
      setSuccess(text.warrantySaved);
      event.currentTarget.reset();
      await loadWarranty(warrantyProduct);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = draftQuery.trim();
    if (offset === 0 && query === normalized) void load();
    setOffset(0);
    setQuery(normalized);
  }

  return (
    <section className="content-page product-page">
      <MasterDataHeader
        title={text.productTitle}
        description={text.productDescription}
        help={appHelp.products}
      />
      <DataToolbar
        query={draftQuery}
        active={active}
        pending={pending}
        canCreate={canManage}
        createLabel={text.newProduct}
        onQueryChange={setDraftQuery}
        onActiveChange={(value) => {
          setOffset(0);
          setActive(value);
        }}
        onSearch={submitSearch}
        onCreate={openCreate}
      />
      <ActionFeedback error={error} success={success} />

      {formOpen ? (
        <form className="card master-form" key={editing?.id ?? 'new-product'} onSubmit={(event) => void saveProduct(event)}>
          <div className="section-heading">
            <ContextHelpButton help={masterDataHelp.productForm} />
            <div><p>{text.productDescription}</p><h2>{editing ? text.editProduct : text.newProduct}</h2></div>
          </div>
          <div className="form-grid">
            <label className="field"><span>{text.name} *</span><input name="name" defaultValue={editing?.name ?? ''} required maxLength={200} /></label>
            <label className="field">
              <span>{text.productType} *</span>
              <select name="productType" defaultValue={editing?.productType ?? 'purchased'} required>
                {productTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{text.trackingType} *</span>
              <select name="trackingType" defaultValue={editing?.trackingType ?? 'none'} required>
                {trackingTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{text.baseUnit} *</span>
              <select name="baseUnitId" defaultValue={editing?.baseUnitId ?? units[0]?.id ?? ''} required>
                <option value="" disabled>{text.baseUnit}</option>
                {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.code})</option>)}
              </select>
            </label>
            <label className="field"><span>{text.barcode}</span><input name="barcode" defaultValue={editing?.barcode ?? ''} maxLength={120} /></label>
            <label className="field"><span>{text.minimumStock} *</span><input name="minimumStock" defaultValue={editing?.minimumStock ?? '0'} inputMode="decimal" required /></label>
            <label className="field"><span>{text.salePrice} ({amountUnit === 'IRR' ? message.unitIrr : message.unitToman}) *</span><input name="defaultSalePrice" defaultValue={formatPriceInput(amountIrrToInput(editing?.defaultSalePriceIrr ?? '0', amountUnit))} inputMode="decimal" onInput={(event) => { event.currentTarget.value = formatPriceInput(event.currentTarget.value); }} required /></label>
            <label className="field"><span>{text.purchasePrice} ({amountUnit === 'IRR' ? message.unitIrr : message.unitToman}) *</span><input name="defaultPurchasePrice" defaultValue={formatPriceInput(amountIrrToInput(editing?.defaultPurchasePriceIrr ?? '0', amountUnit))} inputMode="decimal" onInput={(event) => { event.currentTarget.value = formatPriceInput(event.currentTarget.value); }} required /></label>
            <label className="field"><span>{text.taxRate} *</span><input name="taxRate" defaultValue={editing?.taxRate ?? '0'} type="number" min="0" max="100" step="0.01" required /></label>
            <label className="field full"><span>{text.description}</span><textarea name="description" defaultValue={editing?.description ?? ''} maxLength={2000} rows={3} /></label>
          </div>
          <div className="boolean-grid">
            <BooleanField name="isSellable" label={text.sellable} defaultChecked={editing?.isSellable ?? true} />
            <BooleanField name="isPurchasable" label={text.purchasable} defaultChecked={editing?.isPurchasable ?? true} />
            <BooleanField name="isProducible" label={text.producible} defaultChecked={editing?.isProducible ?? false} />
          </div>
          <div className="master-form-actions">
            <button className="button secondary" disabled={saving} onClick={() => setFormOpen(false)} type="button">{text.cancel}</button>
            <button className="button primary" disabled={saving || units.length === 0} type="submit">{saving ? text.saving : text.save}</button>
          </div>
        </form>
      ) : null}

      <div className="table-card">
        {pending ? <div className="empty-state">{text.loading}</div> : records.length === 0 ? (
          <div className="empty-state">{text.noRecords}</div>
        ) : (
          <>
            <div className="table-scroll master-desktop-table">
              <table className="master-table">
                <thead><tr>
                  <th>{text.code}</th><th>{text.name}</th><th>{text.productType}</th>
                  <th>{text.trackingType}</th><th>{text.baseUnit}</th><th>{text.salePrice}</th>
                  <th>{text.status}</th><th>{text.actions}</th>
                </tr></thead>
                <tbody>{records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.code}</td><td>{record.name}</td><td>{typeLabel(record.productType)}</td>
                    <td>{trackingLabel(record.trackingType)}</td><td>{record.unitName}</td>
                    <td>{formatAmount(record.defaultSalePriceIrr, amountUnit)}</td><td><StatusPill active={record.isActive} /></td>
                    <td><ProductActions record={record} saving={saving} canManage={canManage} canViewWarranty={canViewWarranty} onEdit={openEdit} onStatus={changeStatus} onDelete={deleteProduct} onWarranty={loadWarranty} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="master-mobile-list">{records.map((record) => (
              <article className="master-mobile-card" key={record.id}>
                <header><div><small>{record.code}</small><h3>{record.name}</h3></div><StatusPill active={record.isActive} /></header>
                <dl>
                  <dt>{text.productType}</dt><dd>{typeLabel(record.productType)}</dd>
                  <dt>{text.trackingType}</dt><dd>{trackingLabel(record.trackingType)}</dd>
                  <dt>{text.baseUnit}</dt><dd>{record.unitName}</dd>
                  <dt>{text.salePrice}</dt><dd>{formatAmount(record.defaultSalePriceIrr, amountUnit)}</dd>
                </dl>
                <ProductActions record={record} saving={saving} canManage={canManage} canViewWarranty={canViewWarranty} onEdit={openEdit} onStatus={changeStatus} onDelete={deleteProduct} onWarranty={loadWarranty} />
              </article>
            ))}</div>
          </>
        )}
      </div>
      <Pager offset={offset} pageSize={PAGE_SIZE} returned={records.length} pending={pending} onPage={setOffset} />

      {warrantyProduct ? (
        <section className="card warranty-panel">
          <div className="section-heading">
            <ContextHelpButton help={masterDataHelp.productWarranty} />
            <div><p>{message.warrantyFor} {warrantyProduct.name}</p><h2>{text.warrantyHistory}</h2></div>
            <button className="button secondary" onClick={() => setWarrantyProduct(null)} type="button">{message.close}</button>
          </div>
          {canManageWarranty && warrantyProduct.isActive ? (
            <form className="master-form-section" onSubmit={(event) => void saveWarranty(event)}>
              <div className="form-grid">
                <JalaliDateField name="effectiveFrom" label={text.effectiveFrom} required />
                <label className="field"><span>{text.durationMonths} *</span><input name="durationMonths" type="number" min="0" max="120" required /></label>
                <label className="field full"><span>{text.reason} *</span><textarea name="reason" minLength={2} maxLength={1000} rows={2} required /></label>
              </div>
              <div className="master-form-actions"><button className="button primary" disabled={saving} type="submit">{saving ? text.saving : message.newWarranty}</button></div>
            </form>
          ) : null}
          {warrantyPending ? <div className="empty-state">{text.loading}</div> : warrantyPolicies.length === 0 ? (
            <div className="empty-state">{text.noWarranty}</div>
          ) : (
            <div className="warranty-list">{warrantyPolicies.map((policy) => (
              <article className="warranty-item" key={policy.id}>
                <StatusPill active={policy.isActive} />
                <strong>{text.version} {new Intl.NumberFormat('fa-IR').format(policy.versionNumber)}</strong>
                <span>{new Intl.NumberFormat('fa-IR').format(policy.durationMonths)} {text.durationMonths.replace(' (\u0645\u0627\u0647)', '')}</span>
                <span>{message.from} {formatDate(policy.effectiveFrom)} {message.to} {formatDate(policy.effectiveTo)}</span>
                <p>{policy.reason}</p>
              </article>
            ))}</div>
          )}
        </section>
      ) : null}
    </section>
  );
}

function ProductActions({
  record,
  saving,
  canManage,
  canViewWarranty,
  onEdit,
  onStatus,
  onDelete,
  onWarranty,
}: {
  record: ProductRecord;
  saving: boolean;
  canManage: boolean;
  canViewWarranty: boolean;
  onEdit: (record: ProductRecord) => void;
  onStatus: (record: ProductRecord) => Promise<void>;
  onDelete: (record: ProductRecord) => Promise<void>;
  onWarranty: (record: ProductRecord) => Promise<void>;
}) {
  return (
    <div className="master-row-actions">
      {canViewWarranty && record.productType !== 'service' ? (
        <button className="button secondary" disabled={saving} onClick={() => void onWarranty(record)} type="button">
          <ShieldCheck aria-hidden />{message.warrantyAction}
        </button>
      ) : null}
      {canManage ? (
        <>
          <button className="button secondary" disabled={saving} onClick={() => onEdit(record)} type="button"><Edit3 aria-hidden />{text.edit}</button>
          {record.canDelete ? <button className="button secondary" disabled={saving} onClick={() => void onDelete(record)} type="button"><Trash2 aria-hidden />{text.delete}</button> : null}
          <button className="button secondary" disabled={saving} onClick={() => void onStatus(record)} type="button"><Power aria-hidden />{record.isActive ? text.deactivate : text.activate}</button>
        </>
      ) : null}
    </div>
  );
}

