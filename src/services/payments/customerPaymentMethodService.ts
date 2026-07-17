import {
  isPaymentAuthorizationRequired,
  resolveBillingPath,
} from '../../constants/portalEligibility';
import { getPool } from '../../db/cloudSqlPool';
import {
  ClientPaymentMethodRow,
  clientPaymentMethodRepository,
} from '../../repositories/cloudSqlPaymentMethodRepository';
import ensureCustomerInQuickBooks from './ensureCustomerInQuickBooks';
import {
  QuickBooksPaymentsError,
  createQuickBooksCardOnFile,
  normalizeSavedCardResponse,
} from './quickbooksPaymentsClient';

export interface SaveClientPaymentMethodInput {
  client_id: string;
  intuit_token: string;
  request_id: string;
}

export interface ClientPaymentMethodResponse {
  client_id: string;
  quickbooks_customer_id: string;
  provider_payment_method_reference: string;
  card_brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CardOnFileStatus {
  required: boolean;
  on_file: boolean;
  status: 'active' | 'missing' | 'expired' | 'inactive' | 'not_required';
  quickbooks_customer_id: string | null;
  payment_method_reference: string | null;
  card_brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  last_verified_at: string | null;
}

export class PaymentMethodServiceError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, statusCode: number, message: string) {
    super(message);
    this.name = 'PaymentMethodServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function toIso(value: string | Date): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function mapRow(row: ClientPaymentMethodRow): ClientPaymentMethodResponse {
  return {
    client_id: row.client_id,
    quickbooks_customer_id: row.quickbooks_customer_id,
    provider_payment_method_reference: row.provider_payment_method_reference,
    card_brand: row.card_brand,
    last4: row.last4,
    exp_month: row.exp_month,
    exp_year: row.exp_year,
    status: row.status,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function normalizeServiceError(error: unknown): PaymentMethodServiceError {
  if (error instanceof QuickBooksPaymentsError) {
    switch (error.code) {
      case 'invalid_token':
        return new PaymentMethodServiceError(
          'invalid_token',
          400,
          'Intuit token is invalid'
        );
      case 'expired_token':
        return new PaymentMethodServiceError(
          'expired_token',
          400,
          'Intuit token has expired'
        );
      case 'duplicate_request':
        return new PaymentMethodServiceError(
          'duplicate_request',
          409,
          'Duplicate payment method request'
        );
      case 'provider_timeout':
        return new PaymentMethodServiceError(
          'provider_timeout',
          504,
          'QuickBooks Payments request timed out'
        );
      case 'quickbooks_not_connected':
        return new PaymentMethodServiceError(
          'quickbooks_not_connected',
          503,
          'QuickBooks is not connected'
        );
      case 'provider_save_failure':
      default:
        return new PaymentMethodServiceError(
          'provider_save_failure',
          error.statusCode || 502,
          error.message
        );
    }
  }
  if (error instanceof PaymentMethodServiceError) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : 'Unknown payment method error';
  if (message.includes('Customer not found')) {
    return new PaymentMethodServiceError(
      'client_not_found',
      404,
      'Client not found'
    );
  }
  if (message.includes('QuickBooks is not connected')) {
    return new PaymentMethodServiceError(
      'quickbooks_not_connected',
      503,
      'QuickBooks is not connected'
    );
  }
  if (message.includes('failed to persist')) {
    return new PaymentMethodServiceError(
      'database_persistence_failure',
      500,
      'Failed to persist payment method metadata'
    );
  }

  return new PaymentMethodServiceError(
    'provider_save_failure',
    500,
    'Failed to save client payment method'
  );
}

export class CustomerPaymentMethodService {
  async savePaymentMethod(
    input: SaveClientPaymentMethodInput
  ): Promise<ClientPaymentMethodResponse> {
    try {
      const quickbooksCustomerId = await ensureCustomerInQuickBooks(
        input.client_id
      );
      const qboCard = await createQuickBooksCardOnFile({
        quickbooksCustomerId,
        intuitToken: input.intuit_token,
        requestId: input.request_id,
      });
      const normalized = normalizeSavedCardResponse(qboCard);
      const row = await clientPaymentMethodRepository.upsert({
        client_id: input.client_id,
        quickbooks_customer_id: quickbooksCustomerId,
        provider_payment_method_reference:
          normalized.provider_payment_method_reference,
        card_brand: normalized.card_brand,
        last4: normalized.last4,
        exp_month: normalized.exp_month,
        exp_year: normalized.exp_year,
        status: normalized.status,
      });
      return mapRow(row);
    } catch (error) {
      throw normalizeServiceError(error);
    }
  }

  async getPaymentMethod(
    clientId: string
  ): Promise<ClientPaymentMethodResponse | null> {
    try {
      const row = await clientPaymentMethodRepository.getByClientId(clientId);
      return row ? mapRow(row) : null;
    } catch (error) {
      throw normalizeServiceError(error);
    }
  }

  async getCardOnFileStatus(clientId: string): Promise<CardOnFileStatus> {
    try {
      const { rows } = await getPool().query<{
        payment_method: string | null;
        qbo_customer_id: string | null;
      }>(
        `SELECT payment_method, qbo_customer_id FROM public.phi_clients WHERE id = $1::uuid LIMIT 1`,
        [clientId]
      );
      const client = rows[0];
      if (!client)
        throw new PaymentMethodServiceError(
          'client_not_found',
          404,
          'Client not found'
        );

      const required = isPaymentAuthorizationRequired(
        resolveBillingPath(client.payment_method)
      );
      if (!required) {
        return {
          required: false,
          on_file: false,
          status: 'not_required',
          quickbooks_customer_id: client.qbo_customer_id,
          payment_method_reference: null,
          card_brand: null,
          last4: null,
          exp_month: null,
          exp_year: null,
          last_verified_at: null,
        };
      }

      const row = await clientPaymentMethodRepository.getByClientId(clientId);
      if (!row) {
        return {
          required: true,
          on_file: false,
          status: 'missing',
          quickbooks_customer_id: client.qbo_customer_id,
          payment_method_reference: null,
          card_brand: null,
          last4: null,
          exp_month: null,
          exp_year: null,
          last_verified_at: null,
        };
      }

      const providerStatus = String(row.status || '').toLowerCase();
      const now = new Date();
      const expired =
        row.exp_year < now.getUTCFullYear() ||
        (row.exp_year === now.getUTCFullYear() &&
          row.exp_month < now.getUTCMonth() + 1);
      const active = providerStatus === 'active' && !expired;
      const status: CardOnFileStatus['status'] = expired
        ? 'expired'
        : active
          ? 'active'
          : 'inactive';
      return {
        required: true,
        on_file: active,
        status,
        quickbooks_customer_id:
          client.qbo_customer_id ?? row.quickbooks_customer_id,
        payment_method_reference: row.provider_payment_method_reference,
        card_brand: row.card_brand,
        last4: row.last4,
        exp_month: row.exp_month,
        exp_year: row.exp_year,
        last_verified_at: toIso(row.updated_at),
      };
    } catch (error) {
      throw normalizeServiceError(error);
    }
  }
}

export const customerPaymentMethodService = new CustomerPaymentMethodService();
