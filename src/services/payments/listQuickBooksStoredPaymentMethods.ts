import { getValidAccessToken } from '../../utils/tokenUtils';

export interface QuickBooksStoredPaymentMethod {
  id: string;
  status?: string;
  cardType?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
}

export class QuickBooksStoredPaymentMethodsError extends Error {}

function getPaymentsBaseUrl(): string {
  const env = (
    process.env.QBO_ENV ||
    process.env.QUICKBOOKS_ENVIRONMENT ||
    'production'
  ).toLowerCase();
  return env === 'sandbox'
    ? 'https://sandbox.api.intuit.com/quickbooks/v4/payments'
    : 'https://api.intuit.com/quickbooks/v4/payments';
}

function normalizeCardEntry(
  entry: Record<string, unknown>
): QuickBooksStoredPaymentMethod | null {
  const card = (entry.card as Record<string, unknown> | undefined) ?? entry;
  const id = String(entry.id ?? card.id ?? '').trim();
  if (!id) {
    return null;
  }

  const expMonth = Number(
    entry.expMonth ?? card.expMonth ?? entry.exp_month ?? card.exp_month
  );
  const expYear = Number(
    entry.expYear ?? card.expYear ?? entry.exp_year ?? card.exp_year
  );
  const maskedNumber = String(entry.number ?? card.number ?? '');
  return {
    id,
    status: String(entry.status ?? card.status ?? 'ACTIVE'),
    cardType:
      String(entry.cardType ?? card.cardType ?? card.brand ?? '').trim() ||
      undefined,
    last4:
      String(
        entry.last4 ?? card.last4 ?? maskedNumber.replace(/\D/g, '').slice(-4)
      ).trim() || undefined,
    expMonth:
      Number.isInteger(expMonth) && expMonth >= 1 && expMonth <= 12
        ? expMonth
        : undefined,
    expYear: Number.isInteger(expYear) && expYear >= 1 ? expYear : undefined,
  };
}

function extractCards(payload: unknown): QuickBooksStoredPaymentMethod[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const root = payload as Record<string, unknown>;
  const candidates = [
    root,
    root.data,
    (root.data as Record<string, unknown> | undefined)?.cards,
    root.cards,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
        .map((item) => normalizeCardEntry(item as Record<string, unknown>))
        .filter((item): item is QuickBooksStoredPaymentMethod => item != null);
    }
  }

  const single = normalizeCardEntry(root);
  return single ? [single] : [];
}

export async function listQuickBooksStoredPaymentMethods(
  quickbooksCustomerId: string
): Promise<QuickBooksStoredPaymentMethod[]> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw new QuickBooksStoredPaymentMethodsError(
      'QuickBooks access is unavailable'
    );
  }

  const url = `${getPaymentsBaseUrl()}/customers/${encodeURIComponent(quickbooksCustomerId)}/cards`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new QuickBooksStoredPaymentMethodsError(
        `QuickBooks stored-card lookup failed with status ${response.status}`
      );
    }

    const payload = await response.json().catch(() => ({}));
    return extractCards(payload);
  } catch (error) {
    if (error instanceof QuickBooksStoredPaymentMethodsError) throw error;
    throw new QuickBooksStoredPaymentMethodsError(
      error instanceof Error && error.name === 'AbortError'
        ? 'QuickBooks stored-card lookup timed out'
        : 'QuickBooks stored-card lookup failed'
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPrimaryQuickBooksStoredPaymentMethod(
  quickbooksCustomerId: string
): Promise<QuickBooksStoredPaymentMethod | null> {
  try {
    const methods =
      await listQuickBooksStoredPaymentMethods(quickbooksCustomerId);
    return (
      methods.find((method) =>
        ['ACTIVE', 'VERIFIED'].includes(
          String(method.status || '').toUpperCase()
        )
      ) ?? null
    );
  } catch {
    return null;
  }
}
