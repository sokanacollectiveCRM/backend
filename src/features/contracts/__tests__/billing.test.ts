import { shouldCreateClientPaymentSchedule } from '../domain/billing';
import { ContractSnapshot } from '../domain/types';

function snapshot(
  pricing: Partial<ContractSnapshot['pricing']> = {}
): ContractSnapshot {
  return {
    contractId: 'contract-1',
    templateId: 'labor_support',
    templateVersion: 1,
    serviceType: 'Labor Support Services',
    client: {
      id: 'client-1',
      name: 'Test Client',
      email: 'client@example.test',
    },
    fields: [],
    selectedServices: [],
    pricing: {
      servicesSubtotalCents: 100_000,
      discountRate: 0,
      discountCents: 0,
      servicesAfterDiscountCents: 100_000,
      adminFeeCents: 0,
      totalCents: 100_000,
      depositCents: 10_000,
      balanceCents: 90_000,
      installmentCents: [30_000, 30_000, 30_000],
      ...pricing,
    },
    createdAt: '2026-08-30T00:00:00.000Z',
  };
}

describe('client payment schedule policy', () => {
  it('creates a schedule only for a positive self-pay labor deposit', () => {
    expect(shouldCreateClientPaymentSchedule(snapshot(), 'self_pay')).toBe(
      true
    );

    for (const path of [
      'insurance',
      'medicaid',
      'full_support',
      'unknown',
    ] as const) {
      expect(shouldCreateClientPaymentSchedule(snapshot(), path)).toBe(false);
    }
  });

  it('skips zero deposits and fully deposited contracts', () => {
    expect(
      shouldCreateClientPaymentSchedule(
        snapshot({ depositCents: 0 }),
        'self_pay'
      )
    ).toBe(false);
    expect(
      shouldCreateClientPaymentSchedule(
        snapshot({ depositCents: 100_000, balanceCents: 0 }),
        'self_pay'
      )
    ).toBe(false);
  });
});
