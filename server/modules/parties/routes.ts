import {Router} from 'express';
import {z} from 'zod';
import {PERMISSIONS} from '../../../shared/permissions.js';
import {currentUser} from '../../common/auth-context.js';
import {AppError, asyncRoute} from '../../common/errors.js';
import {
  activeFilter,
  listQuerySchema,
} from '../../common/pagination.js';
import {
  identifierSchema,
  nonNegativeIrrSchema,
} from '../../common/values.js';
import {query, withTransaction} from '../../db/pool.js';
import {writeAudit} from '../../infrastructure/audit.js';
import {
  requireAuthentication,
  requirePermissions,
} from '../auth/middleware.js';

const partyFieldsSchema = z.object({
    code: z.string().trim().min(1).max(40),
    displayName: z.string().trim().min(2).max(200),
    legalName: z.string().trim().max(200).nullable().default(null),
    partyType: z.enum(['person', 'company']).default('person'),
    isCustomer: z.boolean().default(false),
    isSupplier: z.boolean().default(false),
    nationalId: z.string().trim().max(30).nullable().default(null),
    economicCode: z.string().trim().max(30).nullable().default(null),
    registrationNumber: z.string().trim().max(80).nullable().default(null),
    mobile: z.string().trim().max(30).nullable().default(null),
    phone: z.string().trim().max(30).nullable().default(null),
    email: z.string().trim().email().max(180).nullable().default(null),
    address: z.string().trim().max(1500).nullable().default(null),
    postalCode: z.string().trim().max(20).nullable().default(null),
    creditLimitIrr: nonNegativeIrrSchema.default('0'),
    paymentTermsDays: z.number().int().min(0).max(3650).default(0),
});

const partySchema = partyFieldsSchema.refine(
  (value) => value.isCustomer || value.isSupplier,
  {
    message: 'طرف‌حساب باید مشتری، تأمین‌کننده یا هر دو باشد.',
    path: ['isCustomer'],
  },
);

const partyUpdateSchema = partyFieldsSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
    rowVersion: z.number().int().positive(),
  })
  .refine(
    (value) =>
      value.isCustomer !== false ||
      value.isSupplier !== false ||
      value.isCustomer === undefined ||
      value.isSupplier === undefined,
    {
      message: 'طرف‌حساب غیرفعال باید دلیل داشته باشد.',
      path: ['isCustomer'],
    },
  );

export const partiesRouter = Router();
partiesRouter.use(
  requireAuthentication,
  requirePermissions(PERMISSIONS.PARTIES_VIEW),
);

partiesRouter.get(
  '/',
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const input = listQuerySchema.parse(request.query);
    const active = activeFilter(input.active);
    const result = await query(
      `
        SELECT
          id,
          code,
          display_name AS "displayName",
          legal_name AS "legalName",
          party_type AS "partyType",
          is_customer AS "isCustomer",
          is_supplier AS "isSupplier",
          national_id AS "nationalId",
          economic_code AS "economicCode",
          registration_number AS "registrationNumber",
          mobile,
          phone,
          email,
          address,
          postal_code AS "postalCode",
          credit_limit_irr::text AS "creditLimitIrr",
          payment_terms_days AS "paymentTermsDays",
          is_active AS "isActive",
          row_version AS "rowVersion"
        FROM parties
        WHERE company_id = $1
          AND (
            $2 = ''
            OR code ILIKE '%' || $2 || '%'
            OR display_name ILIKE '%' || $2 || '%'
            OR COALESCE(mobile, '') ILIKE '%' || $2 || '%'
          )
          AND ($3::boolean IS NULL OR is_active = $3)
        ORDER BY display_name
        LIMIT $4 OFFSET $5
      `,
      [user.companyId, input.q, active, input.limit, input.offset],
    );
    response.json({data: result.rows});
  }),
);

partiesRouter.post(
  '/',
  requirePermissions(PERMISSIONS.PARTIES_MANAGE),
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const input = partySchema.parse(request.body);
    const created = await withTransaction(async (client) => {
      const result = await client.query(
        `
          INSERT INTO parties (
            company_id,
            code,
            display_name,
            legal_name,
            party_type,
            is_customer,
            is_supplier,
            national_id,
            economic_code,
            registration_number,
            mobile,
            phone,
            email,
            address,
            postal_code,
            credit_limit_irr,
            payment_terms_days
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15, $16, $17
          )
          RETURNING
            id,
            code,
            display_name AS "displayName",
            is_customer AS "isCustomer",
            is_supplier AS "isSupplier",
            mobile,
            is_active AS "isActive",
            row_version AS "rowVersion"
        `,
        [
          user.companyId,
          input.code,
          input.displayName,
          input.legalName,
          input.partyType,
          input.isCustomer,
          input.isSupplier,
          input.nationalId,
          input.economicCode,
          input.registrationNumber,
          input.mobile,
          input.phone,
          input.email,
          input.address,
          input.postalCode,
          input.creditLimitIrr,
          input.paymentTermsDays,
        ],
      );
      const row = result.rows[0];
      await writeAudit(client, request, {
        action: 'party.create',
        entityType: 'party',
        entityId: (row?.id as string | undefined) ?? null,
        after: row,
      });
      return row;
    });
    response.status(201).json({data: created});
  }),
);

