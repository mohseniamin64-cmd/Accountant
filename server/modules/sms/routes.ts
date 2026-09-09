import {createHash, randomBytes} from 'node:crypto';
import {Router} from 'express';
import {z} from 'zod';
import {PERMISSIONS} from '../../../shared/permissions.js';
import {currentUser} from '../../common/auth-context.js';
import {AppError, asyncRoute} from '../../common/errors.js';
import {identifierSchema} from '../../common/values.js';
import {query, withTransaction} from '../../db/pool.js';
import {writeAudit} from '../../infrastructure/audit.js';
import {
  requireAuthentication,
  requirePermissions,
} from '../auth/middleware.js';

function tokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function gatewayToken(request: Parameters<typeof currentUser>[0]): string {
  const token = request.get('x-sms-gateway-token')?.trim() ?? '';
  if (token.length < 32 || token.length > 200) {
    throw new AppError(
      401,
      'INVALID_SMS_GATEWAY_TOKEN',
      '\u062a\u0648\u06a9\u0646 \u062f\u0631\u06af\u0627\u0647 \u067e\u06cc\u0627\u0645\u06a9 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.',
    );
  }
  return token;
}

async function gatewayCompany(hash: string): Promise<string> {
  const result = await query<{company_id: string}>(
    `
      SELECT company_id
      FROM connector_states
      WHERE connector_type = 'android_sms'
        AND is_enabled = true
        AND configuration ->> 'tokenHash' = $1
      LIMIT 1
    `,
    [hash],
  );
  const companyId = result.rows[0]?.company_id;
  if (!companyId) {
    throw new AppError(
      401,
      'INVALID_SMS_GATEWAY_TOKEN',
      '\u062a\u0648\u06a9\u0646 \u062f\u0631\u06af\u0627\u0647 \u067e\u06cc\u0627\u0645\u06a9 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.',
    );
  }
  return companyId;
}

export const smsGatewayRouter = Router();

smsGatewayRouter.post(
  '/claim',
  asyncRoute(async (request, response) => {
    const token = gatewayToken(request);
    const companyId = await gatewayCompany(tokenHash(token));
    const input = z
      .object({
        deviceId: z.string().trim().min(2).max(120),
      })
      .parse(request.body);
    const message = await withTransaction(async (client) => {
      const result = await client.query<{
        id: string;
        recipient: string;
        message_text: string;
        message_type: string;
      }>(
        `
          SELECT id, recipient, message_text, message_type
          FROM sms_messages
          WHERE company_id = $1
            AND attempt_count < 5
            AND (
              status = 'queued'
              OR (status = 'failed' AND updated_at < now() - interval '1 minute')
              OR (status = 'sending' AND updated_at < now() - interval '5 minutes')
            )
          ORDER BY queued_at, id
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `,
        [companyId],
      );
      const row = result.rows[0];
      if (!row) return null;
      await client.query(
        `
          UPDATE sms_messages
          SET
            status = 'sending',
            attempt_count = attempt_count + 1,
            last_error = NULL,
            updated_at = now()
          WHERE id = $1
        `,
        [row.id],
      );
      await client.query(
        `
          UPDATE connector_states
          SET
            last_health_status = 'connected',
            last_health_at = now(),
            configuration = configuration || jsonb_build_object(
              'lastDeviceId', $2::text
            )
          WHERE company_id = $1 AND connector_type = 'android_sms'
        `,
        [companyId, input.deviceId],
      );
      return {
        id: row.id,
        recipient: row.recipient,
        messageText: row.message_text,
        messageType: row.message_type,
      };
    });
    response.json({data: message});
  }),
);

