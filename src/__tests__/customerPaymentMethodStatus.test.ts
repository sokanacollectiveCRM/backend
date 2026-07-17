import { getPool } from '../db/cloudSqlPool';
import { clientPaymentMethodRepository } from '../repositories/cloudSqlPaymentMethodRepository';
import {
  customerPaymentMethodService,
  isCardExpired,
} from '../services/payments/customerPaymentMethodService';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));
jest.mock('../repositories/cloudSqlPaymentMethodRepository', () => ({
  clientPaymentMethodRepository: { getByClientId: jest.fn() },
}));

describe('normalized card-on-file status', () => {
  const clientId = '123e4567-e89b-12d3-a456-426614174000';
  const query = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getPool as jest.Mock).mockReturnValue({ query });
    query.mockResolvedValue({
      rows: [{ payment_method: 'Self-Pay', qbo_customer_id: 'qb-1' }],
    });
  });

  it('returns missing as normal business data', async () => {
    (
      clientPaymentMethodRepository.getByClientId as jest.Mock
    ).mockResolvedValue(null);
    await expect(
      customerPaymentMethodService.getCardOnFileStatus(clientId)
    ).resolves.toEqual({
      required: true,
      on_file: false,
      status: 'missing',
      quickbooks_customer_id: 'qb-1',
      payment_method_reference: null,
      card_brand: null,
      last4: null,
      exp_month: null,
      exp_year: null,
      last_verified_at: null,
      source: 'none',
    });
  });

  it.each([
    ['ACTIVE', 2099, 'active', true],
    ['verified', 2099, 'active', true],
    ['active', 2020, 'expired', false],
    ['inactive', 2020, 'inactive', false],
    ['deleted', 2099, 'inactive', false],
    ['failed', 2099, 'inactive', false],
    ['declined', 2099, 'inactive', false],
    ['disabled', 2099, 'inactive', false],
    ['expired', 2099, 'inactive', false],
  ])(
    'normalizes %s provider state',
    async (providerStatus, expYear, expectedStatus, onFile) => {
      (
        clientPaymentMethodRepository.getByClientId as jest.Mock
      ).mockResolvedValue({
        quickbooks_customer_id: 'qb-1',
        provider_payment_method_reference: 'pm-safe-reference',
        card_brand: 'Visa',
        last4: '4242',
        exp_month: 12,
        exp_year: expYear,
        status: providerStatus,
        updated_at: '2026-07-01T00:00:00.000Z',
      });
      const result =
        await customerPaymentMethodService.getCardOnFileStatus(clientId);
      expect(result).toMatchObject({ status: expectedStatus, on_file: onFile });
    }
  );

  it('does not label absent or invalid expiration metadata as expired', async () => {
    (
      clientPaymentMethodRepository.getByClientId as jest.Mock
    ).mockResolvedValue({
      quickbooks_customer_id: 'qb-1',
      provider_payment_method_reference: 'pm-safe-reference',
      card_brand: 'Visa',
      last4: '4242',
      exp_month: null,
      exp_year: null,
      status: 'verified',
      updated_at: '2026-07-01T00:00:00.000Z',
    });
    await expect(
      customerPaymentMethodService.getCardOnFileStatus(clientId)
    ).resolves.toMatchObject({ status: 'active', on_file: true });
  });

  it.each(['Medicaid', 'Full Support'])(
    'returns not_required for %s',
    async (paymentMethod) => {
      query.mockResolvedValue({
        rows: [{ payment_method: paymentMethod, qbo_customer_id: null }],
      });
      const result =
        await customerPaymentMethodService.getCardOnFileStatus(clientId);
      expect(result).toMatchObject({
        required: false,
        on_file: false,
        status: 'not_required',
      });
      expect(
        clientPaymentMethodRepository.getByClientId
      ).not.toHaveBeenCalled();
    }
  );
});

describe('isCardExpired', () => {
  it.each([
    [7, 2026, '2026-07-31T23:59:59.999Z', false],
    [7, 2026, '2026-08-01T00:00:00.000Z', true],
    [6, 2026, '2026-07-01T00:00:00.000Z', true],
    [8, 2026, '2026-07-01T00:00:00.000Z', false],
    [12, 2025, '2026-01-01T00:00:00.000Z', true],
    [1, 2027, '2026-12-31T23:59:59.999Z', false],
    [12, 2027, '2026-07-01T00:00:00.000Z', false],
  ])('handles %s/%s at %s', (month, year, date, expected) => {
    expect(isCardExpired(month, year, new Date(date))).toBe(expected);
  });

  it.each([
    [null, 2026],
    [7, null],
    [0, 2026],
    [13, 2026],
    [1.5, 2026],
    [7, 0],
  ])('safely rejects invalid metadata (%s, %s)', (month, year) => {
    expect(isCardExpired(month, year, new Date('2026-07-01T00:00:00Z'))).toBe(
      false
    );
  });
});
