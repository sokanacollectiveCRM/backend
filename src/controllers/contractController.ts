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
  // getTemplates
  //
  // Get a list of all templates
  //
  // returns:
  //    Templates
  //
  async getAllTemplates(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const templates = await this.contractUseCase.getAllTemplates();
      res.status(200).json(templates.map((template) => template.toJson()));
    }
    catch (getError) {
      const error = this.handleError(getError, res);

      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message})
      }
    }
  }

  //
  // deleteTemplate
  //
  // Delete a template
  //
  // returns:
  //    None
  //
  async deleteTemplate(
    req: Request,
    res: Response
  ): Promise<void> {
    const name = req.params.name;

    try {
      const result = await this.contractUseCase.deleteTemplate(name);
      res.status(204).send();
    }
    catch (delError) {
      const error = this.handleError(delError, res);

      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message})
      }
    }
  }

    //
  // deleteTemplate
  //
  // Delete a template
  //
  // returns:
  //    None
  //
  async updateTemplate(
    req: UpdateRequest,
    res: Response
  ): Promise<void> {
    const name = req.params.name;
    const file = req.file;
    const { deposit, fee } = req.body;

    try {
      const result = await this.contractUseCase.updateTemplate(name, deposit, fee, file);
      res.status(204).send();
    }
    catch (delError) {
      const error = this.handleError(delError, res);

      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message})
      }
    }
  }

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
      const { name, deposit, fee } = req.body;
  
      if (!file) throw new ValidationError('No file uploaded');
      if (!name) throw new ValidationError('No contract name specified');
  
      await this.contractUseCase.uploadTemplate(file, name, deposit, fee);
  
      res.status(201).json({ success: true });
    } 
    catch (getError) {
      const error = this.handleError(getError, res);

      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message})
      }
    }
  }


  //
  // Generate a filled template
  //
  // returns:
  //    none
  //
  async generateTemplate(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { name, fields } = req.body;
      const download = req.query.download === 'true';

      if (!name) throw new ValidationError('No template name provided');

      // generate the template as pdf
      const pdfBuffer = await this.contractUseCase.generateTemplate(name, fields ?? {}, res);
      
      if (download) {
        res.setHeader('Content-Disposition', `attachment; filename=${fields.clientname}-${name}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
      }
      else {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=${fields.clientname}-${name}-preview.pdf`);
      }

      res.send(pdfBuffer);
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