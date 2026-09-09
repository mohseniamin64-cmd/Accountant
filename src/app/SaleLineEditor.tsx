import {Trash2} from 'lucide-react';
import type {AmountUnit} from '../../shared/contracts.js';
import {formatIrrAmount} from './purchase.helpers.js';
import {calculateSaleLineAmounts} from './sale.helpers.js';
import type {
  SaleDraftLine,
  SaleInventoryBalance,
  SaleProductOption,
  SaleWarehouseOption,
} from './sale.types.js';
import {SaleSerialSelector} from './SaleSerialSelector.js';

interface SaleLineEditorProps {
  amountUnit: AmountUnit;
  index: number;
  line: SaleDraftLine;
  products: readonly SaleProductOption[];
  warehouses: readonly SaleWarehouseOption[];
  balances: readonly SaleInventoryBalance[];
  excludedSerials: ReadonlySet<string>;
  canRemove: boolean;
  onChange: (changes: Partial<SaleDraftLine>) => void;
  onProductChange: (productId: string) => void;
  onRemove: () => void;
}

const quantityFormat = new Intl.NumberFormat('fa-IR', {
  maximumFractionDigits: 6,
});

function preview(
  line: SaleDraftLine,
  product: SaleProductOption | undefined,
  amountUnit: AmountUnit,
): {total: bigint; tax: bigint} {
  if (!product) return {total: 0n, tax: 0n};
  try {
    const result = calculateSaleLineAmounts(
      line.quantity,
      line.unitPrice,
      line.discount,
      product.taxRate,
      amountUnit,
    );
    return {total: result.totalIrr, tax: result.taxIrr};
  } catch {
    return {total: 0n, tax: 0n};
  }
}

export function SaleLineEditor({
  amountUnit,
  index,
  line,
  products,
  warehouses,
  balances,
  excludedSerials,
  canRemove,
  onChange,
  onProductChange,
  onRemove,
}: SaleLineEditorProps) {
  const product = products.find((item) => item.id === line.productId);
  const balance = balances.find(
    (item) =>
      item.productId === line.productId &&
      item.warehouseId === line.warehouseId,
  );
  const amounts = preview(line, product, amountUnit);
  const unitLabel = amountUnit === 'IRR' ? '\u0631\u06cc\u0627\u0644' : '\u062a\u0648\u0645\u0627\u0646';

  return (
    <article className="purchase-line-card sale-line-card">
      <header className="purchase-line-heading sale-line-heading">
        <span className="purchase-line-index">
          {'\u0631\u062f\u06cc\u0641 '}
          {new Intl.NumberFormat('fa-IR').format(index + 1)}
        </span>
        <strong>{formatIrrAmount(amounts.total, amountUnit)}</strong>
        {canRemove ? (
          <button
            className="button danger purchase-remove-line"
            onClick={onRemove}
            type="button"
          >
            <Trash2 aria-hidden />{'\u062d\u0630\u0641 \u0631\u062f\u06cc\u0641'}
          </button>
        ) : <span />}
      </header>

      <div className="purchase-line-grid sale-line-grid">
        <label className="field purchase-product-field">
          <span>{'\u06a9\u0627\u0644\u0627 \u06cc\u0627 \u062e\u062f\u0645\u062a *'}</span>
          <select
            onChange={(event) => onProductChange(event.target.value)}
            required
            value={line.productId}
          >
            <option value="">{'\u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u0627\u0644\u0627 \u06cc\u0627 \u062e\u062f\u0645\u062a'}</option>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code}{' \u2014 '}{item.name}
              </option>
            ))}
          </select>
          {product ? (
            <small>
              {product.unitName}
              {' \u2022 '}
              {product.trackingType === 'serial'
                ? '\u0631\u0647\u06af\u06cc\u0631\u06cc \u0633\u0631\u06cc\u0627\u0644\u06cc'
                : '\u0631\u0647\u06af\u06cc\u0631\u06cc \u062a\u0639\u062f\u0627\u062f\u06cc'}
              {' \u2022 \u0646\u0631\u062e \u0645\u0627\u0644\u06cc\u0627\u062a: '}
              {new Intl.NumberFormat('fa-IR', {maximumFractionDigits: 4}).format(Number(product.taxRate))}
              {'\u066a'}
            </small>
          ) : null}
        </label>

        <label className="field">
          <span>{'\u0627\u0646\u0628\u0627\u0631 *'}</span>
          <select
            onChange={(event) => onChange({
              warehouseId: event.target.value,
              selectedSerials: [],
            })}
            required
            value={line.warehouseId}
          >
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code}{' \u2014 '}{warehouse.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{'\u062a\u0639\u062f\u0627\u062f *'}</span>
          <input
            dir="ltr"
            inputMode="decimal"
            maxLength={30}
            onChange={(event) => onChange({quantity: event.target.value})}
            required
            value={line.quantity}
          />
        </label>

        <label className="field">
          <span>{'\u0642\u06cc\u0645\u062a \u0648\u0627\u062d\u062f ('}{unitLabel}{') *'}</span>
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
          <span>{'\u062a\u062e\u0641\u06cc\u0641 \u0631\u062f\u06cc\u0641 ('}{unitLabel}{') *'}</span>
          <input
            dir="ltr"
            inputMode="decimal"
            maxLength={30}
            onChange={(event) => onChange({discount: event.target.value})}
            required
            value={line.discount}
          />
        </label>

        <div className="sale-line-metric">
          <span>{'\u0645\u0627\u0644\u06cc\u0627\u062a \u0645\u062d\u0627\u0633\u0628\u0647\u200c\u0634\u062f\u0647'}</span>
          <strong>{formatIrrAmount(amounts.tax, amountUnit)}</strong>
        </div>

        <div className="sale-line-metric">
          <span>{product?.productType === 'service' ? '\u0646\u0648\u0639 \u0631\u062f\u06cc\u0641' : '\u0645\u0648\u062c\u0648\u062f\u06cc \u0642\u0627\u0628\u0644 \u0641\u0631\u0648\u0634'}</span>
          <strong>
            {product?.productType === 'service'
              ? '\u062e\u062f\u0645\u062a \u2014 \u0628\u062f\u0648\u0646 \u06a9\u0633\u0631 \u0645\u0648\u062c\u0648\u062f\u06cc'
              : quantityFormat.format(Number(balance?.availableQuantity ?? '0'))}
          </strong>
        </div>

        <label className="field purchase-description-field">
          <span>{'\u062a\u0648\u0636\u06cc\u062d \u0631\u062f\u06cc\u0641'}</span>
          <input
            maxLength={1000}
            onChange={(event) => onChange({description: event.target.value})}
            value={line.description}
          />
        </label>

        {product?.trackingType === 'serial' ? (
          <div className="purchase-serial-field">
            <SaleSerialSelector
              excluded={excludedSerials}
              onChange={(selectedSerials) => onChange({selectedSerials})}
              productId={product.id}
              quantity={line.quantity}
              selected={line.selectedSerials}
              warehouseId={line.warehouseId}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

