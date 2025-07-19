'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ValidationError = void 0;
const DomainError_1 = require('./DomainError');
class ValidationError extends DomainError_1.DomainError {
  constructor(message) {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
exports.ValidationError = ValidationError;
