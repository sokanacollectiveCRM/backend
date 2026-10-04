import { getPool } from '../db/cloudSqlPool';
import { clientOnboardingReadinessRepository } from '../repositories/cloudSqlClientOnboardingReadinessRepository';
import { customerPaymentMethodService } from '../services/payments/customerPaymentMethodService';
import { PortalEligibilityService } from '../services/portalEligibilityService';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));
jest.mock('../services/payments/customerPaymentMethodService', () => ({
  customerPaymentMethodService: { getCardOnFileStatus: jest.fn() },
}));
jest.mock(
  '../repositories/cloudSqlClientOnboardingReadinessRepository',
  () => ({
    ...jest.requireActual(
      '../repositories/cloudSqlClientOnboardingReadinessRepository'
    ),
    clientOnboardingReadinessRepository: {
      getByClientId: jest.fn(),
      getByClientIds: jest.fn(),
      upsert: jest.fn(),
      recordEvent: jest.fn(),
    },
  })
);

const clientId = '123e4567-e89b-12d3-a456-426614174000';
const otherClientId = '123e4567-e89b-12d3-a456-426614174001';

const query = jest.fn();
const repo = clientOnboardingReadinessRepository as jest.Mocked<
  typeof clientOnboardingReadinessRepository
>;
const getCardOnFileStatus =
  customerPaymentMethodService.getCardOnFileStatus as jest.Mock;

function gatesRow(overrides: Record<string, unknown> = {}) {
  return {
    payment_method: 'Self-Pay',
    qbo_customer_id: 'qb-cust-1',
    contract_signed: true,
    installment_deposit_paid: true,
    legacy_deposit_paid: false,
    ...overrides,
  };
}

function readinessRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'readiness-1',
    client_id: clientId,
    contract_signed: true,
    deposit_paid: true,
    billing_path: 'self_pay',
    payment_authorization_required: true,
    payment_authorization_satisfied: true,
    card_on_file: true,
    qb_customer_id: 'qb-cust-1',
    qb_stored_payment_method_id: 'pm-1',
    is_eligible: true,
    portal_blockers: [],
    primary_portal_blocker: null,
    verification_invoice_id: null,
    verification_invoice_sent_at: null,
    verification_invoice_paid_at: null,
    eligibility_last_computed_at: null,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function card(onFile: boolean, reference: string | null = null) {
  return { on_file: onFile, payment_method_reference: reference };
}

beforeEach(() => {
  jest.clearAllMocks();
  (getPool as jest.Mock).mockReturnValue({ query });
  repo.upsert.mockImplementation(async (params) =>
    readinessRow({
      ...params,
      id: 'readiness-1',
      portal_blockers: params.portal_blockers,
    })
  );
  repo.recordEvent.mockResolvedValue(undefined);
});

