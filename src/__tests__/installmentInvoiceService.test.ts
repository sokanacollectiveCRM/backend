import { getPool } from '../db/cloudSqlPool';
import { NodemailerService } from '../services/emailService';
import {
  InstallmentInvoiceError,
  buildInstallmentInvoiceEmail,
  installmentInvoiceService,
} from '../services/installmentInvoiceService';
import createInvoiceInQuickBooks from '../services/invoice/createInvoiceInQuickBooks';
import { customerPaymentMethodService } from '../services/payments/customerPaymentMethodService';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));
jest.mock('../services/invoice/createInvoiceInQuickBooks', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../services/emailService', () => ({ NodemailerService: jest.fn() }));
jest.mock('../services/payments/customerPaymentMethodService', () => ({
  customerPaymentMethodService: { getCardOnFileStatus: jest.fn() },
}));
jest.mock(
  '../repositories/cloudSqlClientOnboardingReadinessRepository',
  () => ({
    clientOnboardingReadinessRepository: { recordEvent: jest.fn() },
  })
);
jest.mock('../services/portalEligibilityService', () => ({
  portalEligibilityService: { computeAndPersist: jest.fn() },
}));

const clientId = '123e4567-e89b-12d3-a456-426614174000';
const staffId = '123e4567-e89b-12d3-a456-426614174001';
const installmentId = '123e4567-e89b-12d3-a456-426614174002';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: installmentId,
    schedule_id: 'schedule-1',
    schedule_status: 'active',
    amount: '500.00',
    due_date: '2099-08-01',
    status: 'pending',
    payment_type: 'installment',
    payment_number: 2,
    is_overdue: false,
    qbo_invoice_id: null,
    payment_link: null,
    invoice_status: null,
    invoice_created_at: null,
    updated_at: '2026-07-01T00:00:00.000Z',
    paid_at: null,
    client_id: clientId,
    qbo_customer_id: 'qb-customer-1',
    readiness_qbo_customer_id: 'qb-customer-1',
    payment_method: 'Self-Pay',
    first_name: 'Synthetic',
    last_name: 'Client',
    email: 'synthetic@example.test',
    service_needed: 'Postpartum support',
    postpartum_hours: '40',
    doula_names: 'Dana Doula',
    contract_terms: 'Monthly installments under signed service agreement',
    ...overrides,
  };
}

