import { NextFunction, Request, Response } from 'express';

import {
  CompleteSigningInput,
  SigningSessionService,
} from '../services/signingSessionService';
import {
  signingCompleteBodySchema,
  signingProgressBodySchema,
} from '../validation';

export class SigningController {
  constructor(private readonly signing: SigningSessionService) {}

  private evidence(req: Request) {
    return {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
      correlationId:
        (req as Request & { correlationId?: string }).correlationId ?? null,
    };
  }

  get = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await this.signing.get(req.params.token, this.evidence(req)));
    } catch (error) {
      next(error);
    }
  };

  progress = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const input = signingProgressBodySchema.parse(req.body);
      res.setHeader('Cache-Control', 'no-store');
      res.json(
        await this.signing.saveProgress(
          req.params.token,
          input.completedFieldIds,
          this.evidence(req)
        )
      );
    } catch (error) {
      next(error);
    }
  };

  document = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const pdf = await this.signing.getDocument(
        req.params.token,
        this.evidence(req)
      );
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="contract.pdf"');
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  };

  complete = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const parsed = signingCompleteBodySchema.parse(req.body);
      const input: CompleteSigningInput = {
        initials: parsed.initials,
        consent: parsed.consent,
        signature: parsed.signature as CompleteSigningInput['signature'],
        completedFieldIds: parsed.completedFieldIds,
      };
      res.setHeader('Cache-Control', 'no-store');
      res.json(
        await this.signing.complete(req.params.token, input, this.evidence(req))
      );
    } catch (error) {
      next(error);
    }
  };
}
