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
    province: z.string().trim().max(80).nullable().default(null),
    city: z.string().trim().max(120).nullable().default(null),
    creditLimitIrr: nonNegativeIrrSchema.default('0'),
    paymentTermsDays: z.number().int().min(0).max(3650).default(0),
});

async function ensureUniquePartyDisplayName(
  client: Parameters<Parameters<typeof withTransaction>[0]>[0],
  companyId: string,
  displayName: string,
  partyType: 'person' | 'company' = 'person',
  nationalId: string | null = null,
  mobile: string | null = null,
  exceptPartyId?: string,
): Promise<void> {
  const normalizedName = displayName.trim().toLowerCase();
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    'parties:display-name:' + companyId + ':' + normalizedName,
  ]);
  const result = await client.query(
    "SELECT 1 " +
    "FROM parties existing_party " +
    "WHERE existing_party.company_id = $1 " +
    "AND lower(btrim(existing_party.display_name)) = lower(btrim($2)) " +
    "AND ($3 = 'company' OR existing_party.party_type = 'company' OR NOT (existing_party.national_id IS NOT DISTINCT FROM $4 AND existing_party.mobile IS NOT DISTINCT FROM $5)) " +
    "AND ($6::uuid IS NULL OR existing_party.id <> $6) " +
    "LIMIT 1",
    [companyId, displayName, partyType, nationalId, mobile, exceptPartyId ?? null],
  );
  if (result.rowCount) {
    throw new AppError(
      409,
      'DUPLICATE_PARTY_NAME',
      'طرف‌حسابی با این نام و شناسه‌ها از قبل وجود دارد. نام دیگری وارد کنید.',
    );
  }
}
async function nextAutomaticPartyCode(
  client: Parameters<Parameters<typeof withTransaction>[0]>[0],
  companyId: string,
): Promise<string> {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `parties:${companyId}`,
  ]);
  const result = await client.query<{next_number: number}>(
    `
      SELECT (
        COALESCE(MAX((substring(code FROM '^PTY-([0-9]+)$'))::integer), 0) + 1
      )::integer AS next_number
      FROM parties
      WHERE company_id = $1
    `,
    [companyId],
  );
  const number = result.rows[0]?.next_number ?? 1;
  return `PTY-${String(number).padStart(4, '0')}`;
}

const partySchema = partyFieldsSchema.refine(
  (value) => value.isCustomer || value.isSupplier,
  {
    message: 'طرف‌حساب باید مشتری، تأمین‌کننده یا هر دو باشد.',
    path: ['isCustomer'],
  },
);

const partyUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(200).optional(),
  legalName: z.string().trim().max(200).nullable().optional(),
  partyType: z.enum(['person', 'company']).optional(),
  isCustomer: z.boolean().optional(),
  isSupplier: z.boolean().optional(),
  nationalId: z.string().trim().max(30).nullable().optional(),
  economicCode: z.string().trim().max(30).nullable().optional(),
  registrationNumber: z.string().trim().max(80).nullable().optional(),
  mobile: z.string().trim().max(30).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(180).nullable().optional(),
  address: z.string().trim().max(1500).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),
  province: z.string().trim().max(80).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  creditLimitIrr: nonNegativeIrrSchema.optional(),
  paymentTermsDays: z.number().int().min(0).max(3650).optional(),
  isActive: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  deactivationReason: z.string().trim().max(1000).optional(),
  rowVersion: z.number().int().positive(),
});

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
          province,
          city,
          credit_limit_irr::text AS "creditLimitIrr",
          payment_terms_days AS "paymentTermsDays",
          is_active AS "isActive",
          (archived_at IS NOT NULL) AS "isArchived",
          row_version AS "rowVersion"
        FROM parties
        WHERE company_id = $1
          AND (
            $2 = ''
            OR code ILIKE '%' || $2 || '%'
            OR display_name ILIKE '%' || $2 || '%'
            OR COALESCE(mobile, '') ILIKE '%' || $2 || '%'
          )
          AND (
            $3::boolean IS NULL
            OR (is_active = $3 AND archived_at IS NULL)
          )
        ORDER BY display_name
        LIMIT $4 OFFSET $5
      `,
      [user.companyId, input.q, active, input.limit, input.offset],
    );
    response.json({data: result.rows});
  }),
);

partiesRouter.get(
  '/name-availability',
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const displayName = z.string().trim().min(2).max(200).parse(
      request.query.displayName,
    );
    const excludeId = request.query.excludeId
      ? identifierSchema.parse(request.query.excludeId)
      : null;
    const partyType = z.enum(['person', 'company']).optional().default('person').parse(
      request.query.partyType,
    );
    const nationalId = request.query.nationalId ? String(request.query.nationalId).trim() : null;
    const mobile = request.query.mobile ? String(request.query.mobile).trim() : null;
    const result = await query(
      "SELECT 1 " +
      "FROM parties " +
      "WHERE company_id = $1 " +
      "AND lower(btrim(display_name)) = lower(btrim($2)) " +
      "AND ($3 = 'company' OR party_type = 'company' OR NOT (national_id IS NOT DISTINCT FROM $4 AND mobile IS NOT DISTINCT FROM $5)) " +
      "AND ($6::uuid IS NULL OR id <> $6) " +
      "LIMIT 1",
      [user.companyId, displayName, partyType, nationalId, mobile, excludeId],
    );
    response.json({data: {available: !result.rowCount}});
  }),
);
partiesRouter.post(
  '/',
  requirePermissions(PERMISSIONS.PARTIES_MANAGE),
  asyncRoute(async (request, response) => {
    const user = currentUser(request);
    const input = partySchema.parse(request.body);
    const created = await withTransaction(async (client) => {
      await ensureUniquePartyDisplayName(client, user.companyId, input.displayName, input.partyType, input.nationalId, input.mobile);
      const code = await nextAutomaticPartyCode(client, user.companyId);
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
            province,
            city,
            credit_limit_irr,
            payment_terms_days
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
          )
          RETURNING
            id,
            code,
            display_name AS "displayName",
            is_customer AS "isCustomer",
            is_supplier AS "isSupplier",
            mobile,
            is_active AS "isActive",
            (archived_at IS NOT NULL) AS "isArchived",
            row_version AS "rowVersion"
        `,
        [
          user.companyId,
          code,
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
          input.province,
          input.city,
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
    const isMainAdministrator = user.roles.some((role) => role.code === 'administrator');
    const deactivationReason = input.deactivationReason?.trim() ||
      (isMainAdministrator ? 'توسط مدیر اصلی' : null);
    if (input.isActive === false && !isMainAdministrator) {
      if (!deactivationReason) {
        throw new AppError(
          422,
          'DEACTIVATION_REASON_REQUIRED',
          'برای غیرفعال‌سازی طرف‌حساب، دلیل الزامی است.',
        );
      }
      if (deactivationReason.length < 5) {
        throw new AppError(
          422,
          'DEACTIVATION_REASON_TOO_SHORT',
          'دلیل غیرفعال‌سازی باید حداقل ۵ کاراکتر باشد.',
        );
      }
    }
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

      const nextPartyType = input.partyType ?? before.party_type;
      const nextNationalId = Object.hasOwn(input, 'nationalId')
        ? input.nationalId ?? null
        : before.national_id;
      const nextMobile = Object.hasOwn(input, 'mobile')
        ? input.mobile ?? null
        : before.mobile;
      if (
        input.displayName !== undefined
        || input.partyType !== undefined
        || Object.hasOwn(input, 'nationalId')
        || Object.hasOwn(input, 'mobile')
      ) {
        await ensureUniquePartyDisplayName(
          client,
          user.companyId,
          input.displayName ?? before.display_name,
          nextPartyType,
          nextNationalId,
          nextMobile,
          partyId,
        );
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
            province = CASE WHEN $27::boolean THEN $28 ELSE province END,
            city = CASE WHEN $29::boolean THEN $30 ELSE city END,
            credit_limit_irr = COALESCE($31, credit_limit_irr),
            payment_terms_days = COALESCE($32, payment_terms_days),
            is_active = COALESCE($33, is_active),
            archived_at = CASE
              WHEN $34::boolean IS NULL THEN archived_at
              WHEN $34::boolean THEN now()
              ELSE NULL
            END,
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
            (archived_at IS NOT NULL) AS "isArchived",
            row_version AS "rowVersion"
        `,
        [
          partyId,
          user.companyId,
          input.rowVersion,
          null,
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
          Object.hasOwn(input, 'province'),
          input.province ?? null,
          Object.hasOwn(input, 'city'),
          input.city ?? null,
          input.creditLimitIrr ?? null,
          input.paymentTermsDays ?? null,
          input.isActive ?? null,
          input.isArchived ?? null,
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
        action: input.isActive === false
          ? 'party.deactivate'
          : input.isActive === true
            ? 'party.activate'
            : 'party.update',
        entityType: 'party',
        entityId: partyId,
        before,
        after: row,
        ...(input.isActive === false
          ? {metadata: {deactivationReason}}
          : {}),
      });
      return row;
    });
    response.json({data: updated});
  }),
);






