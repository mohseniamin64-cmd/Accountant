import Decimal from 'decimal.js';
import type {AmountUnit} from '../../shared/contracts.js';
import {amountInputToIrr, nonNegativeQuantity} from './master-data.helpers.js';

export interface PurchaseLineAmounts {
  grossIrr: bigint;
  discountIrr: bigint;
  taxIrr: bigint;
  totalIrr: bigint;
}

export function formatIrrAmount(
  value: bigint | string,
  unit: AmountUnit,
): string {
  const irr = typeof value === 'bigint' ? value : BigInt(value || '0');
  if (unit === 'IRR') {
    return new Intl.NumberFormat('fa-IR').format(irr) + ' \u0631\u06cc\u0627\u0644';
  }
  const whole = irr / 10n;
  const fraction = irr % 10n;
  const shown = fraction === 0n
    ? new Intl.NumberFormat('fa-IR').format(whole)
    : new Intl.NumberFormat('fa-IR').format(whole) +
      '\u066b' +
      new Intl.NumberFormat('fa-IR').format(fraction);
  return shown + ' \u062a\u0648\u0645\u0627\u0646';
}

export function positivePurchaseQuantity(value: string): string {
  const quantity = nonNegativeQuantity(value);
  if (!new Decimal(quantity).greaterThan(0)) {
    throw new Error('\u0645\u0642\u062f\u0627\u0631 \u0647\u0631 \u0631\u062f\u06cc\u0641 \u062e\u0631\u06cc\u062f \u0628\u0627\u06cc\u062f \u0628\u06cc\u0634\u062a\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062f.');
  }
  return quantity;
}

export function parseSerialNumbers(value: string): string[] {
  const serials = value
    .split(/[\n,\u060c;\u061b]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (new Set(serials).size !== serials.length) {
    throw new Error('\u0634\u0645\u0627\u0631\u0647 \u0633\u0631\u06cc\u0627\u0644 \u062a\u06a9\u0631\u0627\u0631\u06cc \u062f\u0631 \u06cc\u06a9 \u0631\u062f\u06cc\u0641 \u0645\u062c\u0627\u0632 \u0646\u06cc\u0633\u062a.');
  }
  return serials;
}

export function validateSerialNumbers(
  trackingType: 'none' | 'serial' | 'batch',
  quantityInput: string,
  serials: readonly string[],
): void {
  const quantity = new Decimal(positivePurchaseQuantity(quantityInput));
  if (trackingType === 'serial') {
    if (!quantity.isInteger() || quantity.toNumber() !== serials.length) {
      throw new Error('\u062a\u0639\u062f\u0627\u062f \u0633\u0631\u06cc\u0627\u0644\u200c\u0647\u0627 \u0628\u0627\u06cc\u062f \u062f\u0642\u06cc\u0642\u0627\u064b \u0628\u0627 \u062a\u0639\u062f\u0627\u062f \u06a9\u0627\u0644\u0627\u06cc \u0633\u0631\u06cc\u0627\u0644\u06cc \u0628\u0631\u0627\u0628\u0631 \u0628\u0627\u0634\u062f.');
    }
    return;
  }
  if (serials.length > 0) {
    throw new Error('\u0628\u0631\u0627\u06cc \u06a9\u0627\u0644\u0627\u06cc \u063a\u06cc\u0631\u0633\u0631\u06cc\u0627\u0644\u06cc \u0646\u0628\u0627\u06cc\u062f \u0634\u0645\u0627\u0631\u0647 \u0633\u0631\u06cc\u0627\u0644 \u0648\u0627\u0631\u062f \u0634\u0648\u062f.');
  }
}

export function assertUniqueInvoiceSerials(
  serialGroups: readonly (readonly string[])[],
): void {
  const all = serialGroups.flat();
  if (new Set(all).size !== all.length) {
    throw new Error('\u06cc\u06a9 \u0634\u0645\u0627\u0631\u0647 \u0633\u0631\u06cc\u0627\u0644 \u062f\u0631 \u0686\u0646\u062f \u0631\u062f\u06cc\u0641 \u0641\u0627\u06a9\u062a\u0648\u0631 \u062a\u06a9\u0631\u0627\u0631 \u0634\u062f\u0647 \u0627\u0633\u062a.');
  }
}

export function calculatePurchaseLineAmounts(
  quantityInput: string,
  unitPriceInput: string,
  discountInput: string,
  taxInput: string,
  unit: AmountUnit,
): PurchaseLineAmounts {
  const quantity = positivePurchaseQuantity(quantityInput);
  const unitPriceIrr = BigInt(amountInputToIrr(unitPriceInput, unit));
  const discountIrr = BigInt(amountInputToIrr(discountInput, unit));
  const taxIrr = BigInt(amountInputToIrr(taxInput, unit));
  const grossIrr = BigInt(
    new Decimal(quantity)
      .times(unitPriceIrr.toString())
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toFixed(0),
  );
  if (discountIrr > grossIrr) {
    throw new Error('\u062a\u062e\u0641\u06cc\u0641 \u0631\u062f\u06cc\u0641 \u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u062f \u0627\u0632 \u0645\u0628\u0644\u063a \u0646\u0627\u062e\u0627\u0644\u0635 \u0622\u0646 \u0628\u06cc\u0634\u062a\u0631 \u0628\u0627\u0634\u062f.');
  }
  return {
    grossIrr,
    discountIrr,
    taxIrr,
    totalIrr: grossIrr - discountIrr + taxIrr,
  };
}
