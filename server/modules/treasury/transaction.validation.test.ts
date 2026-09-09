import {describe, expect, it} from 'vitest';
import {
  transactionSchema,
  validateTransactionReversalDate,
} from './routes.js';

const BRANCH_ID = '11111111-1111-4111-8111-111111111111';
const BANK_ID = '22222222-2222-4222-8222-222222222222';
const SALE_ID = '33333333-3333-4333-8333-333333333333';

function validTransaction() {
  return {
    branchId: BRANCH_ID,
    transactionDate: '2026-08-30',
    direction: 'receipt' as const,
    paymentMethod: 'bank' as const,
    cashboxId: null,
    bankAccountId: BANK_ID,
    amountIrr: '1000',
    referenceNumber: null,
    description: 'Customer receipt',
    allocations: [
      {
        documentType: 'sale_invoice' as const,
        documentId: SALE_ID,
        amountIrr: '1000',
      },
    ],
    cheque: null,
  };
}

describe('treasury transaction validation', () => {
  it('accepts a balanced transaction with one allocation', () => {
    expect(transactionSchema.safeParse(validTransaction()).success).toBe(true);
  });

  it('rejects duplicate allocation of the same document', () => {
    const input = validTransaction();
    input.amountIrr = '1500';
    input.allocations.push({
      documentType: 'sale_invoice',
      documentId: SALE_ID,
      amountIrr: '500',
    });

    const result = transactionSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.some(
        (issue) => issue.path.join('.') === 'allocations.1.documentId',
      ),
    ).toBe(true);
  });

  it('rejects a transaction whose allocation sum differs from its amount', () => {
    const input = validTransaction();
    input.amountIrr = '1001';

    const result = transactionSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.some(
        (issue) => issue.path.join('.') === 'allocations',
      ),
    ).toBe(true);
  });

  it('requires a cashbox for a cash transaction', () => {
    const input = {
      ...validTransaction(),
      paymentMethod: 'cash' as const,
      bankAccountId: null,
    };

    const result = transactionSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.some((issue) => issue.path.join('.') === 'cashboxId'),
    ).toBe(true);
  });

  it('accepts a reversal on or after the transaction date', () => {
    expect(() => validateTransactionReversalDate('2026-09-01', '2026-09-01')).not.toThrow();
    expect(() => validateTransactionReversalDate('2026-09-02', '2026-09-01')).not.toThrow();
  });

  it('rejects a reversal before the transaction date', () => {
    expect(() => validateTransactionReversalDate('2026-08-31', '2026-09-01')).toThrow(
      'تاریخ برگشت نمی‌تواند پیش از تاریخ تراکنش اصلی باشد.',
    );
  });
});
