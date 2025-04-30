import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError
} from 'domains/errors';
import { Client } from 'entities/Client';
import { Response } from 'express';

import { AuthRequest } from 'types';
import { ClientUseCase } from 'usecase/clientUseCase';

export class ClientController {
  private clientUseCase: ClientUseCase;

  constructor (clientUseCase: ClientUseCase) {
    this.clientUseCase = clientUseCase;
  };

  //
  // getClients()
  //
  // Grabs all users specified by role (All for admins, assigned for doulas)
  //
  // returns:
  //    List of users
  //
  async getClients(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { id, role } = req.user;
      // call use case to grab all users
      const clients = await this.clientUseCase.getClients(id, role);
      res.json(clients.map(this.mapToClientSummary));
    } 
    catch (getError) {
      const error = this.handleError(getError, res);

      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message})
      }
    }
  }

  //
  // updateClientStatus
  //
  // Updates client status in client_info table by grabbing the client to update in the request body
  //
  // returns:
  //    Client
  //
  async updateClientStatus(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    const { clientId, status } = req.body;

    if (!clientId || !status) {
      res.status(400).json({ message: 'Missing client ID or status' });
    }

    try {
      const client = await this.clientUseCase.updateClientStatus(clientId, status);
      res.json(this.mapToClientSummary(client));
    }
    catch (statusError) {
      const error = this.handleError(statusError, res);

      res.status(error.status).json({ error: error.message });
    }
  }
  

  //
  // updateStatus()
  //
  // Updates the user's status

  // Helper method to handle errors
  private handleError(
    error: Error, 
    res: Response
  ): { status: number, message: string } {
    console.error('Error:', error.message);
    
    if (error instanceof ValidationError) {
      return { status: 400, message: error.message};
    } else if (error instanceof ConflictError) {
      return { status: 409, message: error.message};
    } else if (error instanceof AuthenticationError) {
      return { status: 401, message: error.message};
    } else if (error instanceof NotFoundError) {
      return { status: 404, message: error.message};
    } else if (error instanceof AuthorizationError) {
      return { status: 403, message: error.message};
    } else {
      return { status: 500, message: error.message};
    }
  }

  // Helper for returning basic summary of a client
  private mapToClientSummary(client: Client) {
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