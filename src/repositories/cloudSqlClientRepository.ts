/**
 * Cloud SQL Client Repository - Single source of truth for client data.
 * All client reads/writes use Cloud SQL (sokana_private). Auth remains in Supabase.
 *
 * Schema: sokana_private — phi_clients + assignments (see docs/CLOUD_SQL_SOKANA_PRIVATE_SCHEMA.md).
 * Column mapping: phi_clients.phone → phone_number in app.
 */

import { Client } from '../entities/Client';
import { User } from '../entities/User';
import { ClientRepository, ClientOperationalRow } from './interface/clientRepository';
import { ROLE } from '../types';
import { getPool } from '../db/cloudSqlPool';

const OPERATIONAL_COLUMNS = `
  id, first_name, last_name, email, phone AS phone_number, status, service_needed,
  portal_status, invited_at, last_invite_sent_at, invite_sent_count,
  requested_at, updated_at
`;

/** Map Cloud SQL clients row (no users join) to Client entity. */
function mapRowToClient(row: Record<string, any>): Client {
  const userId = row.user_id || row.id;
  const user = new User({
    id: userId,
    email: row.email || '',
    firstname: row.first_name || '',
    lastname: row.last_name || '',
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
    updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    role: (row.role as ROLE) || ROLE.CLIENT,
    address: row.address_line1 || row.address,
    city: row.city,
    state: row.state,
    country: row.country,
    zip_code: row.zip_code,
    profile_picture: row.profile_picture,
    account_status: row.account_status,
    phone_number: row.phone ?? row.phone_number,
    service_needed: row.service_needed,
    preferred_contact_method: row.preferred_contact_method,
    preferred_name: row.preferred_name,
    payment_method: row.payment_method,
    pronouns: row.pronouns,
    home_type: row.home_type,
    services_interested: row.services_interested,
    health_notes: row.health_notes,
    service_specifics: row.service_specifics,
    baby_sex: row.baby_sex,
    baby_name: row.baby_name,
    birth_hospital: row.birth_hospital,
    number_of_babies: row.number_of_babies,
    provider_type: row.provider_type,
    pregnancy_number: row.pregnancy_number,
    had_previous_pregnancies: row.had_previous_pregnancies,
    previous_pregnancies_count: row.previous_pregnancies_count,
    living_children_count: row.living_children_count,
    past_pregnancy_experience: row.past_pregnancy_experience,
    service_support_details: row.service_support_details,
    race_ethnicity: row.race_ethnicity,
    primary_language: row.primary_language,
    client_age_range: row.client_age_range,
    insurance: row.insurance,
    relationship_status: row.relationship_status,
    referral_source: row.referral_source,
    referral_name: row.referral_name,
    referral_email: row.referral_email,
  });

  return new Client(
    row.id,
    user,
    row.service_needed ?? null,
    row.requested_at ? new Date(row.requested_at) : new Date(),
    row.updated_at ? new Date(row.updated_at) : new Date(),
    row.status ?? 'lead',
    undefined, // childrenExpected
    row.pronouns ?? undefined,
    row.health_history ?? undefined,
    row.allergies ?? undefined,
    row.due_date ? new Date(row.due_date) : undefined,
    row.birth_hospital ?? undefined,
    row.baby_sex ?? undefined,
    row.annual_income ?? undefined,
    row.service_specifics ?? undefined,
    row.phone_number ?? undefined,
    row.portal_status ?? undefined
  );
}

export class CloudSqlClientRepository implements ClientRepository {
  async findClientsLiteAll(): Promise<Client[]> {
    const { rows } = await getPool().query(
      `SELECT ${OPERATIONAL_COLUMNS} FROM phi_clients ORDER BY updated_at DESC NULLS LAST`
    );
    return rows.map((r: Record<string, any>) => mapRowToClient(r));
  }

  async findClientsDetailedAll(): Promise<Client[]> {
    const { rows } = await getPool().query(
      `SELECT * FROM phi_clients ORDER BY updated_at DESC NULLS LAST`
    );
    return rows.map((r: Record<string, any>) => mapRowToClient(r));
  }

