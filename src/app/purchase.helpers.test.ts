import {describe, expect, it} from 'vitest';
import {
  assertUniqueInvoiceSerials,
  calculatePurchaseLineAmounts,
  parseSerialNumbers,
  positivePurchaseQuantity,
  validateSerialNumbers,
} from './purchase.helpers.js';

describe('purchase helpers', () => {
  it('parses serials and rejects duplicates', () => {
    expect(parseSerialNumbers('A-1\nA-2,A-3')).toEqual(['A-1', 'A-2', 'A-3']);
    expect(() => parseSerialNumbers('A-1\nA-1')).toThrow();
    expect(() => assertUniqueInvoiceSerials([['A-1'], ['A-1']])).toThrow();
  });

  it('requires exact serial count for serial-tracked products', () => {
    expect(() => validateSerialNumbers('serial', '2', ['A-1', 'A-2'])).not.toThrow();
    expect(() => validateSerialNumbers('serial', '2', ['A-1'])).toThrow();
    expect(() => validateSerialNumbers('none', '2', ['A-1'])).toThrow();
  });

  it('calculates the purchase line with server-compatible rounding', () => {
    const result = calculatePurchaseLineAmounts('2.5', '1000', '100', '90', 'IRR');
    expect(result.grossIrr).toBe(2500n);
    expect(result.totalIrr).toBe(2490n);
  });

  it('rejects zero quantities and excessive discounts', () => {
    expect(() => positivePurchaseQuantity('0')).toThrow();
    expect(() => calculatePurchaseLineAmounts('1', '100', '101', '0', 'IRR')).toThrow();
  });
});
