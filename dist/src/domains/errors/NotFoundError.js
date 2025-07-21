"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundError = void 0;
const DomainError_1 = require("./DomainError");
class NotFoundError extends DomainError_1.DomainError {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}
exports.NotFoundError = NotFoundError;
