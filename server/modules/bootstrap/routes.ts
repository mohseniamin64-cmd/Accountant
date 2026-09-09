import {Router} from 'express';
import type {QueryResultRow} from 'pg';
import type {CompanyProfile} from '../../../shared/contracts.js';
import {asyncRoute} from '../../common/errors.js';
import {databaseHealth, query} from '../../db/pool.js';

interface CompanyRow extends QueryResultRow {
  id: string;
  name_fa: string;
  name_en: string | null;
  logo_path: string | null;
  base_currency: 'IRR';
  default_amount_unit: 'IRR' | 'TOMAN';
  timezone: 'Asia/Tehran';
}

function companyProfile(row: CompanyRow): CompanyProfile {
  return {
    id: row.id,
    nameFa: row.name_fa,
    nameEn: row.name_en,
    logoUrl: row.logo_path ? `/api/files/${row.logo_path}` : null,
    baseCurrency: row.base_currency,
    defaultAmountUnit: row.default_amount_unit,
    timezone: row.timezone,
  };
}

export const bootstrapRouter = Router();

bootstrapRouter.get(
  '/bootstrap',
  asyncRoute(async (request, response) => {
    const companyResult = request.auth
      ? await query<CompanyRow>(
          `
            SELECT
              id,
              name_fa,
              name_en,
              logo_path,
              base_currency,
              default_amount_unit,
              timezone
            FROM companies
            WHERE id = $1 AND is_active = true
          `,
          [request.auth.companyId],
        )
      : await query<CompanyRow>(
          `
            SELECT
              id,
              name_fa,
              name_en,
              logo_path,
              base_currency,
              default_amount_unit,
              timezone
            FROM companies
            WHERE is_active = true
            ORDER BY created_at
            LIMIT 1
          `,
        );

    const company = companyResult.rows[0];
    response.json({
      data: {
        setupRequired: !company,
        company: company ? companyProfile(company) : null,
        user: request.auth,
      },
    });
  }),
);

bootstrapRouter.get(
  '/health',
  asyncRoute(async (_request, response) => {
    const database = await databaseHealth();
    response.status(database.ok ? 200 : 503).json({
      data: {
        status: database.ok ? 'ok' : 'degraded',
        database,
        timestamp: new Date().toISOString(),
      },
    });
  }),
);
