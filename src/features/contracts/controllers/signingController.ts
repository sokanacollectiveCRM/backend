import { NextFunction, Request, Response } from 'express';

import {
  InvalidSigningAccessSessionError,
  SigningAccessSessionService,
} from '../services/signingAccessSessionService';
import {
  CompleteSigningInput,
  SigningSessionService,
} from '../services/signingSessionService';
import {
  signingCompleteBodySchema,
  signingExchangeBodySchema,
  signingProgressBodySchema,
} from '../validation';

const SIGNING_SESSION_HEADER = 'x-signing-session';

export class SigningController {
  constructor(
    private readonly signing: SigningSessionService,
    private readonly accessSessions: SigningAccessSessionService
  ) {}

  private evidence(req: Request) {
    return {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
      correlationId:
        (req as Request & { correlationId?: string }).correlationId ?? null,
    };
  }

  private readSessionToken(req: Request): string {
    const header = req.get(SIGNING_SESSION_HEADER)?.trim();
    if (header) return header;
    const authorization = req.get('authorization')?.trim() ?? '';
    if (authorization.toLowerCase().startsWith('signing ')) {
      return authorization.slice('signing '.length).trim();
    }
    throw new InvalidSigningAccessSessionError();
  }

  private authorize = async (req: Request) =>
    this.accessSessions.authorize(
      this.readSessionToken(req),
      this.evidence(req)
    );

  exchange = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const input = signingExchangeBodySchema.parse(req.body);
      res.setHeader('Cache-Control', 'no-store');
      res.json(
        await this.accessSessions.exchange(input.invitation, this.evidence(req))
      );
    } catch (error) {
      next(error);
    }
  };

  get = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const context = await this.authorize(req);
      res.setHeader('Cache-Control', 'no-store');
      res.json(await this.signing.get(context, this.evidence(req)));
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
      const context = await this.authorize(req);
      const input = signingProgressBodySchema.parse(req.body);
      res.setHeader('Cache-Control', 'no-store');
      res.json(
        await this.signing.saveProgress(
          context,
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
      const context = await this.authorize(req);
      const pdf = await this.signing.getDocument(context, this.evidence(req));
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
      const context = await this.authorize(req);
      const parsed = signingCompleteBodySchema.parse(req.body);
      const input: CompleteSigningInput = {
        initials: parsed.initials,
        consent: parsed.consent,
        signature: parsed.signature as CompleteSigningInput['signature'],
        completedFieldIds: parsed.completedFieldIds,
      };
      res.setHeader('Cache-Control', 'no-store');
      res.json(await this.signing.complete(context, input, this.evidence(req)));
    } catch (error) {
      next(error);
    }
  };

  legacyUnavailable = (
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(410).json({
      error:
        'This signing link format is no longer supported. Open the link from your email again or request a new invitation.',
      code: 'LEGACY_SIGNING_ROUTE',
    });
  };
}

export { SIGNING_SESSION_HEADER };
