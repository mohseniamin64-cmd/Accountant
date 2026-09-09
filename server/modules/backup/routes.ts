import path from 'node:path';
import {Router} from 'express';
import {z} from 'zod';
import {PERMISSIONS} from '../../../shared/permissions.js';
import {currentUser} from '../../common/auth-context.js';
import {AppError, asyncRoute} from '../../common/errors.js';
import {identifierSchema} from '../../common/values.js';
import {config} from '../../config.js';
import {query, withTransaction} from '../../db/pool.js';
import {writeAudit} from '../../infrastructure/audit.js';
import {
  requireAuthentication,
  requirePermissions,
} from '../auth/middleware.js';
import {runBackup, verifyBackup} from './service.js';

export const backupRouter = Router();
backupRouter.use(
  requireAuthentication,
  requirePermissions(PERMISSIONS.BACKUP_MANAGE),
);

backupRouter.get(
  '/configuration',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const [settings, googleDrive] = await Promise.all([
      query<{setting_key: string; setting_value: unknown}>(
        `
          SELECT setting_key, setting_value
          FROM app_settings
          WHERE company_id = $1
            AND scope_type = 'company'
            AND scope_id = $1
            AND setting_key = ANY($2::text[])
        `,
        [
          actor.companyId,
          ['backup.external_drive', 'backup.policy'],
        ],
      ),
      query(
        `
          SELECT
            is_enabled AS "isEnabled",
            last_health_status AS "lastHealthStatus",
            last_health_at AS "lastHealthAt"
          FROM connector_states
          WHERE company_id = $1 AND connector_type = 'google_drive'
        `,
        [actor.companyId],
      ),
    ]);
    const values = new Map(
      settings.rows.map((row) => [row.setting_key, row.setting_value]),
    );
    response.json({
      data: {
        localDirectory: config.backupsDir,
        encryptionConfigured: Boolean(config.backupEncryptionKey),
        externalDrive: values.get('backup.external_drive') ?? {path: null},
        policy: values.get('backup.policy') ?? {
          scheduled: false,
          scheduleTime: '18:00',
          endOfDay: true,
          onDriveConnected: true,
          onServerShutdown: false,
        },
        googleDrive: googleDrive.rows[0] ?? {
          isEnabled: false,
          lastHealthStatus: 'not_configured',
          lastHealthAt: null,
        },
      },
    });
  }),
);

backupRouter.put(
  '/configuration',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        externalDrivePath: z.string().trim().max(1000).nullable(),
        scheduled: z.boolean(),
        scheduleTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        onServerShutdown: z.boolean(),
        endOfDay: z.boolean(),
        onDriveConnected: z.boolean(),
      })
      .parse(request.body);
    if (input.externalDrivePath) {
      const resolved = path.resolve(input.externalDrivePath);
      if (
        !path.isAbsolute(input.externalDrivePath) ||
        resolved === path.parse(resolved).root
      ) {
        throw new AppError(
          422,
          'UNSAFE_BACKUP_PATH',
          '\u0645\u0633\u06cc\u0631 \u062d\u0627\u0641\u0638\u0647 \u062e\u0627\u0631\u062c\u06cc \u0645\u0639\u062a\u0628\u0631 \u06cc\u0627 \u0627\u06cc\u0645\u0646 \u0646\u06cc\u0633\u062a.',
        );
      }
    }
    await withTransaction(async (client) => {
      const entries = [
        [
          'backup.external_drive',
          {path: input.externalDrivePath},
        ],
        [
          'backup.policy',
          {
            scheduled: input.scheduled,
            scheduleTime: input.scheduleTime,
            endOfDay: input.endOfDay,
            onDriveConnected: input.onDriveConnected,
            onServerShutdown: input.onServerShutdown,
          },
        ],
      ] as const;
      for (const [key, value] of entries) {
        await client.query(
          `
            INSERT INTO app_settings (
              company_id,
              scope_type,
              scope_id,
              setting_key,
              setting_value,
              updated_by
            )
            VALUES ($1, 'company', $1, $2, $3, $4)
            ON CONFLICT (company_id, scope_type, scope_id, setting_key)
            DO UPDATE SET
              setting_value = EXCLUDED.setting_value,
              updated_by = EXCLUDED.updated_by,
              row_version = app_settings.row_version + 1
          `,
          [actor.companyId, key, JSON.stringify(value), actor.id],
        );
      }
      await writeAudit(client, request, {
        action: 'backup.configuration_update',
        entityType: 'app_setting',
        entityId: actor.companyId,
        after: {
          ...input,
          externalDrivePathConfigured: Boolean(input.externalDrivePath),
        },
      });
    });
    response.status(204).end();
  }),
);

backupRouter.get(
  '/runs',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(30),
      })
      .parse(request.query);
    const result = await query(
      `
        SELECT
          id,
          backup_type AS "backupType",
          trigger_type AS "triggerType",
          status,
          storage_path AS "storagePath",
          byte_size::text AS "byteSize",
          sha256,
          encrypted,
          started_at AS "startedAt",
          completed_at AS "completedAt",
          error_message AS "errorMessage",
          metadata
        FROM backup_runs
        WHERE company_id = $1
        ORDER BY started_at DESC
        LIMIT $2
      `,
      [actor.companyId, input.limit],
    );
    response.json({data: result.rows});
  }),
);

backupRouter.post(
  '/runs',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        backupType: z.enum([
          'local',
          'external_drive',
          'google_drive',
        ]),
      })
      .parse(request.body);
    if (input.backupType === 'google_drive') {
      throw new AppError(
        409,
        'GOOGLE_DRIVE_NOT_CONNECTED',
        '\u0627\u062a\u0635\u0627\u0644 Google Drive \u0647\u0646\u0648\u0632 \u0641\u0639\u0627\u0644 \u0648 \u0627\u062d\u0631\u0627\u0632 \u0647\u0648\u06cc\u062a \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.',
      );
    }
    const result = await runBackup({
      companyId: actor.companyId,
      userId: actor.id,
      backupType: input.backupType,
      triggerType: 'manual',
    });
    await withTransaction(async (client) => {
      await writeAudit(client, request, {
        action: 'backup.run',
        entityType: 'backup_run',
        entityId: result.id,
        after: {
          backupType: input.backupType,
          byteSize: result.byteSize,
          sha256: result.sha256,
        },
      });
    });
    response.status(201).json({data: result});
  }),
);

backupRouter.post(
  '/runs/:id/verify',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const backupRunId = identifierSchema.parse(request.params.id);
    const result = await verifyBackup({
      companyId: actor.companyId,
      backupRunId,
      userId: actor.id,
    });
    await withTransaction(async (client) => {
      await writeAudit(client, request, {
        action: 'backup.verify',
        entityType: 'backup_run',
        entityId: backupRunId,
        after: result,
      });
    });
    response.status(201).json({data: result});
  }),
);
