export interface CardDetails {
  number: string;
  expMonth: string;
  expYear: string;
  cvc: string;
}

export interface ChargePayload {
  amount: string;
  currency: string;
  card: CardDetails;
  context: { isEcommerce: boolean };
}

export function buildChargePayload(amount: string, card: CardDetails): ChargePayload {
  return {
    amount: amount.toString(),
    currency: 'USD',
    card: {
      number: card.number,
      expMonth: card.expMonth,
      expYear: card.expYear,
      cvc: card.cvc
    },
    context: {
      isEcommerce: true
    }
  };
} 