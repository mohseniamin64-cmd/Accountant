import type {PoolClient} from 'pg';

export interface QueueSmsInput {
  companyId: string;
  recipient: string | null;
  messageText: string;
  messageType: string;
  relatedEntityType?: string | null | undefined;
  relatedEntityId?: string | null | undefined;
}

export async function queueSmsIfEnabled(
  client: PoolClient,
  input: QueueSmsInput,
): Promise<string | null> {
  const recipient = input.recipient?.replace(/[^0-9+]/g, '') ?? '';
  if (!recipient) return null;
  const connector = await client.query(
    `
      SELECT 1
      FROM connector_states
      WHERE company_id = $1
        AND connector_type = 'android_sms'
        AND is_enabled = true
        AND configuration ? 'tokenHash'
    `,
    [input.companyId],
  );
  if (!connector.rowCount) return null;
  const result = await client.query<{id: string}>(
    `
      INSERT INTO sms_messages (
        company_id,
        recipient,
        message_text,
        message_type,
        related_entity_type,
        related_entity_id,
        provider
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'android_local')
      RETURNING id
    `,
    [
      input.companyId,
      recipient,
      input.messageText,
      input.messageType,
      input.relatedEntityType ?? null,
      input.relatedEntityId ?? null,
    ],
  );
  return result.rows[0]?.id ?? null;
}
