import {
  buildInstallmentCents,
  calculateContractPricing,
  parseMoneyToCents,
} from '../domain/calculations';

describe('contract calculations', () => {
  it('calculates services in cents, discount, admin fee, deposit, and remainder', () => {
    const result = calculateContractPricing({
      selectedServices: [
        { id: 'labor', name: 'Labor', type: 'flat', amount: '$100.01' },
        {
          id: 'postpartum',
          name: 'Postpartum',
          type: 'hourly',
          hourlyRate: '25.00',
          totalHours: 4,
        },
      ],
      adminFeeAmount: 150,
      deposit: { type: 'percent', value: 10 },
      installmentsCount: 4,
    });

    expect(result.servicesSubtotalCents).toBe(20_001);
    expect(result.positiveServiceCount).toBe(2);
    expect(result.discountRate).toBe(0.1);
    expect(result.discountCents).toBe(2_000);
    expect(result.adminFeeCents).toBe(15_000);
    expect(result.totalCents).toBe(33_001);
    expect(result.depositCents).toBe(3_300);
    expect(result.balanceCents).toBe(29_701);
    expect(result.installmentCents).toEqual([7_425, 7_425, 7_425, 7_426]);
  });

  it('discounts only when more than one computed service is positive', () => {
    const result = calculateContractPricing({
      selectedServices: [
        { id: 'one', name: 'One', type: 'flat', amount: 100 },
        {
          id: 'zero',
          name: 'Zero',
          type: 'hourly',
          hourlyRate: 50,
          totalHours: 0,
        },
      ],
    });

    expect(result.positiveServiceCount).toBe(1);
    expect(result.discountCents).toBe(0);
    expect(result.totalCents).toBe(10_000);
  });

  it('supports flat deposits and never creates a negative balance', () => {
    const result = calculateContractPricing({
      selectedServices: [{ id: 'one', name: 'One', type: 'flat', amount: 50 }],
      deposit: { type: 'flat', value: '$75.00' },
      installmentsCount: 2,
    });

    expect(result.depositCents).toBe(7_500);
    expect(result.balanceCents).toBe(0);
    expect(result.installmentCents).toEqual([0, 0]);
  });

  it('parses active-adapter dollar strings strictly', () => {
    expect(parseMoneyToCents('$1,234.56')).toBe(123_456);
    expect(buildInstallmentCents(10, 3)).toEqual([3, 3, 4]);
    expect(() => parseMoneyToCents('12.345')).toThrow('Invalid money value');
  });
});
