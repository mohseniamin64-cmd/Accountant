import {describe, expect, it} from 'vitest';
import {
  buildBalanceSheetReport,
  buildProfitLossReport,
  type StatementSourceRow,
} from './financial-report.calculations.js';

function row(
  accountId: string,
  accountType: StatementSourceRow['accountType'],
  amountIrr: string,
): StatementSourceRow {
  return {
    accountId,
    accountCode: accountId,
    accountName: accountId,
    accountType,
    amountIrr,
  };
}

describe('financial statement calculations', () => {
  it('calculates net profit after revenue returns and expenses', () => {
    const report = buildProfitLossReport(
      [
        row('sales', 'income', '1000'),
        row('sales-return', 'income', '-100'),
        row('cost', 'expense', '300'),
      ],
      '2026-03-21',
      '2027-03-20',
    );

    expect(report.totalIncomeIrr).toBe('900');
    expect(report.totalExpenseIrr).toBe('300');
    expect(report.netProfitIrr).toBe('600');
  });

  it('adds unclosed earnings to equity in the balance sheet', () => {
    const report = buildBalanceSheetReport(
      [
        row('assets', 'asset', '1500'),
        row('liabilities', 'liability', '400'),
        row('capital', 'equity', '500'),
        row('income', 'income', '900'),
        row('expense', 'expense', '300'),
      ],
      '2026-09-01',
    );

    expect(report.unclosedEarningsIrr).toBe('600');
    expect(report.totalEquityIrr).toBe('1100');
    expect(report.liabilitiesAndEquityIrr).toBe('1500');
    expect(report.isBalanced).toBe(true);
  });

  it('reports the exact accounting-equation difference', () => {
    const report = buildBalanceSheetReport(
      [
        row('assets', 'asset', '1000'),
        row('liabilities', 'liability', '300'),
        row('capital', 'equity', '500'),
      ],
      '2026-09-01',
    );

    expect(report.differenceIrr).toBe('200');
    expect(report.isBalanced).toBe(false);
  });
});
