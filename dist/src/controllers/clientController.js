'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ClientController = void 0;
const errors_1 = require('../domains/errors');
class ClientController {
  constructor(clientUseCase) {
    this.clientUseCase = clientUseCase;
  }
  //
  // getClients()
  //
  // Grabs all clients (lite or detailed) based on role or query param
  //
  // returns:
  //    Clients[]
  //
  async getClients(req, res) {
    try {
      const { id, role } = req.user;
      const { detailed } = req.query;
      const clients =
        detailed === 'true'
          ? await this.clientUseCase.getClientsDetailed(id, role)
          : await this.clientUseCase.getClientsLite(id, role);
      console.log('clients:', clients);
      res.json(clients.map((client) => client.toJson()));
    } catch (getError) {
      const error = this.handleError(getError, res);
      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message });
      }
    }
  }
  //
  // getCSVClients()
  //
  // Grabs all client data in CSV form
  //
  // returns:
  //    CSV of users
  //
  async exportCSV(req, res) {
    try {
      const { role } = req.user;
      const clientsCSV = await this.clientUseCase.exportCSV(role);
      res.header('Content-Type', 'text/csv');
      res.attachment('clients.csv');
      res.send(clientsCSV);
    } catch (getError) {
      const error = this.handleError(getError, res);
      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message });
      }
    }
  }
  //
  // getClientById()
  //
  // Grab a specific client with detailed information
  //
  // returns:
  //    Client
  //
  async getClientById(req, res) {
    try {
      const { id } = req.params;
      const { detailed } = req.query;
      if (!id) {
        res.status(400).json({ error: 'Missing client ID' });
        return;
      }
      const client =
        detailed === 'true'
          ? await this.clientUseCase.getClientDetailed(id)
          : await this.clientUseCase.getClientLite(id);
      res.json(client.toJson());
    } catch (error) {
      const err = this.handleError(error, res);
      if (!res.headersSent) {
        res.status(err.status).json({ error: err.message });
      }
    }
  }
  //
  // updateClientStatus
  //
  // Updates client status in client_info table by grabbing the client to update in the request body
  //
  // returns:
  //    Client with updatedAt timestamp
  //
  async updateClientStatus(req, res) {
    const { clientId, status } = req.body;
    console.log(clientId, status);
    if (!clientId || !status) {
      res.status(400).json({ message: 'Missing client ID or status' });
      return;
    }
    try {
      // Update client status directly in client_info table
      const client = await this.clientUseCase.updateClientStatus(
        clientId,
        status
      );
      res.json({
        success: true,
        client: {
          id: client.id,
          status: client.status,
          updatedAt: client.updatedAt,
          firstname: client.user.firstname,
          lastname: client.user.lastname,
          email: client.user.email,
          role: client.user.role,
          serviceNeeded: client.serviceNeeded,
          requestedAt: client.requestedAt,
        },
      });
    } catch (statusError) {
      const error = this.handleError(statusError, res);
      res.status(error.status).json({ error: error.message });
    }
  }
  //
  // updateClient
  //
  // Updates client profile fields
  //
  // returns:
  //    Client with updatedAt timestamp
  //
  async updateClient(req, res) {
    const { id } = req.params;
    const updateData = req.body;
    console.log('Controller: Request details:', {
      method: req.method,
      url: req.url,
      originalUrl: req.originalUrl,
      path: req.path,
      params: req.params,
      id,
      idType: typeof id,
    });
    if (!id) {
      res.status(400).json({ error: 'Missing client ID' });
      return;
    }
    // Validate that id looks like a UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('Controller: Invalid client ID format:', id);
      res.status(400).json({
        error: `Invalid client ID format: ${id}. Expected UUID format.`,
      });
      return;
    }
    console.log('Controller: Updating client:', {
      id,
      idType: typeof id,
      updateData,
      updateDataKeys: Object.keys(updateData),
    });
    try {
      const client = await this.clientUseCase.updateClientProfile(
        id,
        updateData
      );
      console.log('Controller: Client updated successfully:', client.id);
      res.json({
        success: true,
        client: {
          id: client.id,
          updatedAt: client.updatedAt,
          firstname: client.user.firstname,
          lastname: client.user.lastname,
          email: client.user.email,
          phoneNumber: client.phoneNumber, // Get from Client entity
          role: client.user.role,
          status: client.status,
          serviceNeeded: client.serviceNeeded,
          requestedAt: client.requestedAt,
        },
      });
    } catch (error) {
      console.error('Controller: Error updating client:', error);
      const err = this.handleError(error, res);
      res.status(err.status).json({ error: err.message });
    }
  }
  // Helper method to handle errors
  handleError(error, res) {
    console.error('Error:', error.message);
    if (error instanceof errors_1.ValidationError) {
      return { status: 400, message: error.message };
    } else if (error instanceof errors_1.ConflictError) {
      return { status: 409, message: error.message };
    } else if (error instanceof errors_1.AuthenticationError) {
      return { status: 401, message: error.message };
    } else if (error instanceof errors_1.NotFoundError) {
      return { status: 404, message: error.message };
    } else if (error instanceof errors_1.AuthorizationError) {
      return { status: 403, message: error.message };
    } else {
      return { status: 500, message: error.message };
    }
  }
  // Helper for returning basic summary of a client
  mapToClientSummary(client) {
    return {
      id: client.user.id.toString(),
      firstname: client.user.firstname,
      lastname: client.user.lastname,
      serviceNeeded: client.serviceNeeded,
      requestedAt: client.requestedAt,
      updatedAt: client.updatedAt,
      status: client.status,
    };
  }
}
exports.ClientController = ClientController;