smsGatewayRouter.post(
  '/messages/:id/report',
  asyncRoute(async (request, response) => {
    const token = gatewayToken(request);
    const companyId = await gatewayCompany(tokenHash(token));
    const id = identifierSchema.parse(request.params.id);
    const input = z
      .object({
        status: z.enum(['sent', 'delivered', 'failed']),
        providerMessageId: z.string().trim().max(180).nullable().default(null),
        error: z.string().trim().max(2000).nullable().default(null),
      })
      .superRefine((value, context) => {
        if (value.status === 'failed' && !value.error) {
          context.addIssue({
            code: 'custom',
            path: ['error'],
            message: '\u0639\u0644\u062a \u062e\u0637\u0627\u06cc \u0627\u0631\u0633\u0627\u0644 \u0628\u0627\u06cc\u062f \u062b\u0628\u062a \u0634\u0648\u062f.',
          });
        }
      })
      .parse(request.body);
    const result = await query(
      `
        UPDATE sms_messages
        SET
          status = $3,
          provider_message_id = COALESCE($4, provider_message_id),
          last_error = CASE WHEN $3 = 'failed' THEN $5 ELSE NULL END,
          sent_at = CASE
            WHEN $3 IN ('sent', 'delivered') THEN COALESCE(sent_at, now())
            ELSE sent_at
          END,
          delivered_at = CASE
            WHEN $3 = 'delivered' THEN now()
            ELSE delivered_at
          END,
          updated_at = now()
        WHERE id = $1
          AND company_id = $2
          AND status IN ('sending', 'sent')
      `,
      [id, companyId, input.status, input.providerMessageId, input.error],
    );
    if (!result.rowCount) {
      throw new AppError(
        404,
        'SMS_MESSAGE_NOT_FOUND',
        '\u067e\u06cc\u0627\u0645 \u06cc\u0627 \u0648\u0636\u0639\u06cc\u062a \u0642\u0627\u0628\u0644 \u06af\u0632\u0627\u0631\u0634 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.',
      );
    }
    response.status(204).end();
  }),
);

export const smsRouter = Router();
smsRouter.use(
  requireAuthentication,
  requirePermissions(PERMISSIONS.SMS_MANAGE),
);

smsRouter.get(
  '/configuration',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const result = await query(
      `
        SELECT
          is_enabled AS "isEnabled",
          configuration - 'tokenHash' AS configuration,
          last_health_status AS "lastHealthStatus",
          last_health_at AS "lastHealthAt",
          row_version AS "rowVersion"
        FROM connector_states
        WHERE company_id = $1 AND connector_type = 'android_sms'
      `,
      [actor.companyId],
    );
    response.json({
      data: result.rows[0] ?? {
        isEnabled: false,
        configuration: {},
        lastHealthStatus: null,
        lastHealthAt: null,
        rowVersion: 0,
      },
    });
  }),
);

smsRouter.put(
  '/configuration',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        enabled: z.boolean(),
        deviceLabel: z.string().trim().min(2).max(120),
      })
      .parse(request.body);
    const rawToken = input.enabled ? randomBytes(32).toString('base64url') : null;
    const updated = await withTransaction(async (client) => {
      const result = await client.query<{
        id: string;
        row_version: number;
      }>(
        `
          INSERT INTO connector_states (
            company_id,
            connector_type,
            is_enabled,
            configuration,
            updated_by
          )
          VALUES (
            $1,
            'android_sms',
            $2,
            jsonb_build_object(
              'deviceLabel', $3::text,
              'tokenHash', $4::text
            ),
            $5
          )
          ON CONFLICT (company_id, connector_type)
          DO UPDATE SET
            is_enabled = EXCLUDED.is_enabled,
            configuration = CASE
              WHEN EXCLUDED.is_enabled THEN EXCLUDED.configuration
              ELSE connector_states.configuration
                || jsonb_build_object('deviceLabel', $3::text)
            END,
            updated_by = EXCLUDED.updated_by,
            row_version = connector_states.row_version + 1
          RETURNING id, row_version
        `,
        [
          actor.companyId,
          input.enabled,
          input.deviceLabel,
          rawToken ? tokenHash(rawToken) : null,
          actor.id,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error('SMS connector was not updated');
      await writeAudit(client, request, {
        action: input.enabled ? 'sms.enable' : 'sms.disable',
        entityType: 'connector_state',
        entityId: row.id,
        after: {
          enabled: input.enabled,
          deviceLabel: input.deviceLabel,
          tokenRotated: input.enabled,
        },
      });
      return {
        isEnabled: input.enabled,
        deviceLabel: input.deviceLabel,
        gatewayToken: rawToken,
        rowVersion: row.row_version,
      };
    });
    response.json({data: updated});
  }),
);

smsRouter.get(
  '/messages',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        status: z
          .enum([
            'queued',
            'sending',
            'sent',
            'delivered',
            'failed',
            'cancelled',
          ])
          .optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      })
      .parse(request.query);
    const result = await query(
      `
        SELECT
          id,
          recipient,
          message_text AS "messageText",
          message_type AS "messageType",
          status,
          attempt_count AS "attemptCount",
          last_error AS "lastError",
          queued_at AS "queuedAt",
          sent_at AS "sentAt",
          delivered_at AS "deliveredAt"
        FROM sms_messages
        WHERE company_id = $1
          AND ($2::text IS NULL OR status = $2)
        ORDER BY queued_at DESC
        LIMIT $3
      `,
      [actor.companyId, input.status ?? null, input.limit],
    );
    response.json({data: result.rows});
  }),
);
