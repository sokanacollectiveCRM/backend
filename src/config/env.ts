/**
 * Centralized environment and feature flags.
 * Reads env vars once; feature flags control which integrations are enabled.
 * Use requireEnv/optionalEnv for conditional validation.
 */

const raw = process.env;

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------
export const NODE_ENV = raw.NODE_ENV || 'development';
export const PORT = parseInt(raw.PORT || '8080', 10);
export const HOST = raw.HOST || '0.0.0.0';

export const IS_PRODUCTION = NODE_ENV === 'production';

// ---------------------------------------------------------------------------
// Feature flags (explicit opt-in; default false for optional integrations)
// ---------------------------------------------------------------------------
export const FEATURE_STRIPE =
  raw.FEATURE_STRIPE === 'true' || raw.FEATURE_STRIPE === '1';
export const FEATURE_QUICKBOOKS =
  raw.FEATURE_QUICKBOOKS === 'true' || raw.FEATURE_QUICKBOOKS === '1';
export const FEATURE_EMAIL =
  raw.FEATURE_EMAIL === 'true' || raw.FEATURE_EMAIL === '1';
export const ENABLE_DEBUG_ENDPOINTS =
  raw.ENABLE_DEBUG_ENDPOINTS === 'true' && !IS_PRODUCTION;