describe('installment invoice service', () => {
  const sendEmail = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (NodemailerService as jest.Mock).mockImplementation(() => ({ sendEmail }));
    sendEmail.mockResolvedValue(undefined);
    (
      customerPaymentMethodService.getCardOnFileStatus as jest.Mock
    ).mockResolvedValue({ required: true, on_file: true, status: 'active' });
    (createInvoiceInQuickBooks as jest.Mock).mockResolvedValue({
      Id: 'qbo-invoice-1',
      invoiceLink: 'https://qbo.example.test/invoice/1',
    });
  });

  it('returns a complete ordered schedule view and selects the next installment', async () => {
    const rows = [
      row({
        id: 'deposit',
        payment_number: 1,
        payment_type: 'deposit',
        status: 'paid',
        due_date: '2026-06-01',
      }),
      row(),
      row({ id: 'later', payment_number: 3, due_date: '2099-09-01' }),
    ];
    (getPool as jest.Mock).mockReturnValue({
      query: jest.fn().mockResolvedValue({ rows }),
    });
    const result = await installmentInvoiceService.list(clientId);
    expect(result).toHaveLength(3);
    expect(result[1]).toMatchObject({
      id: installmentId,
      schedule_id: 'schedule-1',
      installment_number: 2,
      payment_type: 'installment',
      amount: 500,
      payment_status: 'pending',
      qbo_invoice_status: null,
      qbo_invoice_id: null,
      payment_link: null,
      paid_date: null,
      is_overdue: false,
      available_action: { enabled: true, reason: null },
    });
    expect(result[2].available_action).toEqual({
      enabled: false,
      reason: 'A prior required installment remains unpaid',
    });
  });

  it('returns an empty list when the client has no schedule', async () => {
    (getPool as jest.Mock).mockReturnValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
    });
    await expect(installmentInvoiceService.list(clientId)).resolves.toEqual([]);
  });

  it.each([
    ['paid', 'INSTALLMENT_ALREADY_PAID'],
    ['cancelled', 'INSTALLMENT_CANCELLED'],
  ])('rejects a %s installment', async (status, code) => {
    mockTransactionalPool([row({ status })]);
    await expect(
      installmentInvoiceService.generate(clientId, installmentId, staffId)
    ).rejects.toMatchObject({ code });
    expect(createInvoiceInQuickBooks).not.toHaveBeenCalled();
  });

  it.each([
    [{ qbo_customer_id: null }, 'QBO_CUSTOMER_LINK_MISSING'],
    [
      { readiness_qbo_customer_id: 'different-qb-id' },
      'QBO_CUSTOMER_LINK_STALE',
    ],
  ])('returns controlled QBO linkage errors', async (overrides, code) => {
    mockTransactionalPool([row(overrides)]);
    await expect(
      installmentInvoiceService.generate(clientId, installmentId, staffId)
    ).rejects.toMatchObject({ code });
  });

  it('returns an existing invoice without calling QuickBooks', async () => {
    mockTransactionalPool([
      row({
        qbo_invoice_id: 'existing-1',
        payment_link: 'https://qbo.example.test/existing',
      }),
    ]);
    const result = await installmentInvoiceService.generate(
      clientId,
      installmentId,
      staffId
    );
    expect(result).toMatchObject({ qbo_invoice_id: 'existing-1' });
    expect(createInvoiceInQuickBooks).not.toHaveBeenCalled();
  });

  it('serializes concurrent requests so QuickBooks receives one create call', async () => {
    const current: any = row();
    let lock = Promise.resolve();
    const poolQuery = jest.fn().mockResolvedValue({ rows: [] });
    (getPool as jest.Mock).mockReturnValue({
      query: poolQuery,
      connect: jest.fn().mockImplementation(async () => {
        let releaseLock = () => undefined;
        return {
          release: jest.fn(),
          query: jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) {
              const previous = lock;
              lock = new Promise<void>((resolve) => {
                releaseLock = resolve;
              });
              await previous;
            }
            if (sql.includes('SELECT pi.id')) return { rows: [current] };
            if (
              sql.includes(
                'UPDATE public.payment_installments SET qbo_invoice_id'
              )
            ) {
              current.qbo_invoice_id = String(params?.[0]);
              current.payment_link = String(params?.[1]);
              current.invoice_status = 'created';
            }
            if (sql === 'COMMIT' || sql === 'ROLLBACK') releaseLock();
            return { rows: [] };
          }),
        };
      }),
    });

    const [first, second] = await Promise.all([
      installmentInvoiceService.generate(clientId, installmentId, staffId),
      installmentInvoiceService.generate(clientId, installmentId, staffId),
    ]);
    expect(createInvoiceInQuickBooks).toHaveBeenCalledTimes(1);
    expect(first.qbo_invoice_id).toBe('qbo-invoice-1');
    expect(second.qbo_invoice_id).toBe('qbo-invoice-1');
  });

  it('includes the missing-card warning in the legitimate invoice email', async () => {
    mockTransactionalPool([row()]);
    (
      customerPaymentMethodService.getCardOnFileStatus as jest.Mock
    ).mockResolvedValue({ required: true, on_file: false, status: 'missing' });
    const result = await installmentInvoiceService.generate(
      clientId,
      installmentId,
      staffId
    );
    expect(createInvoiceInQuickBooks).toHaveBeenCalledWith(
      expect.objectContaining({
        CustomerRef: { value: 'qb-customer-1' },
        Line: [
          expect.objectContaining({
            Description: expect.stringContaining(
              'Client: Synthetic Client\nService provided: Postpartum support\nTotal postpartum hours: 40\nDoula: Dana Doula\nTerms: Monthly installments under signed service agreement\nBilling questions: billing@sokanacollective.com'
            ),
          }),
        ],
        CustomerMemo: {
          value: expect.stringContaining(
            'Billing questions: billing@sokanacollective.com'
          ),
        },
      }),
      `installment-${installmentId}`
    );
    expect(sendEmail).toHaveBeenCalledWith(
      'synthetic@example.test',
      'Action Required — Installment Invoice and Card on File',
      expect.stringContaining('authorized card to remain on file')
    );
    expect(result).toMatchObject({ card_warning_included: true });
  });

  it.each([
    [
      'expired',
      'Action Required — Update Your Card for Your Installment',
      'appears to be expired',
    ],
    [
      'inactive',
      'Action Required — Installment Invoice and Payment Method',
      'not currently an active payment method',
    ],
  ])('selects the %s warning server-side', async (status, subject, phrase) => {
    mockTransactionalPool([row()]);
    (
      customerPaymentMethodService.getCardOnFileStatus as jest.Mock
    ).mockResolvedValue({ required: true, on_file: false, status });
    const result = await installmentInvoiceService.generate(
      clientId,
      installmentId,
      staffId
    );
    expect(sendEmail).toHaveBeenCalledWith(
      'synthetic@example.test',
      subject,
      expect.stringContaining(phrase)
    );
    expect(result).toMatchObject({
      card_status: { status },
      card_warning_included: true,
    });
  });

  it('uses the normal email when a card is not required', () => {
    const email = buildInstallmentInvoiceEmail(
      row() as never,
      'https://qbo.example.test',
      {
        required: false,
        on_file: false,
        status: 'not_required',
        quickbooks_customer_id: 'qb-1',
        payment_method_reference: null,
        card_brand: null,
        last4: null,
        exp_month: null,
        exp_year: null,
        last_verified_at: null,
        source: 'none',
      }
    );
    expect(email).toMatchObject({
      subject: 'Sokana Collective — Upcoming Installment Invoice',
      warningIncluded: false,
    });
  });

  it('preserves the created invoice when email delivery fails', async () => {
    const queries = mockTransactionalPool([row()]);
    sendEmail.mockRejectedValue(new Error('synthetic SMTP failure'));
    const result = await installmentInvoiceService.generate(
      clientId,
      installmentId,
      staffId
    );
    expect(result).toMatchObject({
      qbo_invoice_id: 'qbo-invoice-1',
      invoice_status: 'email_failed',
    });
    expect(
      queries.some(([sql]) =>
        String(sql).includes("invoice_status='email_failed'")
      )
    ).toBe(true);
  });
});

function mockTransactionalPool(rows: ReturnType<typeof row>[]) {
  const queries: unknown[][] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    queries.push([sql, params]);
    if (sql.includes('SELECT pi.id')) return { rows };
    return { rows: [] };
  });
  (getPool as jest.Mock).mockReturnValue({
    connect: jest.fn().mockResolvedValue({ query, release: jest.fn() }),
    query,
  });
  return queries;
}
