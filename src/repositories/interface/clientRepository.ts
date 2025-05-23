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
}