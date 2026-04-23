import { getValidAccessToken } from '../../utils/tokenUtils';

export interface CreateQuickBooksCardOnFileParams {
  quickbooksCustomerId: string;
  intuitToken: string;
  requestId: string;
}

export interface QuickBooksCardOnFileResponse {
  id?: string;
  status?: string;
  cardType?: string;
  brand?: string;
  last4?: string;
  expMonth?: number | string;
  expYear?: number | string;
  card?: {
    id?: string;
    status?: string;
    cardType?: string;
    brand?: string;
    last4?: string;
    expMonth?: number | string;
    expYear?: number | string;
    number?: string;
  };
}

export class QuickBooksPaymentsError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, statusCode: number, message: string) {
    super(message);
    this.name = 'QuickBooksPaymentsError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function getPaymentsBaseUrl(): string {
  const env = (process.env.QBO_ENV || process.env.QUICKBOOKS_ENVIRONMENT || 'production').toLowerCase();
  return env === 'sandbox'
    ? 'https://sandbox.api.intuit.com/quickbooks/v4/payments'
    : 'https://api.intuit.com/quickbooks/v4/payments';
}

function summarizeQuickBooksError(payload: unknown, statusCode: number): { code: string; message: string } {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
  const text = raw.toLowerCase();

  if (statusCode === 408 || text.includes('timeout') || text.includes('aborted') || text.includes('aborterror')) {
    return { code: 'provider_timeout', message: 'QuickBooks Payments request timed out' };
  }

  if (text.includes('expired')) {
    return { code: 'expired_token', message: 'Intuit token has expired' };
  }

  if (text.includes('token')) {
    return { code: 'invalid_token', message: 'Intuit token is invalid' };
  }

  if (statusCode === 409 || text.includes('duplicate')) {
    return { code: 'duplicate_request', message: 'Duplicate payment method request' };
  }

  if (statusCode >= 500) {
    return { code: 'provider_save_failure', message: 'QuickBooks Payments failed to save the payment method' };
  }

  return { code: 'provider_save_failure', message: 'QuickBooks Payments rejected the payment method request' };
}

function normalizeCardResponse(response: QuickBooksCardOnFileResponse): {
  provider_payment_method_reference: string;
  card_brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  status: string;
} {
  const card = response.card ?? {};
  const provider_payment_method_reference = String(response.id ?? card.id ?? '').trim();
  const rawBrand = response.cardType ?? response.brand ?? card.cardType ?? card.brand ?? '';
  const rawNumber = card.number ?? '';
  const last4 =
    String(response.last4 ?? card.last4 ?? rawNumber.replace(/\D/g, '').slice(-4)).trim() || '0000';
  const expMonth = Number(response.expMonth ?? card.expMonth ?? 0) || 0;
  const expYear = Number(response.expYear ?? card.expYear ?? 0) || 0;
  const status = String(response.status ?? card.status ?? 'ACTIVE').toUpperCase();

  if (!provider_payment_method_reference) {
    throw new QuickBooksPaymentsError(
      'provider_save_failure',
      502,
      'QuickBooks Payments did not return a payment method reference'
    );
  }

  return {
    provider_payment_method_reference,
    card_brand: rawBrand || 'unknown',
    last4,
    exp_month: expMonth,
    exp_year: expYear,
    status,
  };
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }
  return response.text().catch(() => '');
}

async function postCardOnFile(
  url: string,
  accessToken: string,
  body: Record<string, unknown>,
  requestId: string
): Promise<QuickBooksCardOnFileResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${url}?requestid=${encodeURIComponent(requestId)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await readResponseBody(response);

    if (!response.ok) {
      const { code, message } = summarizeQuickBooksError(payload, response.status);
      throw new QuickBooksPaymentsError(code, response.status, message);
    }

    return payload as QuickBooksCardOnFileResponse;
  } catch (error) {
    if (error instanceof QuickBooksPaymentsError) {
      throw error;
    }
    if ((error as { name?: string }).name === 'AbortError') {
      throw new QuickBooksPaymentsError('provider_timeout', 504, 'QuickBooks Payments request timed out');
    }
    throw new QuickBooksPaymentsError(
      'provider_save_failure',
      502,
      'QuickBooks Payments request failed'
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function createQuickBooksCardOnFile(
  params: CreateQuickBooksCardOnFileParams
): Promise<QuickBooksCardOnFileResponse> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw new QuickBooksPaymentsError(
      'quickbooks_not_connected',
      503,
      'QuickBooks is not connected'
    );
  }

  const baseUrl = `${getPaymentsBaseUrl()}/customers/${encodeURIComponent(params.quickbooksCustomerId)}/cards`;

  // Try the most direct token payload first. If Intuit expects a nested card object,
  // fall back to the alternate shape once, still using the same request ID.
  const attempts: Array<Record<string, unknown>> = [
    { token: params.intuitToken },
    { card: { token: params.intuitToken } },
  ];

  let lastError: unknown = null;
  for (const body of attempts) {
    try {
      return await postCardOnFile(baseUrl, accessToken, body, params.requestId);
    } catch (error) {
      lastError = error;
      if (!(error instanceof QuickBooksPaymentsError)) {
        break;
      }

      const retryable =
        error.code === 'invalid_token' ||
        error.code === 'expired_token' ||
        error.code === 'provider_save_failure';

      if (!retryable || body !== attempts[0]) {
        throw error;
      }
    }
  }

  if (lastError instanceof QuickBooksPaymentsError) {
    throw lastError;
  }

  throw new QuickBooksPaymentsError(
    'provider_save_failure',
    502,
    'QuickBooks Payments request failed'
  );
}

export function normalizeSavedCardResponse(response: QuickBooksCardOnFileResponse): {
  provider_payment_method_reference: string;
  card_brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  status: string;
} {
  return normalizeCardResponse(response);
}
