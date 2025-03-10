// src/domain/errors/DomainError.ts
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // This is necessary to make instanceof work properly in TypeScript
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}
