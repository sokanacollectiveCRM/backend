import { Request, Response } from 'express';

import { ClientUseCase } from 'usecase/clientUseCase';
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError
} from 'domainErrors';
import { AuthRequest } from 'types'

export class clientController {
  private clientUseCase: ClientUseCase;

  constructor (clientUseCase: ClientUseCase) {
    this.clientUseCase = clientUseCase;
  };

  async getClients(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { role } = req.user;

      // Returns clients based on the role
      let clients;
      if (role === 'admin') {
        clients = 
      }
    } 
    catch (error) {

    }
  }
}