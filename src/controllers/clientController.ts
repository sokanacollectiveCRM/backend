import { Response } from 'express';

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError
} from 'domainErrors';
import { AuthRequest } from 'types';
import { ClientUseCase } from 'usecase/clientUseCase';

export class clientController {
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
      const { email, role } = req.user;
      // call use case to grab all users
      const users = await this.clientUseCase.getClients(email, role);
      res.json(users)
    } 
    catch (getError) {
      const error = this.handleError(getError, res);
      res.status(error.status).json({ error: error.message})
    }
  }

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
}