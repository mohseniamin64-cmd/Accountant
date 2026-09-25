import {Router} from 'express';
import type {QueryResultRow} from 'pg';
import {z} from 'zod';
import {PERMISSIONS} from '../../../shared/permissions.js';
import {currentUser} from '../../common/auth-context.js';
import {asyncRoute} from '../../common/errors.js';
import {identifierSchema} from '../../common/values.js';
import {query} from '../../db/pool.js';
import {sanitizeAuditValue} from '../../infrastructure/audit.js';
import {requireAuthentication, requirePermissions} from '../auth/middleware.js';
import {describeDevice} from '../auth/session-state.js';

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  userId: identifierSchema.optional(),
  ip: z.string().trim().max(64).optional(),
  action: z.string().trim().max(120).optional(),
  module: z.string().trim().max(80).optional(),
  outcome: z.enum(['success', 'failure']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

interface AuditRow extends QueryResultRow {
  id: string;
  userId: string | null;
  userName: string | null;
  username: string | null;
  action: string;
  module: string;
  entityType: string;
  entityId: string | null;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
  outcome: 'success' | 'failure';
  errorCode: string | null;
  errorMessage: string | null;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  sessionId: string | null;
  createdAt: Date;
  totalCount: string;
}

export const auditRouter = Router();
auditRouter.use(
  requireAuthentication,
  requirePermissions(PERMISSIONS.AUDIT_VIEW),
);

auditRouter.get(
  '/',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = auditQuerySchema.parse(request.query);
    const conditions = ['audit.company_id = $1'];
    const values: unknown[] = [actor.companyId];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      conditions.push(sql.replace('?', '$' + values.length));
    };
    if (input.userId) add('audit.user_id = ?', input.userId);
    if (input.ip) add('audit.ip_address = ?::inet', input.ip);
    if (input.action) add('audit.action ILIKE ?', '%' + input.action + '%');
    if (input.module) add('audit.module = ?', input.module);
    if (input.outcome) add('audit.outcome = ?', input.outcome);
    if (input.from) add('audit.created_at >= ?', input.from);
    if (input.to) add('audit.created_at <= ?', input.to);
    values.push(input.pageSize);
    const limitIndex = values.length;
    values.push((input.page - 1) * input.pageSize);
    const offsetIndex = values.length;

    const result = await query<AuditRow>(
      `
        SELECT
          audit.id::text AS id,
          audit.user_id AS "userId",
          audit.user_name_snapshot AS "userName",
          audit.username_snapshot AS username,
          audit.action,
          audit.module,
          audit.entity_type AS "entityType",
          audit.entity_id AS "entityId",
          audit.before_data AS "beforeData",
          audit.after_data AS "afterData",
          audit.metadata,
          audit.outcome,
          audit.error_code AS "errorCode",
          audit.error_message AS "errorMessage",
          audit.reason,
          audit.ip_address::text AS "ipAddress",
          audit.user_agent AS "userAgent",
          audit.request_id AS "requestId",
          audit.session_id AS "sessionId",
          audit.created_at AS "createdAt",
          count(*) OVER()::text AS "totalCount"
        FROM audit_logs audit
        WHERE ${conditions.join(' AND ')}
        ORDER BY audit.created_at DESC, audit.id DESC
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex}
      `,
      values,
    );
    const total = Number(result.rows[0]?.totalCount ?? 0);
    response.json({
      data: {
        items: result.rows.map(({totalCount: _totalCount, ...row}) => ({
          ...row,
          beforeData: sanitizeAuditValue(row.beforeData),
          afterData: sanitizeAuditValue(row.afterData),
          metadata: sanitizeAuditValue(row.metadata),
          device: describeDevice(row.userAgent),
        })),
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize),
      },
    });
  }),
);
