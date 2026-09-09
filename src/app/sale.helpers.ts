import Decimal from 'decimal.js';
import type {AmountUnit} from '../../shared/contracts.js';
import {amountInputToIrr, nonNegativeQuantity} from './master-data.helpers.js';
import type {SaleInventoryBalance} from './sale.types.js';

export interface SaleLineAmounts {
  grossIrr: bigint;
  discountIrr: bigint;
  taxIrr: bigint;
  totalIrr: bigint;
}

export interface SaleStockRequest {
  productId: string;
  productName: string;
  productType: string;
  warehouseId: string;
  quantity: string;
}

export function positiveSaleQuantity(value: string): string {
  const quantity = nonNegativeQuantity(value);
  if (!new Decimal(quantity).greaterThan(0)) {
    throw new Error('\u0645\u0642\u062f\u0627\u0631 \u0647\u0631 \u0631\u062f\u06cc\u0641 \u0641\u0631\u0648\u0634 \u0628\u0627\u06cc\u062f \u0628\u06cc\u0634\u062a\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062f.');
  }
  return quantity;
}

export function calculateSaleLineAmounts(
  quantityInput: string,
  unitPriceInput: string,
  discountInput: string,
  taxRateInput: string,
  unit: AmountUnit,
): SaleLineAmounts {
  const quantity = new Decimal(positiveSaleQuantity(quantityInput));
  const unitPriceIrr = BigInt(amountInputToIrr(unitPriceInput, unit));
  const discountIrr = BigInt(amountInputToIrr(discountInput, unit));
  const taxRate = new Decimal(nonNegativeQuantity(taxRateInput));
  if (taxRate.greaterThan(100)) {
    throw new Error('\u0646\u0631\u062e \u0645\u0627\u0644\u06cc\u0627\u062a \u06a9\u0627\u0644\u0627 \u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u062f \u0628\u06cc\u0634\u062a\u0631 \u0627\u0632 \u0635\u062f \u062f\u0631\u0635\u062f \u0628\u0627\u0634\u062f.');
  }
  const grossIrr = BigInt(
    quantity
      .times(unitPriceIrr.toString())
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toFixed(0),
  );
  if (discountIrr > grossIrr) {
    throw new Error('\u062a\u062e\u0641\u06cc\u0641 \u0631\u062f\u06cc\u0641 \u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u062f \u0627\u0632 \u0645\u0628\u0644\u063a \u0646\u0627\u062e\u0627\u0644\u0635 \u0622\u0646 \u0628\u06cc\u0634\u062a\u0631 \u0628\u0627\u0634\u062f.');
  }
  const taxableIrr = grossIrr - discountIrr;
  const taxIrr = BigInt(
    new Decimal(taxableIrr.toString())
      .times(taxRate)
      .div(100)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toFixed(0),
  );
  return {
    grossIrr,
    discountIrr,
    taxIrr,
    totalIrr: taxableIrr + taxIrr,
  };
}

export function validateSaleSerialSelection(
  quantityInput: string,
  serialNumbers: readonly string[],
): void {
  const quantity = new Decimal(positiveSaleQuantity(quantityInput));
  if (!quantity.isInteger() || quantity.toNumber() !== serialNumbers.length) {
    throw new Error('\u062a\u0639\u062f\u0627\u062f \u0633\u0631\u06cc\u0627\u0644\u200c\u0647\u0627\u06cc \u0627\u0646\u062a\u062e\u0627\u0628\u06cc \u0628\u0627\u06cc\u062f \u062f\u0642\u06cc\u0642\u0627\u064b \u0628\u0627 \u062a\u0639\u062f\u0627\u062f \u06a9\u0627\u0644\u0627\u06cc \u0633\u0631\u06cc\u0627\u0644\u06cc \u0628\u0631\u0627\u0628\u0631 \u0628\u0627\u0634\u062f.');
  }
}

export function assertUniqueSaleSerials(
  groups: readonly (readonly string[])[],
): void {
  const all = groups.flat();
  if (new Set(all).size !== all.length) {
    throw new Error('\u06cc\u06a9 \u0633\u0631\u06cc\u0627\u0644 \u062f\u0631 \u0686\u0646\u062f \u0631\u062f\u06cc\u0641 \u0641\u0627\u06a9\u062a\u0648\u0631 \u0641\u0631\u0648\u0634 \u062a\u06a9\u0631\u0627\u0631 \u0634\u062f\u0647 \u0627\u0633\u062a.');
  }
}

export function assertSufficientSaleStock(
  requests: readonly SaleStockRequest[],
  balances: readonly SaleInventoryBalance[],
): void {
  const requestedByStock = new Map<string, {
    productName: string;
    quantity: Decimal;
  }>();
  for (const request of requests) {
    if (request.productType === 'service') continue;
    const key = request.productId + ':' + request.warehouseId;
    const current = requestedByStock.get(key);
    const quantity = new Decimal(positiveSaleQuantity(request.quantity));
    requestedByStock.set(key, {
      productName: request.productName,
      quantity: (current?.quantity ?? new Decimal(0)).plus(quantity),
    });
  }
  for (const [key, request] of requestedByStock) {
    const separator = key.indexOf(':');
    const productId = key.slice(0, separator);
    const warehouseId = key.slice(separator + 1);
    const balance = balances.find(
      (item) =>
        item.productId === productId && item.warehouseId === warehouseId,
    );
    const available = new Decimal(balance?.availableQuantity ?? '0');
    if (request.quantity.greaterThan(available)) {
      throw new Error(
        '\u0645\u0648\u062c\u0648\u062f\u06cc \u0642\u0627\u0628\u0644 \u0641\u0631\u0648\u0634 \u00ab' +
        request.productName +
        '\u00bb \u062f\u0631 \u0627\u0646\u0628\u0627\u0631 \u0627\u0646\u062a\u062e\u0627\u0628\u06cc \u06a9\u0627\u0641\u06cc \u0646\u06cc\u0633\u062a.',
      );
    }
  }
}

