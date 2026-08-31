import { NextFunction, Request, Response } from 'express';

import { CloudSqlDoulaAssignmentService } from '../../../services/cloudSqlDoulaAssignmentService';
import { ContractService } from '../services/contractService';
import { adminDraftBodySchema } from '../validation';

type AuthenticatedRequest = Request & {
  user?: { id?: string; role?: string };
};

function actorId(req: AuthenticatedRequest): string {
  return String(req.user?.id || '');
}

export class ContractController {
  constructor(
    private readonly contracts: ContractService,
    private readonly assignments: Pick<
      CloudSqlDoulaAssignmentService,
      'getClientIdByAuthUserId'
    > = new CloudSqlDoulaAssignmentService()
  ) {}

  createDraft = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const input = adminDraftBodySchema.parse(req.body);
      res.status(201).json({
        contract: await this.contracts.createDraft(input, actorId(req)),
      });
    } catch (error) {
      next(error);
    }
  };

  getAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.json({ contract: await this.contracts.getAdmin(req.params.id) });
    } catch (error) {
      next(error);
    }
  };

  send = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.json({
        contract: await this.contracts.send(req.params.id, actorId(req), false),
      });
    } catch (error) {
      next(error);
    }
  };

  resend = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.json({
        contract: await this.contracts.send(req.params.id, actorId(req), true),
      });
    } catch (error) {
      next(error);
    }
  };

  void = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.json({
        contract: await this.contracts.void(
          req.params.id,
          actorId(req),
          typeof req.body?.reason === 'string' ? req.body.reason : undefined
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  audit = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const events = await this.contracts.audit(req.params.id);
      res.json({
        events: events.map((event) => ({
          id: event.id,
          type: event.type,
          occurredAt: event.occurredAt.toISOString(),
          actorType: event.actorType,
          actorId: event.actorId ?? null,
          metadata: event.metadata ?? {},
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  downloadAdmin = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.json(
        await this.contracts.getDownload(req.params.id, undefined, {
          type: 'user',
          id: actorId(req),
        })
      );
    } catch (error) {
      next(error);
    }
  };

  listMine = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const clientId = await this.resolveClientId(req);
      res.json({ contracts: await this.contracts.listForClient(clientId) });
    } catch (error) {
      next(error);
    }
  };

  getMine = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const clientId = await this.resolveClientId(req);
      res.json({
        contract: await this.contracts.getForClient(req.params.id, clientId),
      });
    } catch (error) {
      next(error);
    }
  };

  downloadMine = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const clientId = await this.resolveClientId(req);
      res.json(
        await this.contracts.getDownload(req.params.id, clientId, {
          type: 'client',
          id: clientId,
        })
      );
    } catch (error) {
      next(error);
    }
  };

  private async resolveClientId(req: AuthenticatedRequest): Promise<string> {
    const authUserId = String(req.user?.id || '');
    const clientId = authUserId
      ? await this.assignments.getClientIdByAuthUserId(authUserId)
      : null;
    if (!clientId) {
      const error = new Error('Client not found') as Error & {
        statusCode?: number;
      };
      error.statusCode = 404;
      throw error;
    }
    return clientId;
  }
}
