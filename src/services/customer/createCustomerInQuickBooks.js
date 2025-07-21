'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.default = createCustomerInQuickBooks;
const qboClient_1 = require('../../utils/qboClient');
async function createCustomerInQuickBooks(qboPayload) {
  const { Customer } = await (0, qboClient_1.qboRequest)(
    '/customer?minorversion=65',
    { method: 'POST', body: JSON.stringify(qboPayload) }
  );
  return Customer;
}
