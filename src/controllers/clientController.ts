import { Request, Response } from 'express';

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError
} from 'domainErrors';

export class clientController {
  private clientUseCase;

  constructor () {};

  async getClients(
    req,
    res
  )
}