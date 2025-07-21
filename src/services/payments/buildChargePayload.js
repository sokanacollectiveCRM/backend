'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.buildChargePayload = buildChargePayload;
function buildChargePayload(amount, card) {
  return {
    amount: amount.toString(),
    currency: 'USD',
    card: {
      number: card.number,
      expMonth: card.expMonth,
      expYear: card.expYear,
      cvc: card.cvc,
    },
    context: {
      isEcommerce: true,
    },
  };
}
