import type {PoolClient} from 'pg';
import {describe, expect, it, vi} from 'vitest';
import {loadActiveTradeParty} from './party.service.js';

describe('trade party eligibility', () => {
  it('accepts every active party without requiring customer or supplier flags', async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          code: 'P-001',
          display_name: 'طرف حساب نمونه',
          is_customer: true,
          is_supplier: false,
        },
      ],
    });
    const client = {query} as unknown as PoolClient;

    const party = await loadActiveTradeParty(
      client,
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
    );

    expect(party.display_name).toBe('طرف حساب نمونه');
    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('is_active = true');
    expect(sql).not.toContain('is_customer = true');
    expect(sql).not.toContain('is_supplier = true');
  });

  it('rejects an inactive, missing, or foreign-company party', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({rowCount: 0, rows: []}),
    } as unknown as PoolClient;

    await expect(
      loadActiveTradeParty(
        client,
        '22222222-2222-4222-8222-222222222222',
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: 'INVALID_PARTY',
      message: 'طرف‌حساب انتخاب‌شده فعال یا معتبر نیست.',
    });
  });
});
