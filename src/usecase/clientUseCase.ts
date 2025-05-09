import { ClientRepository } from 'repositories/interface/clientRepository';
import { UserRepository } from 'repositories/interface/userRepository';
import { SupabaseUserRepository } from 'repositories/supabaseUserRepository';

export class ClientUseCase {
  private userRepository: UserRepository;
  private clientRepository: ClientRepository;
  private supabaseuserRepository: SupabaseUserRepository;

  constructor (userRepository: UserRepository, clientRepository: ClientRepository, supabaseuserRepository: SupabaseUserRepository) {
    this.userRepository = userRepository;
    this.clientRepository = clientRepository;
    this.supabaseuserRepository = supabaseuserRepository;
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
      if (role === "admin") {
        let clients = await this.userRepository.findClientsAll();
        return clients;
      }
    }
    catch (error) {
      throw new Error(`Could not return clients: ${error.message}`);
    }
  }

  //
  // forward to repository to Fetch csv client data
  //
  // returns:
  //    CSV data of Client
  //
  getCSV = async(role:string): Promise<any> => {
    try {
      if (role == "admin"|| role == "client"){
        const csvData = await this.supabaseuserRepository.exportCSV()
        if (!csvData) {
          throw new Error("No data available for CSV export");
        }
        return csvData;
      }
    } catch (error) {
      throw new Error(`Failed to retrive CSV data ${error.message}`)
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