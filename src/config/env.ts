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
export const FEATURE_STRIPE = raw.FEATURE_STRIPE === 'true' || raw.FEATURE_STRIPE === '1';
export const FEATURE_QUICKBOOKS = raw.FEATURE_QUICKBOOKS === 'true' || raw.FEATURE_QUICKBOOKS === '1';
export const FEATURE_EMAIL = raw.FEATURE_EMAIL === 'true' || raw.FEATURE_EMAIL === '1';
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
export function optionalEnv(name: string, defaultValue?: string): string | undefined {
  const v = raw[name];
  if (v === undefined || v === '' || String(v).trim() === '') {
    return defaultValue;
  }
  return String(v).trim();
}

// ---------------------------------------------------------------------------
// Require only when feature is enabled
// ---------------------------------------------------------------------------
export function requireEnvIfEnabled(feature: boolean, name: string): string | undefined {
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
    return optionalEnv('PHI_BROKER_SECRET') ?? optionalEnv('PHI_BROKER_SHARED_SECRET') ?? '';
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
  const dev = IS_PRODUCTION ? [] : ['http://localhost:3001', 'http://localhost:3000', 'http://localhost:3002', 'http://localhost:5050'];
  const explicit = [...fromOrigin, ...legacy, ...dev];
  // Production fallback: allow known deploy URLs when no env vars set
  const prodDefaults = IS_PRODUCTION && explicit.length === 0
    ? ['https://sokanacrm.vercel.app', 'https://crmbackend-six-wine.vercel.app']
    : [];
  return [...new Set([...explicit, ...prodDefaults])];
}
