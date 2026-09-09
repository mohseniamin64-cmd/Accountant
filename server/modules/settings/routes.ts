import {createHash, randomUUID} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {Router} from 'express';
import multer from 'multer';
import {z} from 'zod';
import {PERMISSIONS} from '../../../shared/permissions.js';
import {currentUser} from '../../common/auth-context.js';
import {AppError, asyncRoute} from '../../common/errors.js';
import {config} from '../../config.js';
import {query, withTransaction} from '../../db/pool.js';
import {writeAudit} from '../../infrastructure/audit.js';
import {
  requireAuthentication,
  requirePermissions,
} from '../auth/middleware.js';

const companySchema = z.object({
  nameFa: z.string().trim().min(2).max(180).optional(),
  nameEn: z.string().trim().max(180).nullable().optional(),
  registrationNumber: z.string().trim().max(80).nullable().optional(),
  nationalId: z.string().trim().max(30).nullable().optional(),
  economicCode: z.string().trim().max(30).nullable().optional(),
  taxId: z.string().trim().max(80).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(2000).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),
  defaultAmountUnit: z.enum(['IRR', 'TOMAN']).optional(),
  rowVersion: z.number().int().positive(),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 2 * 1024 * 1024, files: 1},
  fileFilter: (_request, file, callback) => {
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (allowed.has(file.mimetype)) callback(null, true);
    else callback(new Error('UNSUPPORTED_LOGO_FORMAT'));
  },
});

export const settingsRouter = Router();
settingsRouter.use(requireAuthentication);

settingsRouter.get(
  '/company',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const result = await query(
      `
        SELECT
          id,
          name_fa AS "nameFa",
          name_en AS "nameEn",
          registration_number AS "registrationNumber",
          national_id AS "nationalId",
          economic_code AS "economicCode",
          tax_id AS "taxId",
          phone,
          address,
          postal_code AS "postalCode",
          logo_path AS "logoPath",
          default_amount_unit AS "defaultAmountUnit",
          timezone,
          row_version AS "rowVersion"
        FROM companies
        WHERE id = $1
      `,
      [actor.companyId],
    );
    response.json({data: result.rows[0]});
  }),
);

settingsRouter.patch(
  '/company',
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = companySchema.parse(request.body);
    const updated = await withTransaction(async (client) => {
      const beforeResult = await client.query(
        'SELECT * FROM companies WHERE id = $1 FOR UPDATE',
        [actor.companyId],
      );
      const before = beforeResult.rows[0];
      const result = await client.query(
        `
          UPDATE companies
          SET
            name_fa = COALESCE($3, name_fa),
            name_en = CASE WHEN $4::boolean THEN $5 ELSE name_en END,
            registration_number = CASE
              WHEN $6::boolean THEN $7 ELSE registration_number
            END,
            national_id = CASE WHEN $8::boolean THEN $9 ELSE national_id END,
            economic_code = CASE
              WHEN $10::boolean THEN $11 ELSE economic_code
            END,
            tax_id = CASE WHEN $12::boolean THEN $13 ELSE tax_id END,
            phone = CASE WHEN $14::boolean THEN $15 ELSE phone END,
            address = CASE WHEN $16::boolean THEN $17 ELSE address END,
            postal_code = CASE
              WHEN $18::boolean THEN $19 ELSE postal_code
            END,
            default_amount_unit = COALESCE($20, default_amount_unit),
            row_version = row_version + 1
          WHERE id = $1 AND row_version = $2
          RETURNING
            id,
            name_fa AS "nameFa",
            name_en AS "nameEn",
            registration_number AS "registrationNumber",
            national_id AS "nationalId",
            economic_code AS "economicCode",
            tax_id AS "taxId",
            phone,
            address,
            postal_code AS "postalCode",
            logo_path AS "logoPath",
            default_amount_unit AS "defaultAmountUnit",
            timezone,
            row_version AS "rowVersion"
        `,
        [
          actor.companyId,
          input.rowVersion,
          input.nameFa ?? null,
          Object.hasOwn(input, 'nameEn'),
          input.nameEn ?? null,
          Object.hasOwn(input, 'registrationNumber'),
          input.registrationNumber ?? null,
          Object.hasOwn(input, 'nationalId'),
          input.nationalId ?? null,
          Object.hasOwn(input, 'economicCode'),
          input.economicCode ?? null,
          Object.hasOwn(input, 'taxId'),
          input.taxId ?? null,
          Object.hasOwn(input, 'phone'),
          input.phone ?? null,
          Object.hasOwn(input, 'address'),
          input.address ?? null,
          Object.hasOwn(input, 'postalCode'),
          input.postalCode ?? null,
          input.defaultAmountUnit ?? null,
        ],
      );
      const row = result.rows[0];
      if (!row) {
        throw new AppError(
          409,
          'CONCURRENT_UPDATE',
          'تنظیم دارای سابقه است و با نسخه فعلی هم‌زمان نیست.',
        );
      }
      await writeAudit(client, request, {
        action: 'company.update',
        entityType: 'company',
        entityId: actor.companyId,
        before,
        after: row,
      });
      return row;
    });
    response.json({data: updated});
  }),
);

