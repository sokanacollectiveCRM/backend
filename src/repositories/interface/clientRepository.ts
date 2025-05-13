import { Client } from '../../entities/Client';

/**
 * ClientRepository defines the interface for client data operations
 */
export interface ClientRepository {
  /**
   * Update client status with their client id
   */
  updateStatus(clientId: string, status: string): Promise<Client>;
}