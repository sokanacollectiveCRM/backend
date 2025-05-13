import { Request, Response } from 'express';
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError
} from '../domains/errors';
import { Client } from '../entities/Client';

import { UpdateRequest } from '../types';
import { ContractUseCase } from '../usecase/contractUseCase';

export class ContractController {
  private contractUseCase: ContractUseCase;

  constructor (contractUseCase: ContractUseCase) {
    this.contractUseCase = contractUseCase;
  };

  //
  // uploadTemplate()
  //
  // Upload template to storage
  //
  // returns:
  //    none
  //
  async uploadTemplate(
    req: UpdateRequest,
    res: Response,
  ): Promise<void> {
    try {
      const file = req.file;
      const name = req.body.name;
  
      if (!file) throw new ValidationError('No file uploaded');
      if (!name) throw new ValidationError('No contract name specified');
  
      await this.contractUseCase.uploadTemplate(file, name);
  
      res.status(204).send();
    } 
    catch (getError) {
      const error = this.handleError(getError, res);

      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message})
      }
    }
  }

  //
  // Generete a filled templat
  //
  // returns:
  //    none
  //
  async generateTemplate(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      console.log("generating template controller");
      const { name, fields } = req.body;

      if (!name) throw new ValidationError('No template name provided');
      if (!fields || typeof fields !== 'object') throw new ValidationError('Missing or invalid fields');

      await this.contractUseCase.generateTemplate(name, fields, res); // pass res
    }
    catch (genError) {
      const error = this.handleError(genError, res);

      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message });
      }
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