import { getPool } from '../../../db/cloudSqlPool';
import {
  OnboardingFactRecord,
  OnboardingFactsReader,
} from '../application/ports';
import {
  DEPOSIT_PAYMENT_TYPE,
  PAID_INSTALLMENT_STATUSES,
  SIGNED_CONTRACT_STATUS,
} from '../domain/eligibility';

export class CloudSqlOnboardingFactsReader implements OnboardingFactsReader {
  async read(clientId: string): Promise<OnboardingFactRecord | null> {
    const { rows } = await getPool().query<{
      payment_method: string | null;
      qbo_customer_id: string | null;
      contract_signed: boolean | null;
      installment_deposit_paid: boolean | null;
      legacy_deposit_paid: boolean | null;
    }>(
      `
      WITH client_row AS (
        SELECT payment_method, qbo_customer_id
        FROM public.phi_clients
        WHERE id = $1::uuid
        LIMIT 1
      ),
      signed_contract AS (
        SELECT EXISTS (
          SELECT 1
          FROM public.phi_contracts
          WHERE client_id = $1::uuid
            AND status = $3
        ) AS contract_signed
      ),
      deposit_installment AS (
        SELECT EXISTS (
          SELECT 1
          FROM public.payment_installments pi
          JOIN public.payment_schedules ps ON ps.id = pi.schedule_id
          JOIN public.phi_contracts pc ON pc.id = ps.contract_id
          WHERE pc.client_id = $1::uuid
            AND COALESCE(pi.payment_type, '') = $4
            AND LOWER(COALESCE(pi.status, '')) = ANY($2::text[])
        ) AS deposit_paid
      ),
      legacy_payment AS (
        SELECT EXISTS (
          SELECT 1
          FROM public.payments
          WHERE client_id = $1::uuid
        ) AS deposit_paid
      )
      SELECT
        cr.payment_method,
        cr.qbo_customer_id,
        sc.contract_signed,
        di.deposit_paid AS installment_deposit_paid,
        lp.deposit_paid AS legacy_deposit_paid
      FROM client_row cr
      CROSS JOIN signed_contract sc
      CROSS JOIN deposit_installment di
      CROSS JOIN legacy_payment lp
      `,
      [
        clientId,
        [...PAID_INSTALLMENT_STATUSES],
        SIGNED_CONTRACT_STATUS,
        DEPOSIT_PAYMENT_TYPE,
      ]
    );

    const row = rows[0];
    if (!row) return null;
    return {
      hasSignedContract: row.contract_signed,
      installmentDepositPaid: row.installment_deposit_paid,
      legacyPaymentExists: row.legacy_deposit_paid,
      paymentMethod: row.payment_method,
      qbCustomerId: row.qbo_customer_id,
    };
  }
}
