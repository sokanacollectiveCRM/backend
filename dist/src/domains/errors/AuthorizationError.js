"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorizationError = void 0;
const DomainError_1 = require("././DomainError");
class AuthorizationError extends DomainError_1.DomainError {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, AuthorizationError.prototype);
    }
}
exports.AuthorizationError = AuthorizationError;
