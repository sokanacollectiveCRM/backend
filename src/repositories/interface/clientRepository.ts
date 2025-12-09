import { Client } from '../../entities/Client';

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
}
