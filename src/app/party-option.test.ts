import {describe, expect, it} from 'vitest';
import {partyOptionText, partyRoleText} from './party-option.js';

describe('informational party roles', () => {
  it('describes customer and supplier flags without changing eligibility', () => {
    expect(
      partyRoleText({
        code: 'P-001',
        displayName: 'طرف حساب',
        isCustomer: true,
        isSupplier: true,
      }),
    ).toBe('خریدار و تأمین‌کننده');
  });

  it('keeps the role visible in a trade selector label', () => {
    expect(
      partyOptionText({
        code: 'P-002',
        displayName: 'علی رضایی',
        isCustomer: true,
        isSupplier: false,
      }),
    ).toBe('P-002 — علی رضایی — خریدار');
  });
});