  private async getClientIdsAssignedToDoula(doulaId: string): Promise<string[]> {
    const { rows } = await getPool().query<{ client_id: string }>(
      `SELECT client_id FROM assignments WHERE doula_id = $1 AND status = 'active'`,
      [doulaId]
    );
    return rows.map((r) => r.client_id);
  }

  async findClientsLiteByDoula(userId: string): Promise<Client[]> {
    const clientIds = await this.getClientIdsAssignedToDoula(userId);
    if (clientIds.length === 0) return [];
    const { rows } = await getPool().query(
      `SELECT ${OPERATIONAL_COLUMNS} FROM phi_clients WHERE id = ANY($1::uuid[]) ORDER BY updated_at DESC NULLS LAST`,
      [clientIds]
    );
    return rows.map((r: Record<string, any>) => mapRowToClient(r));
  }

  async findClientsDetailedByDoula(userId: string): Promise<Client[]> {
    const clientIds = await this.getClientIdsAssignedToDoula(userId);
    if (clientIds.length === 0) return [];
    const { rows } = await getPool().query(
      `SELECT * FROM phi_clients WHERE id = ANY($1::uuid[]) ORDER BY updated_at DESC NULLS LAST`,
      [clientIds]
    );
    return rows.map((r: Record<string, any>) => mapRowToClient(r));
  }

  async findClientLiteById(clientId: string): Promise<Client> {
    const { rows } = await getPool().query(
      `SELECT * FROM phi_clients WHERE id = $1`,
      [clientId]
    );
    if (rows.length === 0) {
      throw new Error('No rows returned');
    }
    return mapRowToClient(rows[0]);
  }

  async findClientDetailedById(clientId: string): Promise<Client> {
    return this.findClientLiteById(clientId);
  }

  async findById(clientId: string): Promise<Client | null> {
    try {
      return await this.findClientLiteById(clientId);
    } catch {
      return null;
    }
  }

  async findClientsByStatus(status: string): Promise<Client[]> {
    const { rows } = await getPool().query(
      `SELECT * FROM phi_clients WHERE status = $1 ORDER BY updated_at DESC NULLS LAST`,
      [status]
    );
    return rows.map((r: Record<string, any>) => mapRowToClient(r));
  }