// ---------------------------------------------------------------------------
// Required (always)
// ---------------------------------------------------------------------------
export function requireEnv(name: string): string {
  const v = raw[name];
  if (!v || String(v).trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(v).trim();
}

// ---------------------------------------------------------------------------
// Optional (returns undefined if missing)
// ---------------------------------------------------------------------------
export function optionalEnv(
  name: string,
  defaultValue?: string
): string | undefined {
  const v = raw[name];
  if (v === undefined || v === '' || String(v).trim() === '') {
    return defaultValue;
  }
  return String(v).trim();
}

// ---------------------------------------------------------------------------
// Require only when feature is enabled
// ---------------------------------------------------------------------------
export function requireEnvIfEnabled(
  feature: boolean,
  name: string
): string | undefined {
  if (!feature) return undefined;
  return requireEnv(name);
}

// ---------------------------------------------------------------------------
// Resolved config (lazy — only when needed)
// ---------------------------------------------------------------------------
export const supabase = {
  get url(): string {
    return requireEnv('SUPABASE_URL');
  },
  get serviceRoleKey(): string {
    return requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  },
  get anonKey(): string {
    return optionalEnv('SUPABASE_ANON_KEY') ?? '';
  },
};

export const phiBroker = {
  get url(): string {
    return optionalEnv('PHI_BROKER_URL') ?? '';
  },
  get secret(): string {
    return (
      optionalEnv('PHI_BROKER_SECRET') ??
      optionalEnv('PHI_BROKER_SHARED_SECRET') ??
      ''
    );
  },
};

export const stripe = {
  get secretKey(): string {
    if (!FEATURE_STRIPE) return '';
    return requireEnv('STRIPE_SECRET_KEY');
  },
  get webhookSecret(): string {
    if (!FEATURE_STRIPE) return '';
    return optionalEnv('STRIPE_WEBHOOK_SECRET') ?? '';
  },
};

/** SignNow event-subscription HMAC secret (X-SignNow-Signature). */
export const signNowWebhook = {
  get secret(): string {
    return (
      optionalEnv('SIGNNOW_WEBHOOK_SECRET') ??
      optionalEnv('SIGNNOW_BASIC_AUTH_TOKEN') ??
      ''
    );
  },
};

/** Intuit webhook verifier token (intuit-signature HMAC). */
export const quickBooksWebhook = {
  get verifierToken(): string {
    return (
      optionalEnv('QB_WEBHOOK_VERIFIER_TOKEN') ??
      optionalEnv('INTUIT_WEBHOOK_VERIFIER_TOKEN') ??
      ''
    );
  },
};

export const contractNotifications = {
  get fromEmail(): string {
    return (
      optionalEnv('CONTRACT_NOTIFICATION_FROM_EMAIL') ??
      'hello@sokanacollective.com'
    );
  },
  get billingEmail(): string {
    return (
      optionalEnv('BILLING_NOTIFICATION_EMAIL') ??
      'billing@sokanacollective.com'
    );
  },
  get billingViewPathTemplate(): string {
    return (
      optionalEnv('BILLING_CONTRACT_VIEW_PATH_TEMPLATE') ??
      '/billing/contracts/:contractId'
    );
  },
  get frontendUrl(): string {
    return optionalEnv('FRONTEND_URL') ?? 'http://localhost:3001';
  },
  get signedAdminNotificationEmail(): string {
    return (
      optionalEnv('CONTRACT_SIGNED_ADMIN_NOTIFICATION_EMAIL') ??
      optionalEnv('CONTRACT_SIGNED_COPY_INTERNAL_EMAIL') ??
      'hello@sokanacollective.com'
    );
  },
};

function positiveIntegerEnv(name: string, fallback: number): number {
  const value = Number.parseInt(optionalEnv(name) ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Provider-neutral contract signing configuration. */
export const nativeContracts = {
  get enabled(): boolean {
    const value = (
      optionalEnv('NATIVE_CONTRACTS_ENABLED') ?? 'false'
    ).toLowerCase();
    return value === 'true' || value === '1';
  },
  get signingBaseUrl(): string {
    return (
      optionalEnv('CONTRACT_SIGNING_BASE_URL') ??
      `${contractNotifications.frontendUrl}/signing`
    ).replace(/\/+$/, '');
  },
  get invitationTtlHours(): number {
    return positiveIntegerEnv('CONTRACT_INVITATION_TTL_HOURS', 72);
  },
  get pdfUrlTtlSeconds(): number {
    return positiveIntegerEnv('CONTRACT_PDF_URL_TTL_SECONDS', 300);
  },
  get rateLimitHmacSecret(): string {
    const value = optionalEnv('SIGNING_RATE_LIMIT_HMAC_SECRET');
    if (value) return value;
    if (IS_PRODUCTION) {
      throw new Error(
        'Missing required environment variable: SIGNING_RATE_LIMIT_HMAC_SECRET'
      );
    }
    return 'local-native-contract-rate-limit-secret';
  },
  get rateLimitAttempts(): number {
    return positiveIntegerEnv('SIGNING_RATE_LIMIT_ATTEMPTS', 30);
  },
  get rateLimitWindowSeconds(): number {
    return positiveIntegerEnv('SIGNING_RATE_LIMIT_WINDOW_SECONDS', 60);
  },
  get drawnSignatureMaxBytes(): number {
    return positiveIntegerEnv('CONTRACT_DRAWN_SIGNATURE_MAX_BYTES', 256 * 1024);
  },
  get outboxPollMs(): number {
    return positiveIntegerEnv('CONTRACT_OUTBOX_POLL_MS', 5000);
  },
  get outboxEnabled(): boolean {
    const value = (
      optionalEnv('CONTRACT_OUTBOX_ENABLED') ?? 'false'
    ).toLowerCase();
    return value === 'true' || value === '1';
  },
  get outboxLeaseSeconds(): number {
    return positiveIntegerEnv('CONTRACT_OUTBOX_LEASE_SECONDS', 60);
  },
  get outboxBatchSize(): number {
    return positiveIntegerEnv('CONTRACT_OUTBOX_BATCH_SIZE', 10);
  },
  get outboxMaxAttempts(): number {
    return positiveIntegerEnv('CONTRACT_OUTBOX_MAX_ATTEMPTS', 10);
  },
};

/** PR 8 intake feature-package cutover / shadow window. */
export const intakeFeature = {
  get useFeaturePackage(): boolean {
    const raw = optionalEnv('INTAKE_USE_FEATURE_PACKAGE');
    return raw === 'true' || raw === '1';
  },
  get shadowCompare(): boolean {
    const raw = optionalEnv('INTAKE_SHADOW_COMPARE');
    return raw === 'true' || raw === '1';
  },
};

/** Private GCS documents bucket (templates, client/doula docs, contracts). */
export const gcsDocuments = {
  get bucket(): string {
    return optionalEnv('GCS_DOCUMENTS_BUCKET') ?? 'sokana-private-documents';
  },
};

/** Auth IdP cutover: supabase (default) | identity_platform | dual */
export const authProvider = {
  get mode(): 'supabase' | 'identity_platform' | 'dual' {
    const raw = (optionalEnv('AUTH_PROVIDER') ?? 'supabase').toLowerCase();
    if (raw === 'identity_platform' || raw === 'dual') return raw;
    return 'supabase';
  },
  get identityProjectId(): string {
    return (
      optionalEnv('IDENTITY_PLATFORM_PROJECT_ID') ??
      optionalEnv('GCLOUD_PROJECT') ??
      optionalEnv('GOOGLE_CLOUD_PROJECT') ??
      'sokana-private-data'
    );
  },
};

// CORS: comma-separated FRONTEND_ORIGIN or legacy vars
export function getAllowedOrigins(): string[] {
  const fromOrigin = (optionalEnv('FRONTEND_ORIGIN') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const legacy = [
    optionalEnv('CORS_ORIGIN'),
    optionalEnv('FRONTEND_URL'),
    optionalEnv('FRONTEND_URL_DEV'),
  ].filter(Boolean) as string[];
  // Include Vite (5173) and preview (4173) so CRM frontend can call API from npm run dev / preview.
  const dev = IS_PRODUCTION
    ? []
    : [
        'http://localhost:3001',
        'http://localhost:3000',
        'http://localhost:3002',
        'http://localhost:5050',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:4173',
        'http://127.0.0.1:4173',
      ];
  const explicit = [...fromOrigin, ...legacy, ...dev];
  return [...new Set(explicit)];
}
