import { getPool } from '../db/cloudSqlPool';

export interface ClientPaymentMethodRow {
  client_id: string;
  quickbooks_customer_id: string;
  provider_payment_method_reference: string;
  card_brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface UpsertClientPaymentMethodParams {
  client_id: string;
  quickbooks_customer_id: string;
  provider_payment_method_reference: string;
  card_brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  status: string;
}

export class CloudSqlPaymentMethodRepository {
  async getByClientId(clientId: string): Promise<ClientPaymentMethodRow | null> {
    const { rows } = await getPool().query<ClientPaymentMethodRow>(
      `
      SELECT
        client_id,
        quickbooks_customer_id,
        provider_payment_method_reference,
        card_brand,
        last4,
        exp_month,
        exp_year,
        status,
        created_at,
        updated_at
      FROM public.client_payment_methods
      WHERE client_id = $1::uuid
      LIMIT 1
      `,
      [clientId]
    );

    return rows[0] ?? null;
  }

  async upsert(params: UpsertClientPaymentMethodParams): Promise<ClientPaymentMethodRow> {
    const { rows } = await getPool().query<ClientPaymentMethodRow>(
      `
      INSERT INTO public.client_payment_methods (
        client_id,
        quickbooks_customer_id,
        provider_payment_method_reference,
        card_brand,
        last4,
        exp_month,
        exp_year,
        status
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (client_id)
      DO UPDATE SET
        quickbooks_customer_id = EXCLUDED.quickbooks_customer_id,
        provider_payment_method_reference = EXCLUDED.provider_payment_method_reference,
        card_brand = EXCLUDED.card_brand,
        last4 = EXCLUDED.last4,
        exp_month = EXCLUDED.exp_month,
        exp_year = EXCLUDED.exp_year,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        client_id,
        quickbooks_customer_id,
        provider_payment_method_reference,
        card_brand,
        last4,
        exp_month,
        exp_year,
        status,
        created_at,
        updated_at
      `,
      [
        params.client_id,
        params.quickbooks_customer_id,
        params.provider_payment_method_reference,
        params.card_brand,
        params.last4,
        params.exp_month,
        params.exp_year,
        params.status,
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new Error('Failed to persist client payment method');
    }

    return row;
  }
}

export const clientPaymentMethodRepository = new CloudSqlPaymentMethodRepository();
