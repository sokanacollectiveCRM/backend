export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // This is necessary to make instanceof work properly in TypeScript
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}

// Validation errors - for invalid inputs, formats, etc.
export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

// Conflict errors - for when something already exists, is taken, etc.
export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

// Not found errors - for when requested resources don't exist
export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

// Authorization errors - for permission issues
export class AuthorizationError extends DomainError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

// Authentication errors - for login issues
export class AuthenticationError extends DomainError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}