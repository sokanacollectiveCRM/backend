import { Response } from 'express';

import { ClientController } from '../controllers/clientController';
import { ClientRepository } from '../repositories/interface/clientRepository';
import { SupabaseAssignmentRepository } from '../repositories/supabaseAssignmentRepository';
import { AuthRequest, ROLE } from '../types';
import { ClientUseCase } from '../usecase/clientUseCase';

jest.mock('../repositories/supabaseAssignmentRepository');
jest.mock('../usecase/clientUseCase');

describe('GET /api/clients readiness fields', () => {
  it('includes readiness badges and action gating fields in the list response', async () => {
    const clientId = 'client-1';
    const clientUseCase = {
      getClientsLite: jest.fn().mockResolvedValue([
        {
          id: clientId,
          clientNumber: 'C-100',
          status: 'active',
          serviceNeeded: 'Birth Support',
          portal_status: 'not_invited',
          updatedAt: new Date('2026-07-08T12:00:00.000Z'),
          user: {
            firstname: 'Jane',
            lastname: 'Doe',
            email: 'jane@example.com',
          },
        },
      ]),
    } as unknown as jest.Mocked<ClientUseCase>;

    const controller = new ClientController(
      clientUseCase,
      {} as jest.Mocked<SupabaseAssignmentRepository>,
      {} as jest.Mocked<ClientRepository>
    );

    (controller as any).eligibilityService = {
      getPortalEligibilityBatch: jest.fn().mockResolvedValue(
        new Map([
          [
            clientId,
            {
              is_eligible: false,
              portal_blockers: ['missing_card_on_file'],
              primary_portal_blocker: 'missing_card_on_file',
              billing_path: 'insurance',
              payment_authorization_required: true,
              payment_authorization_satisfied: false,
              card_on_file: false,
              qb_customer_id: 'qb-cust-1',
              qb_stored_payment_method_id: null,
              verification_invoice_id: null,
              verification_invoice_sent_at: null,
              verification_invoice_paid_at: null,
              contract_signed: true,
              deposit_paid: true,
              allowed_actions: {
                can_invite_to_portal: false,
                can_mark_contract_signed: false,
                can_mark_deposit_paid: false,
              },
            },
          ],
        ])
      ),
    };

    const req = {
      user: { id: 'admin-1', role: ROLE.ADMIN },
      query: {},
    } as unknown as AuthRequest;

    const res = {
      set: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      headersSent: false,
    } as unknown as Response;

    await controller.getClients(req, res);

    expect(clientUseCase.getClientsLite).toHaveBeenCalledWith(
      'admin-1',
      ROLE.ADMIN
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [
        expect.objectContaining({
          id: clientId,
          is_eligible: false,
          portal_blockers: ['missing_card_on_file'],
          primary_portal_blocker: 'missing_card_on_file',
          billing_path: 'insurance',
          payment_authorization_required: true,
          payment_authorization_satisfied: false,
          card_on_file: false,
          allowed_actions: {
            can_invite_to_portal: false,
            can_mark_contract_signed: false,
            can_mark_deposit_paid: false,
          },
        }),
      ],
      meta: { count: 1 },
    });
  });
});
