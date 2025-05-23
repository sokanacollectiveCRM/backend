import { Client } from '../entities/Client';
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


    //
  // // forward to repository to Fetch csv client data
  // //
  // // returns:
  // //    CSV data of Client
  // //
  // getCSV = async(role:string): Promise<any> => {
  //   try {
  //     if (role == "admin"|| role == "client"){
  //       const csvData = await this.supabaseuserRepository.exportCSV()
  //       if (!csvData) {
  //         throw new Error("No data available for CSV export");
  //       }
  //       return csvData;
  //     }
  //   } catch (error) {
  //     throw new Error(`Failed to retrive CSV data ${error.message}`)
  //   }
  // }

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