'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.default = buildInvoicePayload;
/**
 * Construct a QuickBooks Invoice payload with the correct QBO customer reference
 */
function buildInvoicePayload(qboCustomerId, opts) {
  const { lineItems, dueDate, memo, customerEmail } = opts;
  return {
    CustomerRef: { value: qboCustomerId },
    Line: lineItems,
    TxnDate: dueDate,
    DueDate: dueDate,
    PrivateNote: memo || '',
    BillEmail: { Address: customerEmail },
    AllowOnlineACHPayment: true,
    AllowOnlineCreditCardPayment: true,
    EmailStatus: 'NeedToSend',
    domain: 'QBO',
    sparse: false,
  };
}
