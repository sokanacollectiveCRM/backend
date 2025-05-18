import { ClientRepository } from 'repositories/interface/clientRepository';
import { UserRepository } from 'repositories/interface/userRepository';

export class ClientUseCase {
  private userRepository: UserRepository;
  private clientRepository: ClientRepository;

  constructor (userRepository: UserRepository, clientRepository: ClientRepository) {
    this.userRepository = userRepository;
    this.clientRepository = clientRepository;
  }

  //
  // forward to repository to grab clients based on role
  //
  // returns:
  //    users
  //
  async getClients(
    id: string,
    role: string
  ): Promise<any> {

    try {
      if (role === "admin" || role === "doula") {
        let clients = await this.userRepository.findClientsByDoula(id);
        return clients;
      }
    }
    catch (error) {
      throw new Error(`Could not return clients: ${error.message}`);
    }
  }

  //
  // forward to repository to update client status in client_info
  //
  // returns:
  //    client
  //
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