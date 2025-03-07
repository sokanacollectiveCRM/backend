// src/domain/errors/AuthenticationError.ts
import { DomainError } from './DomainError';

export class AuthenticationError extends DomainError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}
