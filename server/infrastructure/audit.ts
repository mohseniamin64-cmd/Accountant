import type {PoolClient} from 'pg';
import type {Request} from 'express';

export interface AuditEvent {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
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
        action,
        entity_type,
        entity_id,
        before_data,
        after_data,
        metadata,
        ip_address,
        user_agent,
        request_id
      )
      VALUES (
        $1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
    `,
    [
      request.auth?.companyId ?? null,
      request.auth?.id ?? null,
      event.action,
      event.entityType,
      event.entityId ?? null,
      event.before ? JSON.stringify(event.before) : null,
      event.after ? JSON.stringify(event.after) : null,
      JSON.stringify(event.metadata ?? {}),
      request.ip,
      request.get('user-agent') ?? '',
      request.requestId,
    ],
  );
}
