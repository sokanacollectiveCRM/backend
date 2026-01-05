import { SupabaseClient } from '@supabase/supabase-js';

export interface InviteEligibility {
  eligible: boolean;
  reason?: string;
  contractSignedAt?: Date;
  firstPaymentPaidAt?: Date;
}

export class PortalEligibilityService {
  private supabaseClient: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabaseClient = supabaseClient;
  }

  /**
   * Check if a client is eligible for portal invite
   * Eligibility requires:
   * 1. Contract status = 'signed'
   * 2. First payment (deposit) status = 'succeeded'
   */
  async getInviteEligibility(clientId: string): Promise<InviteEligibility> {
    try {
      // Step 1: Find signed contract for this client
      const { data: contract, error: contractError } = await this.supabaseClient
        .from('contracts')
        .select('id, status, updated_at')
        .eq('client_id', clientId)
        .eq('status', 'signed')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (contractError) {
        console.error(`Error checking contract for client ${clientId}:`, contractError);
        throw new Error(`Failed to check contract status: ${contractError.message}`);
      }

      if (!contract) {
        return {
          eligible: false,
          reason: 'Invite available after contract is signed and first payment is completed.'
        };
      }

      const contractSignedAt = contract.updated_at ? new Date(contract.updated_at) : undefined;

      // Step 2: Find first payment (deposit) that succeeded
      const { data: payment, error: paymentError } = await this.supabaseClient
        .from('contract_payments')
        .select('id, status, completed_at, payment_type')
        .eq('contract_id', contract.id)
        .eq('payment_type', 'deposit')
        .eq('status', 'succeeded')
        .order('completed_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (paymentError) {
        console.error(`Error checking payment for contract ${contract.id}:`, paymentError);
        throw new Error(`Failed to check payment status: ${paymentError.message}`);
      }

      if (!payment) {
        return {
          eligible: false,
          reason: 'Invite available after contract is signed and first payment is completed.',
          contractSignedAt
        };
      }

      const firstPaymentPaidAt = payment.completed_at ? new Date(payment.completed_at) : undefined;

      // Both conditions met
      return {
        eligible: true,
        contractSignedAt,
        firstPaymentPaidAt
      };
    } catch (error: any) {
      console.error(`Error checking eligibility for client ${clientId}:`, error);
      throw new Error(`Failed to check invite eligibility: ${error.message}`);
    }
  }
}