partiesRouter.patch(
  '/:id',
  requirePermissions(PERMISSIONS.PARTIES_MANAGE),
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const partyId = identifierSchema.parse(request.params.id);
    const input = partyUpdateSchema.parse(request.body);
    const updated = await withTransaction(async (client) => {
      const beforeResult = await client.query(
        `
          SELECT *
          FROM parties
          WHERE id = $1 AND company_id = $2
          FOR UPDATE
        `,
        [partyId, user.companyId],
      );
      const before = beforeResult.rows[0];
      if (!before) {
        throw new AppError(404, 'PARTY_NOT_FOUND', 'طرف‌حساب پیدا نشد.');
      }

      const nextCustomer = input.isCustomer ?? Boolean(before.is_customer);
      const nextSupplier = input.isSupplier ?? Boolean(before.is_supplier);
      if (!nextCustomer && !nextSupplier) {
        throw new AppError(
          422,
          'PARTY_TYPE_REQUIRED',
          'طرف‌حساب باید مشتری، تأمین‌کننده یا هر دو باشد.',
        );
      }

      const result = await client.query(
        `
          UPDATE parties
          SET
            code = COALESCE($4, code),
            display_name = COALESCE($5, display_name),
            legal_name = CASE WHEN $6::boolean THEN $7 ELSE legal_name END,
            party_type = COALESCE($8, party_type),
            is_customer = $9,
            is_supplier = $10,
            national_id = CASE WHEN $11::boolean THEN $12 ELSE national_id END,
            economic_code = CASE WHEN $13::boolean THEN $14 ELSE economic_code END,
            registration_number = CASE WHEN $15::boolean THEN $16 ELSE registration_number END,
            mobile = CASE WHEN $17::boolean THEN $18 ELSE mobile END,
            phone = CASE WHEN $19::boolean THEN $20 ELSE phone END,
            email = CASE WHEN $21::boolean THEN $22 ELSE email END,
            address = CASE WHEN $23::boolean THEN $24 ELSE address END,
            postal_code = CASE WHEN $25::boolean THEN $26 ELSE postal_code END,
            credit_limit_irr = COALESCE($27, credit_limit_irr),
            payment_terms_days = COALESCE($28, payment_terms_days),
            is_active = COALESCE($29, is_active),
            row_version = row_version + 1
          WHERE id = $1
            AND company_id = $2
            AND row_version = $3
          RETURNING
            id,
            code,
            display_name AS "displayName",
            is_customer AS "isCustomer",
            is_supplier AS "isSupplier",
            mobile,
            is_active AS "isActive",
            row_version AS "rowVersion"
        `,
        [
          partyId,
          user.companyId,
          input.rowVersion,
          input.code ?? null,
          input.displayName ?? null,
          Object.hasOwn(input, 'legalName'),
          input.legalName ?? null,
          input.partyType ?? null,
          nextCustomer,
          nextSupplier,
          Object.hasOwn(input, 'nationalId'),
          input.nationalId ?? null,
          Object.hasOwn(input, 'economicCode'),
          input.economicCode ?? null,
          Object.hasOwn(input, 'registrationNumber'),
          input.registrationNumber ?? null,
          Object.hasOwn(input, 'mobile'),
          input.mobile ?? null,
          Object.hasOwn(input, 'phone'),
          input.phone ?? null,
          Object.hasOwn(input, 'email'),
          input.email ?? null,
          Object.hasOwn(input, 'address'),
          input.address ?? null,
          Object.hasOwn(input, 'postalCode'),
          input.postalCode ?? null,
          input.creditLimitIrr ?? null,
          input.paymentTermsDays ?? null,
          input.isActive ?? null,
        ],
      );
      const row = result.rows[0];
      if (!row) {
        throw new AppError(
          409,
          'CONCURRENT_UPDATE',
          'طرف‌حساب دارای سابقه عملیاتی است و فقط می‌تواند غیرفعال شود.',
        );
      }
      await writeAudit(client, request, {
        action: 'party.update',
        entityType: 'party',
        entityId: partyId,
        before,
        after: row,
      });
      return row;
    });
    response.json({data: updated});
  }),
);
