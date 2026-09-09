import {describe, expect, it} from 'vitest';
import {
  parseAndValidateProductionSerials,
  requiredComponentQuantity,
  validateBomComponents,
  validateProductionStages,
} from './production.helpers.js';

describe('production helpers', () => {
  it('calculates component requirement with BOM output and waste', () => {
    expect(requiredComponentQuantity('2', '10', '2', '5')).toBe('5.5');
  });

  it('rejects duplicate and self-referencing BOM components', () => {
    const component = {
      key: '1',
      productId: 'part-1',
      quantity: '1',
      wastePercent: '0',
      stageCode: 'assembly',
      issueWarehouseId: '',
      notes: '',
    };
    expect(() => validateBomComponents('final', [component])).not.toThrow();
    expect(() => validateBomComponents('part-1', [component])).toThrow();
    expect(() => validateBomComponents('final', [component, {...component, key: '2'}])).toThrow();
  });

  it('requires unique production stage codes', () => {
    expect(() => validateProductionStages([
      {code: 'assembly', title: 'مونتاژ'},
      {code: 'packing', title: 'بسته‌بندی'},
    ])).not.toThrow();
    expect(() => validateProductionStages([
      {code: 'assembly', title: 'مونتاژ'},
      {code: 'assembly', title: 'تکراری'},
    ])).toThrow();
  });

  it('requires one unique serial for every serial-tracked item', () => {
    expect(parseAndValidateProductionSerials('A-1\nA-2', 'serial', '2', 'محصول')).toEqual(['A-1', 'A-2']);
    expect(() => parseAndValidateProductionSerials('A-1', 'serial', '2', 'محصول')).toThrow();
    expect(() => parseAndValidateProductionSerials('A-1\nA-1', 'serial', '2', 'محصول')).toThrow();
  });
});
