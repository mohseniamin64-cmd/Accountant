import {describe, expect, it} from 'vitest';
import type {
  AccountingAccountOption,
  JournalDraftLine,
} from './accounting.types.js';
import {
  formatSignedIrr,
  reportTypeText,
  selectedFiscalRange,
  validateAndBuildJournalLines,
} from './accounting.helpers.js';

const accounts: AccountingAccountOption[] = [
  {
    id: 'cash',
    parentId: null,
    code: '1101',
    name: 'صندوق',
    accountLevel: 'subsidiary',
    accountType: 'asset',
    normalBalance: 'debit',
    allowsPosting: true,
    requiresParty: false,
    requiresBranch: false,
  },
  {
    id: 'receivable',
    parentId: null,
    code: '1201',
    name: 'حساب دریافتنی',
    accountLevel: 'subsidiary',
    accountType: 'asset',
    normalBalance: 'debit',
    allowsPosting: true,
    requiresParty: true,
    requiresBranch: false,
  },
];

function line(
  key: string,
  accountId: string,
  debit: string,
  credit: string,
  partyId = '',
): JournalDraftLine {
  return {
    key,
    accountId,
    partyId,
    branchId: '',
    description: '',
    debit,
    credit,
  };
}

describe('accounting helpers', () => {
  it('builds a balanced rial journal', () => {
    const result = validateAndBuildJournalLines(
      [line('1', 'cash', '1000', '0'), line('2', 'cash', '0', '1000')],
      accounts,
      'IRR',
    );
    expect(result[0]?.debitIrr).toBe('1000');
    expect(result[1]?.creditIrr).toBe('1000');
  });

  it('converts toman input to stored rial', () => {
    const result = validateAndBuildJournalLines(
      [line('1', 'cash', '125.5', '0'), line('2', 'cash', '0', '125.5')],
      accounts,
      'TOMAN',
    );
    expect(result[0]?.debitIrr).toBe('1255');
  });

  it('rejects an unbalanced journal', () => {
    expect(() =>
      validateAndBuildJournalLines(
        [line('1', 'cash', '1000', '0'), line('2', 'cash', '0', '900')],
        accounts,
        'IRR',
      ),
    ).toThrow('جمع بدهکار و بستانکار');
  });

  it('requires a party when the account requires one', () => {
    expect(() =>
      validateAndBuildJournalLines(
        [
          line('1', 'receivable', '1000', '0'),
          line('2', 'cash', '0', '1000'),
        ],
        accounts,
        'IRR',
      ),
    ).toThrow('طرف‌حساب');
  });

  it('formats negative balances without losing the selected unit', () => {
    expect(formatSignedIrr('-125', 'TOMAN')).toContain('−۱۲٫۵');
  });

  it('uses the open fiscal year as the report range', () => {
    expect(
      selectedFiscalRange([
        {
          startsOn: '2025-03-21',
          endsOn: '2026-03-20',
          status: 'final_closed',
        },
        {
          startsOn: '2026-03-21',
          endsOn: '2027-03-20',
          status: 'open',
        },
      ]),
    ).toEqual({from: '2026-03-21', to: '2027-03-20'});
  });

  it('uses standard Persian titles for financial statements', () => {
    expect(reportTypeText('profit-loss')).toBe('صورت سود و زیان');
    expect(reportTypeText('balance-sheet')).toBe('ترازنامه');
  });
});
