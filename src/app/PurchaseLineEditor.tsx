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
    <article className="purchase-line-card">
      <header className="purchase-line-heading">
        <span className="purchase-line-index">
          {'\u0631\u062f\u06cc\u0641 '}{new Intl.NumberFormat('fa-IR').format(index + 1)}
        </span>
        <strong>{formatIrrAmount(previewTotal(line, amountUnit), amountUnit)}</strong>
        <button
          aria-label={'\u062d\u0630\u0641 \u0631\u062f\u06cc\u0641 \u062e\u0631\u06cc\u062f'}
          className="button danger purchase-remove-line"
          disabled={!canRemove}
          onClick={onRemove}
          type="button"
        >
          <Trash2 aria-hidden />
          {'\u062d\u0630\u0641 \u0631\u062f\u06cc\u0641'}
        </button>
      </header>

      <div className="purchase-line-grid">
        <label className="field purchase-product-field">
          <span>{'\u06a9\u0627\u0644\u0627 \u06cc\u0627 \u062e\u062f\u0645\u062a *'}</span>
          <select
            onChange={(event) => onProductChange(event.target.value)}
            required
            value={line.productId}
          >
            <option value="">{'\u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u0627\u0644\u0627'}</option>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code}{' \u2014 '}{item.name}
              </option>
            ))}
          </select>
          {product ? (
            <small>
              {'\u0648\u0627\u062d\u062f: '}{product.unitName}
              {' \u00b7 \u0631\u0647\u06af\u06cc\u0631\u06cc: '}
              {product.trackingType === 'serial' ? '\u0633\u0631\u06cc\u0627\u0644\u06cc' : '\u062a\u0639\u062f\u0627\u062f\u06cc'}
              {' \u00b7 \u0646\u0631\u062e \u0645\u0627\u0644\u06cc\u0627\u062a \u062a\u0639\u0631\u06cc\u0641\u200c\u0634\u062f\u0647: '}
              {new Intl.NumberFormat('fa-IR', {maximumFractionDigits: 2})
                .format(Number(product.taxRate))}
              {'\u066a'}
            </small>
          ) : null}
        </label>

        <label className="field">
          <span>{'\u0627\u0646\u0628\u0627\u0631 \u0645\u0642\u0635\u062f *'}</span>
          <select
            onChange={(event) => onChange({warehouseId: event.target.value})}
            required
            value={line.warehouseId}
          >
            <option value="">{'\u0627\u0646\u062a\u062e\u0627\u0628 \u0627\u0646\u0628\u0627\u0631'}</option>
            {warehouses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code}{' \u2014 '}{item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{'\u062a\u0639\u062f\u0627\u062f \u06cc\u0627 \u0645\u0642\u062f\u0627\u0631 *'}</span>
          <input
            inputMode="decimal"
            maxLength={24}
            onChange={(event) => onChange({quantity: event.target.value})}
            required
            value={line.quantity}
          />
        </label>

        <label className="field">
          <span>{'\u0642\u06cc\u0645\u062a \u062e\u0631\u06cc\u062f \u0648\u0627\u062d\u062f ('}{amountUnit === 'IRR' ? '\u0631\u06cc\u0627\u0644' : '\u062a\u0648\u0645\u0627\u0646'}{') *'}</span>
          <input
            dir="ltr"
            inputMode="decimal"
            maxLength={30}
            onChange={(event) => onChange({unitPrice: event.target.value})}
            required
            value={line.unitPrice}
          />
        </label>

        <label className="field">
          <span>{'\u062a\u062e\u0641\u06cc\u0641 \u0631\u062f\u06cc\u0641 ('}{amountUnit === 'IRR' ? '\u0631\u06cc\u0627\u0644' : '\u062a\u0648\u0645\u0627\u0646'}{') *'}</span>
          <input
            dir="ltr"
            inputMode="decimal"
            maxLength={30}
            onChange={(event) => onChange({discount: event.target.value})}
            required
            value={line.discount}
          />
        </label>

        <label className="field">
          <span>{'\u0645\u0627\u0644\u06cc\u0627\u062a \u0631\u062f\u06cc\u0641 ('}{amountUnit === 'IRR' ? '\u0631\u06cc\u0627\u0644' : '\u062a\u0648\u0645\u0627\u0646'}{') *'}</span>
          <input
            dir="ltr"
            inputMode="decimal"
            maxLength={30}
            onChange={(event) => onChange({tax: event.target.value})}
            required
            value={line.tax}
          />
        </label>

        <label className="field purchase-description-field">
          <span>{'\u062a\u0648\u0636\u06cc\u062d \u0631\u062f\u06cc\u0641'}</span>
          <input
            maxLength={1000}
            onChange={(event) => onChange({description: event.target.value})}
            value={line.description}
          />
        </label>

        {product?.trackingType === 'serial' ? (
          <label className="field purchase-serial-field">
            <span>{'\u0634\u0645\u0627\u0631\u0647 \u0633\u0631\u06cc\u0627\u0644\u200c\u0647\u0627 *'}</span>
            <textarea
              maxLength={12000}
              onChange={(event) => onChange({serialText: event.target.value})}
              placeholder={'\u0647\u0631 \u0633\u0631\u06cc\u0627\u0644 \u0631\u0627 \u062f\u0631 \u06cc\u06a9 \u062e\u0637 \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f\u061b \u0648\u06cc\u0631\u06af\u0648\u0644 \u0646\u06cc\u0632 \u0642\u0627\u0628\u0644 \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0627\u0633\u062a.'}
              required
              rows={4}
              value={line.serialText}
            />
            <small>
              {'\u062a\u0639\u062f\u0627\u062f \u0633\u0631\u06cc\u0627\u0644 \u0648\u0627\u0631\u062f\u0634\u062f\u0647: '}
              {new Intl.NumberFormat('fa-IR').format(serialCount)}
              {'\u061b \u0628\u0627\u06cc\u062f \u062f\u0642\u06cc\u0642\u0627\u064b \u0628\u0627 \u062a\u0639\u062f\u0627\u062f \u0627\u06cc\u0646 \u0631\u062f\u06cc\u0641 \u0628\u0631\u0627\u0628\u0631 \u0628\u0627\u0634\u062f.'}
            </small>
          </label>
        ) : null}
      </div>
    </article>
  );
}
