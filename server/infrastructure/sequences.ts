import type {PoolClient, QueryResultRow} from 'pg';

interface SequenceRow extends QueryResultRow {
  last_value: string;
}

export async function nextSequence(
  client: PoolClient,
  companyId: string,
  sequenceKey: string,
  sequenceScope = 'global',
): Promise<bigint> {
  const result = await client.query<SequenceRow>(
    `
      INSERT INTO document_sequences (
        company_id,
        sequence_key,
        sequence_scope,
        last_value
      )
      VALUES ($1, $2, $3, 1)
      ON CONFLICT (company_id, sequence_key, sequence_scope)
      DO UPDATE SET
        last_value = document_sequences.last_value + 1,
        updated_at = now()
      RETURNING last_value
    `,
    [companyId, sequenceKey, sequenceScope],
  );

  const value = result.rows[0]?.last_value;
  if (!value) throw new Error('Sequence did not return a value');
  return BigInt(value);
}
