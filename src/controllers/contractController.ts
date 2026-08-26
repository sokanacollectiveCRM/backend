import { Request, Response } from 'express';

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../domains/errors';
import { Client } from '../entities/Client';
import { UpdateRequest } from '../types';
import { ContractUseCase } from '../usecase/contractUseCase';

export class ContractController {
  private contractUseCase: ContractUseCase;

  constructor(contractUseCase: ContractUseCase) {
    this.contractUseCase = contractUseCase;
  }

  //
  // Generate and save a contract (finalized)
  //
  async generateContract(req: UpdateRequest, res: Response): Promise<void> {
    try {
      const { templateId, clientId, fields, note, fee, deposit } = req.body;

      if (!templateId || !clientId || !fields) {
        throw new ValidationError('Missing required fields.');
      }

      // Delegate to use case for PDF generation + upload + DB write
      const contract = await this.contractUseCase.createContract({
        templateId,
        clientId,
        fields,
        note,
        fee,
        deposit,
        generatedBy: req.user.id,
      });

      res.status(201).json(contract);
    } catch (err) {
      const error = this.handleError(err, res);
      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message });
      }
    }
  }

  //
  // Preview a generated contract PDF
  //
  async previewContract(req: Request, res: Response): Promise<void> {
    try {
      const contractId = req.params.id;
      if (!contractId) throw new ValidationError('Missing contract ID');

      const { buffer, filename } =
        await this.contractUseCase.fetchContractPDF(contractId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=${filename}`);
      res.send(buffer);
    } catch (err) {
      const error = this.handleError(err, res);
      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message });
      }
    }
  }

  //
  // getTemplates
  //
  // Get a list of all templates
  //
  // returns:
  //    Templates
  //
  async getAllTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await this.contractUseCase.getAllTemplates();
      res.status(200).json(templates.map((template) => template.toJson()));
    } catch (getError) {
      const error = this.handleError(getError, res);

      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message });
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
  async deleteTemplate(req: Request, res: Response): Promise<void> {
    const name = decodeURIComponent(req.params.name);

    try {
      const result = await this.contractUseCase.deleteTemplate(name);
      void result;
      res.status(204).send();
    } catch (delError) {
      const error = this.handleError(delError, res);

      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message });
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
  async updateTemplate(req: UpdateRequest, res: Response): Promise<void> {
    const name = decodeURIComponent(req.params.name);
    const file = req.file;
    const { deposit, fee } = req.body;

    try {
      const result = await this.contractUseCase.updateTemplate(
        name,
        Number(deposit),
        Number(fee),
        file as any
      );
      void result;
      res.status(204).send();
    } catch (delError) {
      const error = this.handleError(delError, res);

      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message });
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
  async uploadTemplate(req: UpdateRequest, res: Response): Promise<void> {
    try {
      const file = req.file;
      const { name, deposit, fee } = req.body;

      if (!file) throw new ValidationError('No file uploaded');
      if (!name) throw new ValidationError('No contract name specified');

      await this.contractUseCase.uploadTemplate(
        file,
        name,
        Number(deposit),
        Number(fee)
      );

      res.status(201).json({ success: true });
    } catch (getError) {
      const error = this.handleError(getError, res);

      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message });
      }
    }
  }

  /**
   * Short-lived signed URL for private GCS template preview / download.
   */
  async getTemplateSignedUrl(req: Request, res: Response): Promise<void> {
    try {
      const name = decodeURIComponent(req.params.name);
      if (!name) throw new ValidationError('Missing template name');

      const url = await this.contractUseCase.getTemplateSignedUrl(name);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ url, expiresInSeconds: 15 * 60 });
    } catch (err) {
      const error = this.handleError(err, res);
      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message });
      }
    }
  }

  /**
   * Stream template bytes (authenticated); preferred over public Supabase URLs.
   */
  async downloadTemplate(req: Request, res: Response): Promise<void> {
    try {
      const name = decodeURIComponent(req.params.name);
      if (!name) throw new ValidationError('Missing template name');

      const buffer = await this.contractUseCase.getTemplate(name);
      const lower = name.toLowerCase();
      const contentType = lower.endsWith('.pdf')
        ? 'application/pdf'
        : lower.endsWith('.docx')
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/octet-stream';

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${name.replace(/"/g, '')}"`
      );
      res.status(200).send(buffer);
    } catch (err) {
      const error = this.handleError(err, res);
      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message });
      }
    }
  }

  //
  // Generate a filled template
  //
  // returns:
  //    none
  //
  async generateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { name, fields } = req.body;
      const download = req.query.download === 'true';

      if (!name) throw new ValidationError('No template name provided');

      // generate the template as pdf
      const pdfBuffer = await this.contractUseCase.generateTemplate(
        name,
        fields ?? {}
      );

      if (download) {
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=${fields.clientname}-${name}.pdf`
        );
        res.setHeader('Content-Type', 'application/pdf');
      } else {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `inline; filename=${fields.clientname}-${name}-preview.pdf`
        );
      }

      res.send(pdfBuffer);
    } catch (genError) {
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
  ): { status: number; message: string } {
    console.error('Error:', error.message);

    if (error instanceof ValidationError) {
      return { status: 400, message: error.message };
    } else if (error instanceof ConflictError) {
      return { status: 409, message: error.message };
    } else if (error instanceof AuthenticationError) {
      return { status: 401, message: error.message };
    } else if (error instanceof NotFoundError) {
      return { status: 404, message: error.message };
    } else if (error instanceof AuthorizationError) {
      return { status: 403, message: error.message };
    } else {
      return { status: 500, message: error.message };
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
