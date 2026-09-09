import Decimal from 'decimal.js';
import {AppError} from '../../common/errors.js';

export interface InvoiceLineAmounts {
  grossIrr: bigint;
  discountIrr: bigint;
  taxIrr: bigint;
  netBeforeTaxIrr: bigint;
  totalIrr: bigint;
}

function integerAmount(value: Decimal): bigint {
  return BigInt(value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0));
}

export function calculateInvoiceLine(
  quantity: Decimal.Value,
  unitPriceIrr: bigint,
  discountIrr: bigint,
  taxIrr: bigint,
): InvoiceLineAmounts {
  const qty = new Decimal(quantity);
  if (!qty.isPositive()) {
    throw new AppError(
      422,
      'INVALID_QUANTITY',
      '\u062a\u0639\u062f\u0627\u062f \u06cc\u0627 \u0645\u0642\u062f\u0627\u0631 \u0641\u0627\u06a9\u062a\u0648\u0631 \u0628\u0627\u06cc\u062f \u0628\u06cc\u0634\u062a\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062f.',
    );
  }
  if (unitPriceIrr < 0n || discountIrr < 0n || taxIrr < 0n) {
    throw new AppError(
      422,
      'INVALID_INVOICE_AMOUNT',
      '\u0645\u0628\u0627\u0644\u063a \u0641\u0627\u06a9\u062a\u0648\u0631 \u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u0646\u062f \u0645\u0646\u0641\u06cc \u0628\u0627\u0634\u0646\u062f.',
    );
  }

  const grossIrr = integerAmount(qty.times(unitPriceIrr.toString()));
  if (discountIrr > grossIrr) {
    throw new AppError(
      422,
      'DISCOUNT_EXCEEDS_GROSS',
      '\u062a\u062e\u0641\u06cc\u0641 \u06cc\u06a9 \u0631\u062f\u06cc\u0641 \u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u062f \u0627\u0632 \u0645\u0628\u0644\u063a \u0646\u0627\u062e\u0627\u0644\u0635 \u0622\u0646 \u0628\u06cc\u0634\u062a\u0631 \u0628\u0627\u0634\u062f.',
    );
  }
  const netBeforeTaxIrr = grossIrr - discountIrr;
  return {
    grossIrr,
    discountIrr,
    taxIrr,
    netBeforeTaxIrr,
    totalIrr: netBeforeTaxIrr + taxIrr,
  };
}

export function allocateProportionally(
  amount: bigint,
  bases: readonly bigint[],
): bigint[] {
  if (amount < 0n || bases.some((base) => base < 0n)) {
    throw new Error('Allocation values must be non-negative');
  }
  if (bases.length === 0) return [];
  const totalBase = bases.reduce((sum, base) => sum + base, 0n);
  if (totalBase === 0n) {
    const result = bases.map(() => 0n);
    result[result.length - 1] = amount;
    return result;
  }

  let allocated = 0n;
  return bases.map((base, index) => {
    if (index === bases.length - 1) return amount - allocated;
    const value = (amount * base) / totalBase;
    allocated += value;
    return value;
  });
}

export interface PartialReturnAmountInput {
  originalAmountIrr: bigint;
  originalQuantity: Decimal.Value;
  alreadyReturnedAmountIrr: bigint;
  alreadyReturnedQuantity: Decimal.Value;
  returnQuantity: Decimal.Value;
}

export function calculatePartialReturnAmount(
  input: PartialReturnAmountInput,
): bigint {
  const originalQuantity = new Decimal(input.originalQuantity);
  const returnedQuantity = new Decimal(input.alreadyReturnedQuantity);
  const returnQuantity = new Decimal(input.returnQuantity);
  if (
    !originalQuantity.isPositive() ||
    returnedQuantity.isNegative() ||
    !returnQuantity.isPositive() ||
    returnedQuantity.greaterThan(originalQuantity) ||
    input.originalAmountIrr < 0n ||
    input.alreadyReturnedAmountIrr < 0n ||
    input.alreadyReturnedAmountIrr > input.originalAmountIrr
  ) {
    throw new AppError(
      422,
      'INVALID_RETURN_AMOUNT',
      'اطلاعات مقدار یا مبلغ مرجوعی معتبر نیست.',
    );
  }

  const remainingQuantity = originalQuantity.minus(returnedQuantity);
  if (returnQuantity.greaterThan(remainingQuantity)) {
    throw new AppError(
      422,
      'RETURN_QUANTITY_EXCEEDS_REMAINING',
      'مقدار انتخاب‌شده از مانده قابل مرجوعی بیشتر است.',
    );
  }

  const remainingAmount =
    input.originalAmountIrr - input.alreadyReturnedAmountIrr;
  if (returnQuantity.equals(remainingQuantity)) return remainingAmount;

  const proportional = integerAmount(
    new Decimal(input.originalAmountIrr.toString())
      .times(returnQuantity)
      .div(originalQuantity),
  );
  return proportional > remainingAmount ? remainingAmount : proportional;
}

export interface JournalBalancingAmount {
  debitIrr: bigint;
  creditIrr: bigint;
}

export function calculateJournalBalancingAmount(
  totalDebitIrr: bigint,
  knownCreditIrr: bigint,
): JournalBalancingAmount {
  if (totalDebitIrr < 0n || knownCreditIrr < 0n) {
    throw new Error('Journal balancing values must be non-negative');
  }
  const difference = totalDebitIrr - knownCreditIrr;
  return difference >= 0n
    ? {debitIrr: 0n, creditIrr: difference}
    : {debitIrr: -difference, creditIrr: 0n};
}

export function validateReturnDate(
  returnDate: string,
  invoiceDate: string,
): void {
  if (returnDate < invoiceDate) {
    throw new AppError(
      422,
      'RETURN_DATE_BEFORE_INVOICE',
      'تاریخ مرجوعی نمی‌تواند پیش از تاریخ فاکتور اصلی باشد.',
    );
  }
}
