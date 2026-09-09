import {describe, expect, it} from 'vitest';
import {masterDataHelp} from './master-data.help.js';

describe('master data contextual help', () => {
  it('covers all operational master-data sections', () => {
    expect(Object.keys(masterDataHelp)).toEqual([
      'partyForm',
      'productForm',
      'productWarranty',
      'organization',
      'branchForm',
      'warehouseForm',
    ]);
  });

  it('contains complete, non-empty Persian guidance', () => {
    for (const help of Object.values(masterDataHelp)) {
      expect(help.title.trim().length).toBeGreaterThan(0);
      expect(help.intro.trim().length).toBeGreaterThan(0);
      expect(help.items.every((item) => item.trim().length > 0)).toBe(true);
    }
  });
});
