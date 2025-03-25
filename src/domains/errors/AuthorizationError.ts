import { DomainError } from './DomainError';

export class AuthorizationError extends DomainError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}
