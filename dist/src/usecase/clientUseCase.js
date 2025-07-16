"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientUseCase = void 0;
class ClientUseCase {
    constructor(clientRepository) {
        this.clientRepository = clientRepository;
    }
    // Summary of clients for use in brief list of clients
    async getClientsLite(id, role) {
        if (role === 'admin') {
            return this.clientRepository.findClientsLiteAll();
        }
        else {
            // console.log("calling findClientsLiteByDoula in clientUseCase ");
            return this.clientRepository.findClientsLiteByDoula(id);
        }
    }
    // Detailed view of clients for profile
    async getClientsDetailed(id, role) {
        if (role === 'admin') {
            return this.clientRepository.findClientsDetailedAll();
        }
        else {
            return this.clientRepository.findClientsDetailedByDoula(id);
        }
    }
    //
    // // forward to repository to Fetch csv client data
    // //
    // // returns:
    // //    CSV data of Client
    // //
    async exportCSV(role) {
        try {
            if (role == "admin" || role == "client") {
                const csvData = await this.clientRepository.exportCSV();
                if (!csvData) {
                    throw new Error("No data available for CSV export");
                }
                return csvData;
            }
        }
        catch (error) {
            throw new Error(`Failed to retrive CSV data ${error.message}`);
        }
    }
    async getClientLite(clientId) {
        return this.clientRepository.findClientLiteById(clientId);
    }
    async getClientDetailed(clientId) {
        return this.clientRepository.findClientDetailedById(clientId);
    }
    // updates a client's status
    async updateClientStatus(clientId, status) {
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
    async updateClientProfile(clientId, fieldsToUpdate) {
        try {
            // Update the client directly
            const client = await this.clientRepository.updateClient(clientId, fieldsToUpdate);
            return client;
        }
        catch (error) {
            throw new Error(`Could not update client profile: ${error.message}`);
        }
    }
}
exports.ClientUseCase = ClientUseCase;
