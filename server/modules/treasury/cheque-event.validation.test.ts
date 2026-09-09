import {describe, expect, it} from 'vitest';
import {
  chequeEventReversalSchema,
  chequeEventSchema,
} from './routes.js';

const BANK_ID = '22222222-2222-4222-8222-222222222222';

describe('cheque event validation', () => {
  it('accepts clearing with a bank account', () => {
    const result = chequeEventSchema.safeParse({
      eventType: 'clear',
      eventDate: '2026-08-30',
      bankAccountId: BANK_ID,
      notes: null,
    });

    expect(result.success).toBe(true);
  });

  it('requires a bank account for deposit', () => {
    const result = chequeEventSchema.safeParse({
      eventType: 'deposit',
      eventDate: '2026-08-30',
      bankAccountId: null,
      notes: null,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.some(
        (issue) => issue.path.join('.') === 'bankAccountId',
      ),
    ).toBe(true);
  });

  it('requires a reason when a cheque bounces', () => {
    const result = chequeEventSchema.safeParse({
      eventType: 'bounce',
      eventDate: '2026-08-30',
      bankAccountId: null,
      notes: null,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.some((issue) => issue.path.join('.') === 'notes'),
    ).toBe(true);
  });

  it('accepts a bounced cheque with a reason', () => {
    const result = chequeEventSchema.safeParse({
      eventType: 'bounce',
      eventDate: '2026-08-30',
      bankAccountId: null,
      notes: 'Returned by bank',
    });

    expect(result.success).toBe(true);
  });

  it('accepts a valid cheque event reversal', () => {
    const result = chequeEventReversalSchema.safeParse({
      reversalDate: '2026-08-30',
      reason: 'Incorrect bank operation',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a cheque event reversal without a meaningful reason', () => {
    const result = chequeEventReversalSchema.safeParse({
      reversalDate: '2026-08-30',
      reason: 'x',
    });

    expect(result.success).toBe(false);
  });

});
