import type {PoolClient} from 'pg';
import type {Request} from 'express';

export interface AuditEvent {
  action: string;
  module?: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  outcome?: 'success' | 'failure';
  errorCode?: string | null;
  errorMessage?: string | null;
  reason?: string | null;
  sessionId?: string | null;
  actor?: {
    userId?: string | null;
    fullName?: string | null;
    username?: string | null;
    companyId?: string | null;
  };
}

const SENSITIVE_KEYS = /password|token|secret|authorization|cookie|hash/i;

export function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.test(key) ? '[REDACTED]' : sanitizeAuditValue(item),
    ]),
  );
}

export async function writeAudit(
  client: PoolClient,
  request: Request,
  event: AuditEvent,
): Promise<void> {
  await client.query(
    `
      INSERT INTO audit_logs (
        company_id,
        branch_id,
        user_id,
        user_name_snapshot,
        username_snapshot,
        action,
        module,
        entity_type,
        entity_id,
        before_data,
        after_data,
        metadata,
        outcome,
        error_code,
        error_message,
        reason,
        ip_address,
        user_agent,
        request_id,
        session_id
      )
      VALUES (
        $1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18, $19
      )
    `,
    [
      event.actor?.companyId ?? request.auth?.companyId ?? null,
      event.actor?.userId ?? request.auth?.id ?? null,
      event.actor?.fullName ?? request.auth?.fullName ?? null,
      event.actor?.username ?? request.auth?.username ?? null,
      event.action,
      event.module ?? event.entityType,
      event.entityType,
      event.entityId ?? null,
      event.before === undefined ? null : JSON.stringify(sanitizeAuditValue(event.before)),
      event.after === undefined ? null : JSON.stringify(sanitizeAuditValue(event.after)),
      JSON.stringify(sanitizeAuditValue(event.metadata ?? {})),
      event.outcome ?? 'success',
      event.errorCode ?? null,
      event.errorMessage ?? null,
      event.reason ?? null,
      request.ip,
      request.get('user-agent') ?? '',
      request.requestId,
      event.sessionId ?? request.sessionId,
    ],
  );
}
