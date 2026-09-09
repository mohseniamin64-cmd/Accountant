import {describe, expect, it} from 'vitest';
import {
  summarizeCheques,
  type SummarizableCheque,
} from './treasury.cheque-summary.js';

function cheque(
  direction: SummarizableCheque['direction'],
  status: string,
  dueDate: string,
  amountIrr: string,
): SummarizableCheque {
  return {direction, status, dueDate, amountIrr};
}

describe('treasury cheque summary', () => {
  it('separates overdue, upcoming, bounced, and payable cheques', () => {
    const result = summarizeCheques(
      [
        cheque('receivable', 'received', '2026-08-29', '100'),
        cheque('receivable', 'deposited', '2026-09-02', '200'),
        cheque('receivable', 'bounced', '2026-08-20', '300'),
        cheque('payable', 'issued', '2026-09-06', '400'),
        cheque('receivable', 'cleared', '2026-08-28', '500'),
        cheque('payable', 'issued', '2026-09-07', '600'),
      ],
      '2026-08-30',
    );

    expect(result.overdueReceivable).toEqual({count: 1, totalIrr: '100'});
    expect(result.dueSoonReceivable).toEqual({count: 1, totalIrr: '200'});
    expect(result.bouncedReceivable).toEqual({count: 1, totalIrr: '300'});
    expect(result.dueSoonPayable).toEqual({count: 1, totalIrr: '400'});
  });

  it('includes today and the seventh day in the upcoming window', () => {
    const result = summarizeCheques(
      [
        cheque('receivable', 'received', '2026-08-30', '10'),
        cheque('receivable', 'received', '2026-09-06', '20'),
      ],
      '2026-08-30',
    );

    expect(result.dueSoonReceivable).toEqual({count: 2, totalIrr: '30'});
  });

  it('returns real zero values when there are no matching cheques', () => {
    const result = summarizeCheques([], '2026-08-30');

    expect(result).toEqual({
      overdueReceivable: {count: 0, totalIrr: '0'},
      dueSoonReceivable: {count: 0, totalIrr: '0'},
      bouncedReceivable: {count: 0, totalIrr: '0'},
      dueSoonPayable: {count: 0, totalIrr: '0'},
    });
  });
});