describe('PortalEligibilityService characterization', () => {
  const service = new PortalEligibilityService();

  describe('getOnboardingGates', () => {
    it('queries contracts, deposit installments, and legacy payments with domain constants', async () => {
      query.mockResolvedValue({ rows: [gatesRow()] });

      await service.getOnboardingGates(clientId);

      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM public.phi_clients');
      expect(sql).toContain('FROM public.phi_contracts');
      expect(sql).toContain('FROM public.payment_installments');
      expect(sql).toContain('FROM public.payments');
      expect(params).toEqual([
        clientId,
        ['paid', 'succeeded', 'completed'],
        'signed',
        'deposit',
      ]);
    });

    it('maps a self-pay client with a paid deposit installment', async () => {
      query.mockResolvedValue({ rows: [gatesRow()] });

      await expect(service.getOnboardingGates(clientId)).resolves.toEqual({
        contract_signed: true,
        deposit_paid: true,
        billing_path: 'self_pay',
        qb_customer_id: 'qb-cust-1',
        payment_method: 'Self-Pay',
      });
    });

    it('does not count a legacy payment when the installment check is false', async () => {
      query.mockResolvedValue({
        rows: [
          gatesRow({
            installment_deposit_paid: false,
            legacy_deposit_paid: true,
          }),
        ],
      });

      const gates = await service.getOnboardingGates(clientId);
      expect(gates.deposit_paid).toBe(false);
    });

    it('returns empty gates when the client row is missing', async () => {
      query.mockResolvedValue({ rows: [] });

      await expect(service.getOnboardingGates(clientId)).resolves.toEqual({
        contract_signed: false,
        deposit_paid: false,
        billing_path: 'unknown',
        qb_customer_id: null,
        payment_method: null,
      });
    });
  });

  describe('computeAndPersist', () => {
    it('persists a newly eligible self-pay client and records an unlock', async () => {
      repo.getByClientId.mockResolvedValue(null);
      query.mockResolvedValue({ rows: [gatesRow()] });
      getCardOnFileStatus.mockResolvedValue(card(true, 'pm-1'));

      const snapshot = await service.computeAndPersist(clientId);

      expect(getCardOnFileStatus).toHaveBeenCalledWith(clientId);
      expect(repo.upsert).toHaveBeenCalledWith({
        client_id: clientId,
        contract_signed: true,
        deposit_paid: true,
        billing_path: 'self_pay',
        payment_authorization_required: true,
        payment_authorization_satisfied: true,
        card_on_file: true,
        qb_customer_id: 'qb-cust-1',
        qb_stored_payment_method_id: 'pm-1',
        is_eligible: true,
        portal_blockers: [],
        primary_portal_blocker: null,
        verification_invoice_id: null,
        verification_invoice_sent_at: null,
        verification_invoice_paid_at: null,
      });
      expect(repo.recordEvent.mock.calls).toEqual([
        [
          {
            client_id: clientId,
            event_type: 'portal_eligibility_computed',
            event_source: 'portal_eligibility_service',
            payload: {
              is_eligible: true,
              portal_blockers: [],
              primary_portal_blocker: null,
            },
          },
        ],
        [
          {
            client_id: clientId,
            event_type: 'portal_unlocked',
            event_source: 'portal_eligibility_service',
          },
        ],
      ]);
      expect(snapshot).toMatchObject({
        is_eligible: true,
        billing_path: 'self_pay',
        allowed_actions: {
          can_invite_to_portal: true,
          can_mark_contract_signed: false,
          can_mark_deposit_paid: false,
        },
      });
    });

    it('records a lock with the primary blocker when an eligible client loses the card', async () => {
      repo.getByClientId.mockResolvedValue(readinessRow());
      query.mockResolvedValue({ rows: [gatesRow()] });
      getCardOnFileStatus.mockResolvedValue(card(false));

      const snapshot = await service.computeAndPersist(clientId, {
        event_source: 'quickbooks_webhook',
      });

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          is_eligible: false,
          card_on_file: false,
          payment_authorization_satisfied: false,
          portal_blockers: ['missing_card_on_file'],
          primary_portal_blocker: 'missing_card_on_file',
          qb_stored_payment_method_id: null,
        })
      );
      expect(repo.recordEvent.mock.calls.map(([event]) => event)).toEqual([
        {
          client_id: clientId,
          event_type: 'portal_eligibility_computed',
          event_source: 'quickbooks_webhook',
          payload: {
            is_eligible: false,
            portal_blockers: ['missing_card_on_file'],
            primary_portal_blocker: 'missing_card_on_file',
          },
        },
        {
          client_id: clientId,
          event_type: 'portal_locked',
          event_source: 'quickbooks_webhook',
          payload: { primary_portal_blocker: 'missing_card_on_file' },
        },
      ]);
      expect(snapshot.allowed_actions.can_invite_to_portal).toBe(false);
    });

    it('records only the computed event when eligibility does not change', async () => {
      repo.getByClientId.mockResolvedValue(readinessRow());
      query.mockResolvedValue({ rows: [gatesRow()] });
      getCardOnFileStatus.mockResolvedValue(card(true, 'pm-1'));

      await service.computeAndPersist(clientId);

      expect(repo.recordEvent).toHaveBeenCalledTimes(1);
      expect(repo.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: 'portal_eligibility_computed' })
      );
    });

    it('applies force flags over the queried contract and deposit facts', async () => {
      repo.getByClientId.mockResolvedValue(null);
      query.mockResolvedValue({
        rows: [
          gatesRow({
            contract_signed: false,
            installment_deposit_paid: false,
          }),
        ],
      });
      getCardOnFileStatus.mockResolvedValue(card(true, 'pm-1'));

      await service.computeAndPersist(clientId, {
        force_contract_signed: true,
        force_deposit_paid: true,
      });

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          contract_signed: true,
          deposit_paid: true,
          is_eligible: true,
          portal_blockers: [],
        })
      );
    });

    it('lets a false force flag override a true queried fact', async () => {
      repo.getByClientId.mockResolvedValue(null);
      query.mockResolvedValue({ rows: [gatesRow()] });
      getCardOnFileStatus.mockResolvedValue(card(true, 'pm-1'));

      await service.computeAndPersist(clientId, {
        force_deposit_paid: false,
      });

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          deposit_paid: false,
          portal_blockers: ['deposit_unpaid'],
          primary_portal_blocker: 'deposit_unpaid',
        })
      );
    });

    it('prefers option verification invoice fields, then existing row values', async () => {
      repo.getByClientId.mockResolvedValue(
        readinessRow({
          verification_invoice_id: 'inv-old',
          verification_invoice_sent_at: '2026-09-01T00:00:00.000Z',
          verification_invoice_paid_at: '2026-09-02T00:00:00.000Z',
        })
      );
      query.mockResolvedValue({ rows: [gatesRow()] });
      getCardOnFileStatus.mockResolvedValue(card(true, 'pm-1'));

      await service.computeAndPersist(clientId, {
        verification_invoice_id: 'inv-new',
      });

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          verification_invoice_id: 'inv-new',
          verification_invoice_sent_at: '2026-09-01T00:00:00.000Z',
          verification_invoice_paid_at: '2026-09-02T00:00:00.000Z',
        })
      );
    });

    it('treats Medicaid as eligible without a card or client deposit', async () => {
      repo.getByClientId.mockResolvedValue(null);
      query.mockResolvedValue({
        rows: [
          gatesRow({
            payment_method: 'Medicaid',
            installment_deposit_paid: false,
          }),
        ],
      });
      getCardOnFileStatus.mockResolvedValue(card(false));

      const snapshot = await service.computeAndPersist(clientId);

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          billing_path: 'medicaid',
          payment_authorization_required: false,
          payment_authorization_satisfied: true,
          is_eligible: true,
        })
      );
      expect(snapshot.is_eligible).toBe(true);
    });
  });

  describe('getPortalEligibilityBatch', () => {
    it('does not query when given no client ids', async () => {
      const result = await service.getPortalEligibilityBatch(['', '']);

      expect(result.size).toBe(0);
      expect(repo.getByClientIds).not.toHaveBeenCalled();
    });

    it('reads cached rows once and returns the cache-miss snapshot for missing clients', async () => {
      repo.getByClientIds.mockResolvedValue(
        new Map([[clientId, readinessRow()]])
      );

      const result = await service.getPortalEligibilityBatch([
        clientId,
        otherClientId,
        clientId,
      ]);

      expect(repo.getByClientIds).toHaveBeenCalledWith([
        clientId,
        otherClientId,
      ]);
      expect(query).not.toHaveBeenCalled();
      expect(getCardOnFileStatus).not.toHaveBeenCalled();
      expect(result.get(clientId)).toMatchObject({
        is_eligible: true,
        allowed_actions: { can_invite_to_portal: true },
      });
      expect(result.get(otherClientId)).toMatchObject({
        is_eligible: false,
        portal_blockers: ['billing_path_unknown'],
        primary_portal_blocker: 'billing_path_unknown',
        allowed_actions: {
          can_invite_to_portal: false,
          can_mark_contract_signed: true,
          can_mark_deposit_paid: false,
        },
      });
    });
  });

  describe('getInviteEligibility', () => {
    it('returns the domain blocker message when not eligible', async () => {
      repo.getByClientId.mockResolvedValue(null);
      query.mockResolvedValue({
        rows: [gatesRow({ contract_signed: false })],
      });
      getCardOnFileStatus.mockResolvedValue(card(true, 'pm-1'));

      const result = await service.getInviteEligibility(clientId);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(
        'Invite available after contract is signed and deposit is paid.'
      );
      expect(result.snapshot?.primary_portal_blocker).toBe('contract_unsigned');
    });

    it('returns eligible with the snapshot', async () => {
      repo.getByClientId.mockResolvedValue(null);
      query.mockResolvedValue({ rows: [gatesRow()] });
      getCardOnFileStatus.mockResolvedValue(card(true, 'pm-1'));

      const result = await service.getInviteEligibility(clientId);

      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.snapshot?.is_eligible).toBe(true);
    });

    it('wraps lookup failures with the invite eligibility prefix', async () => {
      repo.getByClientId.mockRejectedValue(new Error('db down'));

      await expect(service.getInviteEligibility(clientId)).rejects.toThrow(
        'Failed to check invite eligibility: db down'
      );
    });
  });
});
