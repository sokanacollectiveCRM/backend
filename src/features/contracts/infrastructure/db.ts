import { PoolClient, QueryResult, QueryResultRow } from 'pg';

import { getPool } from '../../../db/cloudSqlPool';

export type ContractDbClient = Pick<PoolClient, 'query'>;

export function contractDb(client?: ContractDbClient): ContractDbClient {
  return client ?? getPool();
}

export async function withContractTransaction<T>(
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function queryWithClient<T extends QueryResultRow>(
  client: ContractDbClient | undefined,
  text: string,
  values: readonly unknown[] = []
): Promise<QueryResult<T>> {
  return contractDb(client).query<T>(text, [...values]);
}
