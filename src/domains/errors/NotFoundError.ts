// src/domain/errors/NotFoundError.ts
import { DomainError } from './DomainError';

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}
