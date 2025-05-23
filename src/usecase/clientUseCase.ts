import { Client } from 'entities/Client';
import { ClientRepository } from '../repositories/interface/clientRepository';

export class ClientUseCase {
  private clientRepository: ClientRepository;

  constructor (clientRepository: ClientRepository) {
    this.clientRepository = clientRepository;
  }

  // Summary of clients for use in brief list of clients
  async getClientsLite(id: string, role: string): Promise<Client[]> {
    if (role === 'admin') {
      return this.clientRepository.findClientsLiteAll();
    } else {
      return this.clientRepository.findClientsLiteByDoula(id);
    }
  }

  // Detailed view of clients for profile
  async getClientsDetailed(id: string, role: string): Promise<Client[]> {
    if (role === 'admin') {
      return this.clientRepository.findClientsDetailedAll();
    } else {
      return this.clientRepository.findClientsDetailedByDoula(id);
    }
  }

  async getClientLite(clientId: string): Promise<Client> {
    return this.clientRepository.findClientLiteById(clientId);
  }

  async getClientDetailed(clientId: string): Promise<Client> {
    return this.clientRepository.findClientDetailedById(clientId);
  }

  // updates a client's status
  async updateClientStatus(
    clientId: string,
    status: string
  ): Promise<any> {

    try {
      const client = await this.clientRepository.updateStatus(clientId, status);
      return client;
    }
    catch (error) {
      throw new Error(`Could not update client: ${error.message}`);
    }
  }
}