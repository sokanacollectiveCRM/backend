"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientUseCase = void 0;
class ClientUseCase {
    constructor(clientRepository, activityRepository) {
        this.clientRepository = clientRepository;
        this.activityRepository = activityRepository;
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
    async updateClientStatus(clientId, status, userId) {
        try {
            // Get the current client to track the old status
            const currentClient = await this.clientRepository.findClientLiteById(clientId);
            const oldStatus = currentClient.status;
            // Update the client status
            const client = await this.clientRepository.updateStatus(clientId, status);
            // Create activity log entry
            const activity = await this.activityRepository.createActivity({
                clientId,
                type: 'status_change',
                description: `Status changed from ${oldStatus} to ${status}`,
                metadata: {
                    field: 'status',
                    oldValue: oldStatus,
                    newValue: status
                },
                timestamp: new Date(),
                createdBy: userId
            });
            return { client, activity };
        }
        catch (error) {
            throw new Error(`Could not update client: ${error.message}`);
        }
    }
    // updates client profile fields
    async updateClientProfile(clientId, fieldsToUpdate, userId) {
        try {
            // Get the current client to track changes
            const currentClient = await this.clientRepository.findClientDetailedById(clientId);
            // Update the client
            const client = await this.clientRepository.updateClient(clientId, fieldsToUpdate);
            // Determine what fields changed
            const changedFields = [];
            if (fieldsToUpdate.user?.firstname !== undefined && fieldsToUpdate.user.firstname !== currentClient.user.firstname) {
                changedFields.push('firstname');
            }
            if (fieldsToUpdate.user?.lastname !== undefined && fieldsToUpdate.user.lastname !== currentClient.user.lastname) {
                changedFields.push('lastname');
            }
            if (fieldsToUpdate.user?.email !== undefined && fieldsToUpdate.user.email !== currentClient.user.email) {
                changedFields.push('email');
            }
            if (fieldsToUpdate.serviceNeeded !== undefined && fieldsToUpdate.serviceNeeded !== currentClient.serviceNeeded) {
                changedFields.push('serviceNeeded');
            }
            // Create activity log entry if there were changes
            let activity = null;
            if (changedFields.length > 0) {
                activity = await this.activityRepository.createActivity({
                    clientId,
                    type: 'profile_update',
                    description: `Profile updated: ${changedFields.join(', ')}`,
                    metadata: {
                        changedFields
                    },
                    timestamp: new Date(),
                    createdBy: userId
                });
            }
            return { client, activity: activity };
        }
        catch (error) {
            throw new Error(`Could not update client profile: ${error.message}`);
        }
    }
    // Get activities for a client
    async getClientActivities(clientId) {
        try {
            return await this.activityRepository.getActivitiesByClientId(clientId);
        }
        catch (error) {
            throw new Error(`Could not fetch client activities: ${error.message}`);
        }
    }
    // Create a custom activity entry
    async createActivity(clientId, type, description, metadata, userId) {
        try {
            return await this.activityRepository.createActivity({
                clientId,
                type,
                description,
                metadata,
                timestamp: new Date(),
                createdBy: userId
            });
        }
        catch (error) {
            throw new Error(`Could not create activity: ${error.message}`);
        }
    }
}
exports.ClientUseCase = ClientUseCase;