settingsRouter.post(
  '/company/logo',
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  upload.single('logo'),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const file = request.file;
    if (!file) {
      throw new AppError(422, 'LOGO_REQUIRED', 'فایل لوگو انتخاب نشده است.');
    }

    const extensionByType: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
    };
    const extension = extensionByType[file.mimetype];
    if (!extension) {
      throw new AppError(
        422,
        'UNSUPPORTED_LOGO_FORMAT',
        'فرمت لوگو باید PNG، JPEG یا WebP باشد.',
      );
    }

    await mkdir(config.uploadsDir, {recursive: true});
    const storedName = `logo-${randomUUID()}${extension}`;
    const storagePath = path.join(config.uploadsDir, storedName);
    await writeFile(storagePath, file.buffer, {flag: 'wx'});
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    await withTransaction(async (client) => {
      await client.query(
        `
          INSERT INTO uploaded_files (
            company_id,
            uploaded_by,
            storage_path,
            original_name,
            mime_type,
            byte_size,
            sha256,
            purpose
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'company_logo')
        `,
        [
          actor.companyId,
          actor.id,
          storedName,
          file.originalname,
          file.mimetype,
          file.size,
          sha256,
        ],
      );
      await client.query(
        `
          UPDATE companies
          SET logo_path = $2, row_version = row_version + 1
          WHERE id = $1
        `,
        [actor.companyId, storedName],
      );
      await writeAudit(client, request, {
        action: 'company.logo.update',
        entityType: 'company',
        entityId: actor.companyId,
        after: {storedName, sha256},
      });
    });

    response.status(201).json({
      data: {logoUrl: '/api/company-logo'},
    });
  }),
);

settingsRouter.get(
  '/connectors',
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const result = await query(
      `
        SELECT
          connector_type AS "connectorType",
          is_enabled AS "isEnabled",
          configuration,
          last_health_status AS "lastHealthStatus",
          last_health_at AS "lastHealthAt",
          row_version AS "rowVersion"
        FROM connector_states
        WHERE company_id = $1
        ORDER BY connector_type
      `,
      [actor.companyId],
    );
    response.json({data: result.rows});
  }),
);

settingsRouter.get(
  '/audit',
  requirePermissions(PERMISSIONS.AUDIT_VIEW),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(request.query);
    const result = await query(
      `
        SELECT
          audit.id::text,
          audit.action,
          audit.entity_type AS "entityType",
          audit.entity_id AS "entityId",
          audit.before_data AS "before",
          audit.after_data AS "after",
          audit.metadata,
          audit.ip_address::text AS "ipAddress",
          audit.request_id AS "requestId",
          audit.created_at AS "createdAt",
          "user".full_name AS "userName"
        FROM audit_logs audit
        LEFT JOIN users "user" ON "user".id = audit.user_id
        WHERE audit.company_id = $1
        ORDER BY audit.created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [actor.companyId, input.limit, input.offset],
    );
    response.json({data: result.rows});
  }),
);

export const companyLogoRouter = Router();
companyLogoRouter.get(
  '/company-logo',
  asyncRoute(async (_request, response) => {
    const result = await query<{
      logo_path: string;
      mime_type: string;
    }>(
      `
        SELECT company.logo_path, file.mime_type
        FROM companies company
        JOIN uploaded_files file ON file.storage_path = company.logo_path
        WHERE company.is_active = true
          AND company.logo_path IS NOT NULL
        ORDER BY company.created_at
        LIMIT 1
      `,
    );
    const logo = result.rows[0];
    if (!logo) {
      throw new AppError(404, 'LOGO_NOT_FOUND', 'فایل لوگو پیدا نشد.');
    }
    response.type(logo.mime_type);
    response.sendFile(path.join(config.uploadsDir, logo.logo_path));
  }),
);
