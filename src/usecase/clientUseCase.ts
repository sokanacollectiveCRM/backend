import { Activity } from '../entities/Activity';
import { Client } from '../entities/Client';
import { ActivityRepository } from '../repositories/interface/activityRepository';
import { ClientRepository } from '../repositories/interface/clientRepository';

export class ClientUseCase {
  private clientRepository: ClientRepository;
  private activityRepository: ActivityRepository;

  constructor (clientRepository: ClientRepository, activityRepository: ActivityRepository) {
    this.clientRepository = clientRepository;
    this.activityRepository = activityRepository;
  }

  // Summary of clients for use in brief list of clients
  async getClientsLite(id: string, role: string): Promise<Client[]> {
    if (role === 'admin') {
      return this.clientRepository.findClientsLiteAll();
    } else {
      // console.log("calling findClientsLiteByDoula in clientUseCase ");
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
  async exportCSV(role:string): Promise<string|null> {
    try {
      if (role == "admin"|| role == "client"){
        const csvData = await this.clientRepository.exportCSV()
        if (!csvData) {
          throw new Error("No data available for CSV export");
        }
        return csvData;
      }
    } catch (error) {
      throw new Error(`Failed to retrive CSV data ${error.message}`)
    }
  }

  async getClientLite(clientId: string): Promise<Client> {
    return this.clientRepository.findClientLiteById(clientId);
  }

  async getClientDetailed(clientId: string): Promise<Client> {
    return this.clientRepository.findClientDetailedById(clientId);
  }

  async deleteClient(clientId: string): Promise<void> {
    return this.clientRepository.deleteClient(clientId);
  }

  // updates a client's status
  async updateClientStatus(
    clientId: string,
    status: string
  ): Promise<Client> {

    try {
      // Update the client status directly
      const client = await this.clientRepository.updateStatus(clientId, status);

      return client;
    }
    catch (error) {
      throw new Error(`Could not update client: ${error.message}`);
    }
  }

  // updates client profile fields
  async updateClientProfile(
    clientId: string,
    fieldsToUpdate: Partial<Client>
  ): Promise<Client> {

    try {
      // Update the client directly
      const client = await this.clientRepository.updateClient(clientId, fieldsToUpdate);

      return client;
    }
    catch (error) {
      throw new Error(`Could not update client profile: ${error.message}`);
    }
  }

  // Get activities for a client
  async getClientActivities(clientId: string): Promise<Activity[]> {
    try {
      return await this.activityRepository.getActivitiesByClientId(clientId);
    } catch (error) {
      throw new Error(`Could not fetch client activities: ${error.message}`);
    }
  }

  // Create a custom activity entry
  async createActivity(
    clientId: string,
    type: string,
    description: string,
    metadata: any,
    userId: string
  ): Promise<Activity> {
    try {
      return await this.activityRepository.createActivity({
        clientId,
        type,
        description,
        metadata,
        timestamp: new Date(),
        createdBy: userId,
      });
    } catch (error) {
      throw new Error(`Could not create activity: ${error.message}`);
    }
  }
}
