import {describe, expect, it} from 'vitest';
import {
  availableChequeEvents,
  nextChequeStatus,
} from './cheque.lifecycle.js';

describe('cheque lifecycle', () => {
  it('allows a received cheque to be deposited or cleared directly', () => {
    expect(availableChequeEvents('receivable', 'received')).toEqual([
      'deposit',
      'clear',
    ]);
    expect(nextChequeStatus('receivable', 'received', 'deposit')).toBe(
      'deposited',
    );
    expect(nextChequeStatus('receivable', 'received', 'clear')).toBe(
      'cleared',
    );
  });

  it('allows a deposited cheque to clear or bounce', () => {
    expect(nextChequeStatus('receivable', 'deposited', 'clear')).toBe(
      'cleared',
    );
    expect(nextChequeStatus('receivable', 'deposited', 'bounce')).toBe(
      'bounced',
    );
  });

  it('allows a bounced cheque to be deposited again', () => {
    expect(nextChequeStatus('receivable', 'bounced', 'deposit')).toBe(
      'deposited',
    );
  });

  it('only allows clearing an issued payable cheque', () => {
    expect(availableChequeEvents('payable', 'issued')).toEqual(['clear']);
    expect(nextChequeStatus('payable', 'issued', 'deposit')).toBeNull();
    expect(nextChequeStatus('payable', 'cleared', 'clear')).toBeNull();
  });

  it('does not allow lifecycle events after cancellation', () => {
    expect(availableChequeEvents('receivable', 'cancelled')).toEqual([]);
    expect(
      nextChequeStatus('receivable', 'cancelled', 'deposit'),
    ).toBeNull();
  });
});
