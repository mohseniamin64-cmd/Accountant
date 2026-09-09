import {describe, expect, it} from 'vitest';
import {
  allocateProportionally,
  calculateInvoiceLine,
  calculatePartialReturnAmount,
  calculateJournalBalancingAmount,
  validateReturnDate,
} from './invoice.calculations.js';

describe('invoice calculations', () => {
  it('calculates net and tax using integer IRR', () => {
    const result = calculateInvoiceLine('2.5', 1000n, 100n, 90n);
    expect(result.grossIrr).toBe(2500n);
    expect(result.netBeforeTaxIrr).toBe(2400n);
    expect(result.totalIrr).toBe(2490n);
  });

  it('allocates every rial without a rounding remainder', () => {
    expect(allocateProportionally(100n, [1n, 1n, 1n])).toEqual([
      33n,
      33n,
      34n,
    ]);
  });

  it('prorates partial returns and assigns the exact final rial', () => {
    const first = calculatePartialReturnAmount({
      originalAmountIrr: 100n,
      originalQuantity: '3',
      alreadyReturnedAmountIrr: 0n,
      alreadyReturnedQuantity: '0',
      returnQuantity: '1',
    });
    const second = calculatePartialReturnAmount({
      originalAmountIrr: 100n,
      originalQuantity: '3',
      alreadyReturnedAmountIrr: first,
      alreadyReturnedQuantity: '1',
      returnQuantity: '1',
    });
    const final = calculatePartialReturnAmount({
      originalAmountIrr: 100n,
      originalQuantity: '3',
      alreadyReturnedAmountIrr: first + second,
      alreadyReturnedQuantity: '2',
      returnQuantity: '1',
    });

    expect([first, second, final]).toEqual([33n, 33n, 34n]);
    expect(first + second + final).toBe(100n);
  });

  it('rejects a return quantity above the remaining quantity', () => {
    expect(() => calculatePartialReturnAmount({
      originalAmountIrr: 1_000n,
      originalQuantity: '5',
      alreadyReturnedAmountIrr: 400n,
      alreadyReturnedQuantity: '2',
      returnQuantity: '4',
    })).toThrow('مقدار انتخاب‌شده از مانده قابل مرجوعی بیشتر است.');
  });

  it('balances a purchase return when inventory value is lower', () => {
    expect(calculateJournalBalancingAmount(1_000n, 850n)).toEqual({
      debitIrr: 0n,
      creditIrr: 150n,
    });
  });

  it('balances a purchase return when inventory value is higher', () => {
    expect(calculateJournalBalancingAmount(1_000n, 1_120n)).toEqual({
      debitIrr: 120n,
      creditIrr: 0n,
    });
  });

  it('does not add a balancing amount when both sides are equal', () => {
    expect(calculateJournalBalancingAmount(1_000n, 1_000n)).toEqual({
      debitIrr: 0n,
      creditIrr: 0n,
    });
  });


  it('accepts a return on or after the invoice date', () => {
    expect(() => validateReturnDate('2026-09-01', '2026-09-01')).not.toThrow();
    expect(() => validateReturnDate('2026-09-02', '2026-09-01')).not.toThrow();
  });

  it('rejects a return before the invoice date', () => {
    expect(() => validateReturnDate('2026-08-31', '2026-09-01')).toThrow(
      'تاریخ مرجوعی نمی‌تواند پیش از تاریخ فاکتور اصلی باشد.',
    );
  });
});