  async updateStatus(clientId: string, status: string): Promise<Client> {
    await getPool().query(
      `UPDATE phi_clients SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [status, clientId]
    );
    const client = await this.findClientLiteById(clientId);
    if (!client) throw new Error('Client not found after update');
    return client;
  }

  async updateClient(clientId: string, fieldsToUpdate: Partial<Client>): Promise<Client> {
    const allowed = new Set([
      'first_name', 'last_name', 'email', 'phone_number', 'status', 'service_needed',
      'portal_status', 'pronouns', 'preferred_name', 'payment_method', 'home_type',
      'services_interested', 'health_notes', 'health_history', 'allergies', 'medications',
      'baby_name', 'baby_sex', 'number_of_babies', 'birth_hospital', 'provider_type',
      'pregnancy_number', 'had_previous_pregnancies', 'previous_pregnancies_count',
      'living_children_count', 'past_pregnancy_experience', 'service_support_details',
      'race_ethnicity', 'primary_language', 'client_age_range', 'insurance', 'annual_income',
      'preferred_contact_method', 'relationship_status', 'referral_source', 'referral_name',
      'referral_email', 'address_line1', 'address_line2', 'city', 'state', 'zip_code',
      'country', 'date_of_birth', 'due_date', 'profile_picture',
    ]);
    const raw = fieldsToUpdate as Record<string, any>;
    const setParts: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (raw.user) {
      if (raw.user.firstname !== undefined) { setParts.push(`first_name = $${i++}`); values.push(raw.user.firstname); }
      if (raw.user.lastname !== undefined) { setParts.push(`last_name = $${i++}`); values.push(raw.user.lastname); }
      if (raw.user.first_name !== undefined) { setParts.push(`first_name = $${i++}`); values.push(raw.user.first_name); }
      if (raw.user.last_name !== undefined) { setParts.push(`last_name = $${i++}`); values.push(raw.user.last_name); }
      if (raw.user.email !== undefined) { setParts.push(`email = $${i++}`); values.push(raw.user.email); }
    }
    for (const [k, v] of Object.entries(raw)) {
      if (k === 'user' || v === undefined) continue;
      const col = k.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
      if (allowed.has(col) || allowed.has(k)) {
        setParts.push(`${col} = $${i++}`);
        values.push(v);
      }
    }
    if (setParts.length === 0) {
      return this.findClientLiteById(clientId);
    }
    setParts.push('updated_at = CURRENT_TIMESTAMP');
    values.push(clientId);
    await getPool().query(
      `UPDATE phi_clients SET ${setParts.join(', ')} WHERE id = $${i}`,
      values
    );
    return this.findClientLiteById(clientId);
  }

  async deleteClient(clientId: string): Promise<void> {
    const result = await getPool().query(
      'DELETE FROM phi_clients WHERE id = $1',
      [clientId]
    );
    if (result.rowCount === 0) {
      throw new Error(`Client not found: ${clientId}`);
    }
  }

  async exportCSV(): Promise<string | null> {
    const { rows } = await getPool().query(
      `SELECT first_name, last_name, annual_income, address_line1 FROM phi_clients`
    );
    if (rows.length === 0) return null;
    const headers = ['first_name', 'last_name', 'annual_income', 'address_line1'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push(headers.map((h) => (r[h] != null ? String(r[h]).replace(/"/g, '""') : '')).map((c) => `"${c}"`).join(','));
    }
    return lines.join('\n');
  }

  // ---- Canonical methods (used by clientController in primary mode) ----

  async getClientById(clientId: string): Promise<ClientOperationalRow | null> {
    const { rows } = await getPool().query<ClientOperationalRow>(
      `SELECT ${OPERATIONAL_COLUMNS} FROM phi_clients WHERE id = $1`,
      [clientId]
    );
    return rows[0] || null;
  }

  async updateClientStatusCanonical(clientId: string, status: string): Promise<ClientOperationalRow | null> {
    await getPool().query(
      `UPDATE phi_clients SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [status, clientId]
    );
    return this.getClientById(clientId);
  }

  async updateClientOperational(
    clientId: string,
    fields: Record<string, any>
  ): Promise<ClientOperationalRow | null> {
    const allowed = new Set([
      'first_name', 'last_name', 'email', 'phone_number', 'status', 'service_needed',
      'portal_status', 'invited_at', 'last_invite_sent_at', 'invite_sent_count',
    ]);
    const setParts: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (!allowed.has(k) || v === undefined) continue;
      const col = k === 'phone_number' ? 'phone' : k;
      setParts.push(`${col} = $${i++}`);
      values.push(v);
    }
    if (setParts.length === 0) return this.getClientById(clientId);
    setParts.push('updated_at = CURRENT_TIMESTAMP');
    values.push(clientId);
    await getPool().query(
      `UPDATE phi_clients SET ${setParts.join(', ')} WHERE id = $${i}`,
      values
    );
    return this.getClientById(clientId);
  }

  async updateIdentityCache(
    clientId: string,
    fields: { first_name?: string; last_name?: string; email?: string; phone_number?: string }
  ): Promise<void> {
    const setParts: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (fields.first_name !== undefined) { setParts.push(`first_name = $${i++}`); values.push(fields.first_name); }
    if (fields.last_name !== undefined) { setParts.push(`last_name = $${i++}`); values.push(fields.last_name); }
    if (fields.email !== undefined) { setParts.push(`email = $${i++}`); values.push(fields.email); }
    if (fields.phone_number !== undefined) { setParts.push(`phone = $${i++}`); values.push(fields.phone_number); }
    if (setParts.length === 0) return;
    setParts.push('updated_at = CURRENT_TIMESTAMP');
    values.push(clientId);
    await getPool().query(
      `UPDATE phi_clients SET ${setParts.join(', ')} WHERE id = $${i}`,
      values
    );
  }
}
