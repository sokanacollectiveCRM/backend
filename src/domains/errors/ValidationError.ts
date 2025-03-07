// src/domain/errors/ValidationError.ts
import { DomainError } from './DomainError';

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
