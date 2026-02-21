import { Client } from '../../entities/Client';

/** Operational row shape for canonical getClientById / update responses (no PHI in type). */
export type ClientOperationalRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  address_line1: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  status: string | null;
  service_needed: string | null;
  portal_status: string | null;
  invited_at: string | null;
  last_invite_sent_at: string | null;
  invite_sent_count: number | null;
  requested_at: string | null;
  updated_at: string | null;
};

export interface ClientRepository {
  /**
   * Fetch clients with a minimal fieldset for list views (e.g., dashboard)
   */
  findClientsLiteAll(): Promise<Client[]>;

  /**
   * Fetch clients with full details for admin/detailed views
   */
  findClientsDetailedAll(): Promise<Client[]>;

  /**
   * Fetch lite clients assigned to a specific doula
   */
  findClientsLiteByDoula(userId: string): Promise<Client[]>;

  /**
   * Fetch detailed clients assigned to a specific doula
   */
  findClientsDetailedByDoula(userId: string): Promise<Client[]>;

  /**
   * Fetch lite client by their id
   */
  findClientLiteById(clientId: string): Promise<Client>;

  /**
   * Fetch detailed client by their id
   */
  findClientDetailedById(clientId: string): Promise<Client>;

  /**
   * Update client status with their client id
   */
  updateStatus(clientId: string, status: string): Promise<Client>;

  /**
   * Update client profile fields
   */
  updateClient(clientId: string, fieldsToUpdate: Partial<Client>): Promise<Client>;

  /**
   * Delete a client by their id
   */
  deleteClient(clientId: string): Promise<void>;

  /**
   * Get clients by status
   */
  findClientsByStatus(status: string): Promise<Client[]>;

  /**
   * Find a client by ID (lite or detailed)
   */
  findById(clientId: string): Promise<Client | null>;

  exportCSV(): Promise<string | null>;

  /**
   * Get client by ID (operational columns only). Used by canonical GET /clients/:id.
   */
  getClientById?(clientId: string): Promise<ClientOperationalRow | null>;

  /**
   * Update client status; return operational row. Used by canonical update status.
   */
  updateClientStatusCanonical?(clientId: string, status: string): Promise<ClientOperationalRow | null>;

  /**
   * Update only operational fields; return operational row. Used by canonical PATCH.
   */
  updateClientOperational?(clientId: string, fields: Record<string, any>): Promise<ClientOperationalRow | null>;

  /**
   * Write-through cache for identity (first_name, last_name, email, phone_number).
   */
  updateIdentityCache?(clientId: string, fields: { first_name?: string; last_name?: string; email?: string; phone_number?: string }): Promise<void>;
}
