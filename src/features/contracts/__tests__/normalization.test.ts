import {
  normalizeContractPayload,
  normalizeLegacyContractPayload,
} from '../domain/normalization';

describe('contract payload normalization', () => {
  it('normalizes the active flat adapter and recomputes service totals', () => {
    const normalized = normalizeContractPayload({
      clientName: 'Ada Lovelace',
      clientEmail: 'ada@example.test',
      serviceType: 'Labor Support Services',
      totalInvestment: '$999,999.99',
      depositAmount: '$50.00',
      remainingBalance: '$1.00',
      selectedServices: [
        { id: 'labor', name: 'Labor', type: 'flat', amount: 100 },
        {
          id: 'care',
          name: 'Care',
          type: 'hourly',
          hourlyRate: '$20.00',
          totalHours: '5',
        },
      ],
      adminFee: '$150.00',
      installmentsCount: 3,
    });

    expect(normalized.templateClass).toBe('labor');
    expect(normalized.pricing.servicesSubtotalCents).toBe(20_000);
    expect(normalized.pricing.discountCents).toBe(2_000);
    expect(normalized.pricing.totalCents).toBe(33_000);
    expect(normalized.pricing.depositCents).toBe(5_000);
    expect(normalized.pricing.balanceCents).toBe(28_000);
    expect(normalized.pricing.installmentCents).toEqual([9_333, 9_333, 9_334]);
  });

  it('normalizes nested legacy aliases and calculates a percent deposit', () => {
    const normalized = normalizeLegacyContractPayload({
      clientName: 'Outer Name',
      clientEmail: 'outer@example.test',
      contractData: {
        service_type: 'Postpartum Doula Services',
        selected_services: [
          {
            service_id: 'postpartum',
            service_name: 'Postpartum',
            type: 'hourly',
            hourly_rate: '35.00',
            total_hours: 10,
          },
        ],
        deposit_type: 'percent',
        deposit_value: 20,
        installments_count: 2,
      },
    });

    expect(normalized.clientName).toBe('Outer Name');
    expect(normalized.clientEmail).toBe('outer@example.test');
    expect(normalized.templateClass).toBe('postpartum');
    expect(normalized.pricing.totalCents).toBe(35_000);
    expect(normalized.pricing.depositCents).toBe(7_000);
    expect(normalized.pricing.installmentCents).toEqual([14_000, 14_000]);
  });

  it('accepts legacy total dollar strings only when services are absent', () => {
    const normalized = normalizeContractPayload({
      contractData: {
        totalAmount: '$1,250.25',
        depositAmount: '$250.25',
        adminFee: '$150.00',
        installmentsCount: 2,
      },
    });

    expect(normalized.pricing.totalCents).toBe(125_025);
    expect(normalized.pricing.adminFeeCents).toBe(15_000);
    expect(normalized.pricing.balanceCents).toBe(100_000);
    expect(normalized.pricing.installmentCents).toEqual([50_000, 50_000]);
  });
});
