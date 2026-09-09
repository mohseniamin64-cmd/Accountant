import {describe, expect, it} from 'vitest';
import {
  assertSufficientSaleStock,
  assertUniqueSaleSerials,
  calculateSaleLineAmounts,
  positiveSaleQuantity,
  validateSaleSerialSelection,
} from './sale.helpers.js';

describe('sale helpers', () => {
  it('calculates tax from the configured product rate', () => {
    const result = calculateSaleLineAmounts('2', '1000', '100', '10', 'IRR');
    expect(result.grossIrr).toBe(2000n);
    expect(result.taxIrr).toBe(190n);
    expect(result.totalIrr).toBe(2090n);
  });

  it('converts toman inputs to canonical rial before calculation', () => {
    const result = calculateSaleLineAmounts('1', '100', '0', '10', 'TOMAN');
    expect(result.grossIrr).toBe(1000n);
    expect(result.taxIrr).toBe(100n);
  });

  it('requires exact and unique serial selections', () => {
    expect(() => validateSaleSerialSelection('2', ['A-1', 'A-2'])).not.toThrow();
    expect(() => validateSaleSerialSelection('2', ['A-1'])).toThrow();
    expect(() => assertUniqueSaleSerials([['A-1'], ['A-1']])).toThrow();
  });

  it('checks aggregated stock and ignores service lines', () => {
    const balances = [{
      productId: 'p1',
      warehouseId: 'w1',
      quantity: '3',
      reservedQuantity: '0',
      availableQuantity: '3',
    }];
    expect(() => assertSufficientSaleStock([
      {productId: 'p1', productName: 'P1', productType: 'purchased', warehouseId: 'w1', quantity: '2'},
      {productId: 'p1', productName: 'P1', productType: 'purchased', warehouseId: 'w1', quantity: '1'},
      {productId: 's1', productName: 'S1', productType: 'service', warehouseId: 'w1', quantity: '20'},
    ], balances)).not.toThrow();
    expect(() => assertSufficientSaleStock([
      {productId: 'p1', productName: 'P1', productType: 'purchased', warehouseId: 'w1', quantity: '4'},
    ], balances)).toThrow();
    expect(() => positiveSaleQuantity('0')).toThrow();
  });
});

