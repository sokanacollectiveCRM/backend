import { getPool } from '../../db/cloudSqlPool';

/**
 * Save QuickBooks customer ID to phi_clients (Cloud SQL).
 * Used when syncing contract payments for Labor Support flow.
 */
export default async function saveQboCustomerIdToPhiClient(
  phiClientId: string,
  qboCustomerId: string
): Promise<void> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    'UPDATE phi_clients SET qbo_customer_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [qboCustomerId, phiClientId]
  );
  if (rowCount === 0) {
    throw new Error(`phi_client not found: ${phiClientId}`);
  }
}
