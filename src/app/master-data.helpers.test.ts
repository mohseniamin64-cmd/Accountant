import {describe, expect, it} from 'vitest';
import {
  amountInputToIrr,
  amountIrrToInput,
  buildListPath,
  nonNegativeQuantity,
  nullableText,
} from './master-data.helpers.js';

describe('master data helpers', () => {
  it('converts rial and toman inputs without losing the database rial value', () => {
    expect(amountInputToIrr('1250', 'IRR')).toBe('1250');
    expect(amountInputToIrr('125.5', 'TOMAN')).toBe('1255');
    expect(amountIrrToInput('1255', 'TOMAN')).toBe('125.5');
    expect(amountInputToIrr('\u06f1\u066c\u06f2\u06f5\u06f0', 'IRR')).toBe('1250');
    expect(nonNegativeQuantity('\u06f2\u066b\u06f5')).toBe('2.5');
  });

  it('rejects invalid amount and quantity input', () => {
    expect(() => amountInputToIrr('-1', 'IRR')).toThrow();
    expect(() => amountInputToIrr('1.25', 'TOMAN')).toThrow();
    expect(() => nonNegativeQuantity('1.1234567')).toThrow();
  });

  it('normalizes optional text and list queries', () => {
    expect(nullableText('  ')).toBeNull();
    expect(nullableText(' test ')).toBe('test');
    expect(buildListPath('/api/parties', ' amin ', 'all', 30, 30))
      .toBe('/api/parties?q=amin&active=all&offset=30&limit=30');
  });
});
