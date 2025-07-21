"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainError = void 0;
class DomainError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        // This is necessary to make instanceof work properly in TypeScript
        Object.setPrototypeOf(this, DomainError.prototype);
    }
}
exports.DomainError = DomainError;
