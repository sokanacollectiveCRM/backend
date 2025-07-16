"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationError = void 0;
const DomainError_1 = require("././DomainError");
class AuthenticationError extends DomainError_1.DomainError {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}
exports.AuthenticationError = AuthenticationError;
