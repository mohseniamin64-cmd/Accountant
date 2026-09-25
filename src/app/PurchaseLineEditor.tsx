import {Trash2} from 'lucide-react';
import type {AmountUnit} from '../../shared/contracts.js';
import {
  calculatePurchaseLineAmounts,
  formatIrrAmount,
} from './purchase.helpers.js';
import type {
  PurchaseDraftLine,
  PurchaseProductOption,
  PurchaseWarehouseOption,
} from './purchase.types.js';

interface PurchaseLineEditorProps {
  amountUnit: AmountUnit;
  index: number;
  line: PurchaseDraftLine;
  products: readonly PurchaseProductOption[];
  warehouses: readonly PurchaseWarehouseOption[];
  canRemove: boolean;
  onChange: (changes: Partial<PurchaseDraftLine>) => void;
  onProductChange: (productId: string) => void;
  onRemove: () => void;
}

function previewTotal(
  line: PurchaseDraftLine,
  amountUnit: AmountUnit,
): bigint {
  try {
    return calculatePurchaseLineAmounts(
      line.quantity,
      line.unitPrice,
      line.discount,
      line.tax,
      amountUnit,
    ).totalIrr;
  } catch {
    return 0n;
  }
}

export function PurchaseLineEditor({
  amountUnit,
  index,
  line,
  products,
  warehouses,
  canRemove,
  onChange,
  onProductChange,
  onRemove,
}: PurchaseLineEditorProps) {
  const product = products.find((item) => item.id === line.productId);
  const serialCount = line.serialText
    .split(/[\n,\u060c;\u061b]+/)
    .map((item) => item.trim())
    .filter(Boolean).length;
  return (
    <>
      <tr className="purchase-line-row">
        <td>{new Intl.NumberFormat('fa-IR').format(index + 1)}</td>
        <td className="purchase-line-code">{product?.code ?? '—'}</td>
        <td>
          <select
            aria-label="کالا یا خدمت"
            onChange={(event) => onProductChange(event.target.value)}
            required
            value={line.productId}
          >
            <option value="">انتخاب کالا</option>
            {products.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </td>
        <td>
          <select
            aria-label="انبار مقصد"
            onChange={(event) => onChange({warehouseId: event.target.value})}
            required
            value={line.warehouseId}
          >
            <option value="">انتخاب انبار</option>
            {warehouses.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </td>
        <td><input aria-label="تعداد یا مقدار" inputMode="decimal" maxLength={24} onChange={(event) => onChange({quantity: event.target.value})} required value={line.quantity} /></td>
        <td className="purchase-line-unit">{product?.unitName ?? '—'}</td>
        <td><input aria-label="قیمت خرید واحد" dir="ltr" inputMode="decimal" maxLength={30} onChange={(event) => onChange({unitPrice: event.target.value})} required value={line.unitPrice} /></td>
        <td><input aria-label="تخفیف ردیف" dir="ltr" inputMode="decimal" maxLength={30} onChange={(event) => onChange({discount: event.target.value})} required value={line.discount} /></td>
        <td><input aria-label="مالیات ردیف" dir="ltr" inputMode="decimal" maxLength={30} onChange={(event) => onChange({tax: event.target.value})} required value={line.tax} /></td>
        <td className="purchase-line-total">{formatIrrAmount(previewTotal(line, amountUnit), amountUnit)}</td>
        <td>
          <button aria-label="حذف ردیف خرید" className="purchase-row-remove" disabled={!canRemove} onClick={onRemove} type="button">
            <Trash2 aria-hidden />
          </button>
        </td>
      </tr>
      <tr className="purchase-line-note-row">
        <td colSpan={11}>
          <label>
            <span>توضیح ردیف</span>
            <input maxLength={1000} onChange={(event) => onChange({description: event.target.value})} value={line.description} />
          </label>
          {product ? <small>رهگیری: {product.trackingType === 'serial' ? 'سریالی' : 'تعدادی'} · نرخ مالیات تعریف‌شده: {new Intl.NumberFormat('fa-IR', {maximumFractionDigits: 2}).format(Number(product.taxRate))}٪</small> : null}
        </td>
      </tr>
      {product?.trackingType === 'serial' ? (
        <tr className="purchase-line-serial-row">
          <td colSpan={11}>
            <label>
              <span>شماره سریال‌ها *</span>
              <textarea maxLength={12000} onChange={(event) => onChange({serialText: event.target.value})} placeholder="هر سریال را در یک خط وارد کنید؛ ویرگول نیز قابل استفاده است." required rows={3} value={line.serialText} />
            </label>
            <small>تعداد سریال واردشده: {new Intl.NumberFormat('fa-IR').format(serialCount)}؛ باید دقیقاً با تعداد این ردیف برابر باشد.</small>
          </td>
        </tr>
      ) : null}
    </>
  );
}
