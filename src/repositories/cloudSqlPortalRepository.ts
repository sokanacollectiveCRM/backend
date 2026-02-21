import { NotFoundError } from '../domains/errors';
import { getPool } from '../db/cloudSqlPool';
import { PortalStatus } from '../types';

export interface PortalClientRecord {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  portal_status: PortalStatus | null;
  invited_at: Date | null;
  last_invite_sent_at: Date | null;
  invite_sent_count: number;
  user_id: string | null;
}

export class CloudSqlPortalRepository {
  async getClientById(clientId: string): Promise<PortalClientRecord> {
    const { rows } = await getPool().query<PortalClientRecord>(
      `SELECT
        id,
        email,
        first_name,
        last_name,
        portal_status,
        invited_at,
        last_invite_sent_at,
        COALESCE(invite_sent_count, 0) AS invite_sent_count,
        user_id
      FROM phi_clients
      WHERE id = $1`,
      [clientId]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError(`Client not found: ${clientId}`);
    }
    return row;
  }

  async getClientByAuthUserId(authUserId: string): Promise<PortalClientRecord | null> {
    const { rows } = await getPool().query<PortalClientRecord>(
      `SELECT
        id,
        email,
        first_name,
        last_name,
        portal_status,
        invited_at,
        last_invite_sent_at,
        COALESCE(invite_sent_count, 0) AS invite_sent_count,
        user_id
      FROM phi_clients
      WHERE user_id = $1
      LIMIT 1`,
      [authUserId]
    );
    return rows[0] || null;
  }

  async markInvited(clientId: string, authUserId: string | null): Promise<PortalClientRecord> {
    const { rows } = await getPool().query<PortalClientRecord>(
      `UPDATE phi_clients
       SET
         portal_status = 'invited',
         invited_at = COALESCE(invited_at, NOW()),
         last_invite_sent_at = NOW(),
         invite_sent_count = COALESCE(invite_sent_count, 0) + 1,
         user_id = COALESCE($2, user_id),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING
         id,
         email,
         first_name,
         last_name,
         portal_status,
         invited_at,
         last_invite_sent_at,
         COALESCE(invite_sent_count, 0) AS invite_sent_count,
         user_id`,
      [clientId, authUserId]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError(`Client not found: ${clientId}`);
    }
    return row;
  }

  async disablePortal(clientId: string): Promise<PortalClientRecord> {
    const { rows } = await getPool().query<PortalClientRecord>(
      `UPDATE phi_clients
       SET
         portal_status = 'disabled',
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING
         id,
         email,
         first_name,
         last_name,
         portal_status,
         invited_at,
         last_invite_sent_at,
         COALESCE(invite_sent_count, 0) AS invite_sent_count,
         user_id`,
      [clientId]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError(`Client not found: ${clientId}`);
    }
    return row;
  }

  async hasSignedContract(clientId: string): Promise<boolean> {
    const { rows } = await getPool().query<{ id: string }>(
      `SELECT id
       FROM phi_contracts
       WHERE client_id = $1
         AND status = 'signed'
       ORDER BY inserted_at DESC NULLS LAST
       LIMIT 1`,
      [clientId]
    );
    return rows.length > 0;
  }

  async hasCompletedFirstPayment(clientId: string): Promise<boolean> {
    const { rows } = await getPool().query<{ id: number }>(
      `SELECT id
       FROM payments
       WHERE client_id = $1
       ORDER BY txn_date ASC NULLS LAST, id ASC
       LIMIT 1`,
      [clientId]
    );
    return rows.length > 0;
  }
}
