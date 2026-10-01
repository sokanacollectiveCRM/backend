import { getPool } from '../../db/cloudSqlPool';

export default async function saveQboCustomerId(
  internalCustomerId: string,
  qboCustomerId: string
): Promise<void> {
  const { rowCount } = await getPool().query(
    `
    UPDATE public.customers
    SET qbo_customer_id = $1, updated_at = NOW()
    WHERE id = $2::uuid
    `,
    [qboCustomerId, internalCustomerId]
  );
  if (!rowCount) {
    throw new Error(`Cloud SQL customer not found: ${internalCustomerId}`);
  }
}
