import type {PoolClient, QueryResultRow} from 'pg';
import {AppError} from '../../common/errors.js';

export interface ActiveTradeParty extends QueryResultRow {
  id: string;
  code: string;
  display_name: string;
  is_customer: boolean;
  is_supplier: boolean;
}

export async function loadActiveTradeParty(
  client: PoolClient,
  companyId: string,
  partyId: string,
): Promise<ActiveTradeParty> {
  const result = await client.query<ActiveTradeParty>(
    `
      SELECT *
      FROM parties
      WHERE id = $1
        AND company_id = $2
        AND is_active = true
    `,
    [partyId, companyId],
  );
  const party = result.rows[0];
  if (!party) {
    throw new AppError(
      422,
      'INVALID_PARTY',
      'طرف‌حساب انتخاب‌شده فعال یا معتبر نیست.',
    );
  }
  return party;
}
