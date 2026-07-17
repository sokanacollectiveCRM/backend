// src/features/quickbooks/utils/tokenUtils.ts
// QuickBooks OAuth tokens are stored in Google Cloud SQL (public.quickbooks_tokens), not Supabase.
import { getPool } from '../db/cloudSqlPool';

export interface TokenStore {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface QuickBooksConnectionHealth {
  status: 'connected' | 'refresh_failed' | 'reauthorization_required';
  lastRefreshFailedAt: string | null;
  lastRefreshSucceededAt: string | null;
}

const QB_ENVIRONMENT = process.env.QUICKBOOKS_ENVIRONMENT || 'production';

/**
 * Load the QuickBooks OAuth tokens from Cloud SQL.
 */
export async function getTokenFromDatabase(): Promise<TokenStore | null> {
  console.log('🔍 [QB] Loading tokens from Cloud SQL...');

  const pool = getPool();
  const { rows } = await pool.query<{
    realm_id: string;
    access_token: string;
    refresh_token: string;
    access_token_expires_at: Date | null;
  }>(
    `SELECT realm_id, access_token, refresh_token, access_token_expires_at
     FROM public.quickbooks_tokens
     WHERE environment = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [QB_ENVIRONMENT]
  );

  if (!rows.length) {
    console.log('❌ [QB] No tokens found in database');
    return null;
  }

  const row = rows[0];
  const expiresAt = row.access_token_expires_at
    ? new Date(row.access_token_expires_at).toISOString()
    : new Date(0).toISOString();

  const tokens: TokenStore = {
    realmId: row.realm_id,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt,
  };

  console.log('✅ [QB] Tokens loaded successfully');
  console.log('📅 [QB] Token expires at:', tokens.expiresAt);
  console.log('⏰ [QB] Current time:', new Date().toISOString());
  console.log('🔍 [QB] Token expired?', new Date(tokens.expiresAt) <= new Date());

  return tokens;
}

/**
 * Refresh QuickBooks access token using the refresh token.
 * Returns the new access token or null if refresh fails.
 */
export async function refreshQuickBooksToken(): Promise<TokenStore | null> {
  console.log('🔄 [QB] Starting token refresh...');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    // Vercel may run several instances. Only one may rotate the current refresh token.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
      [`quickbooks-token-refresh:${QB_ENVIRONMENT}`]
    );
    const { rows } = await client.query<{
      realm_id: string;
      access_token: string;
      refresh_token: string;
      access_token_expires_at: Date | null;
    }>(
      `SELECT realm_id, access_token, refresh_token, access_token_expires_at
       FROM public.quickbooks_tokens
       WHERE environment = $1
       ORDER BY updated_at DESC
       LIMIT 1
       FOR UPDATE`,
      [QB_ENVIRONMENT]
    );
    const row = rows[0];
    if (!row) {
      await client.query('COMMIT');
      console.log('❌ [QB] No tokens to refresh');
      return null;
    }

    // Another request may have refreshed while this request waited for the lock.
    const expiresAt = row.access_token_expires_at?.getTime() ?? 0;
    if (expiresAt > Date.now() + 60000) {
      await client.query('COMMIT');
      return {
        realmId: row.realm_id,
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        expiresAt: row.access_token_expires_at!.toISOString(),
      };
    }

    const url = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const auth = Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
    });
    console.log('📤 [QB] Making serialized refresh request to:', url);
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    console.log('📥 [QB] Refresh response status:', resp.status);

    if (!resp.ok) {
      const errorText = await resp.text();
      let errorData: { error?: string; error_description?: string } = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // Keep the public error generic when Intuit does not return JSON.
      }
      const needsReauthorization = errorData.error === 'invalid_grant';
      const status = needsReauthorization ? 'reauthorization_required' : 'refresh_failed';
      const safeError = `${errorData.error || `http_${resp.status}`}${errorData.error_description ? `: ${errorData.error_description}` : ''}`.slice(0, 500);
      await client.query(
        `UPDATE public.quickbooks_tokens
         SET connection_status = $2,
             last_refresh_error = $3,
             last_refresh_failed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE realm_id = $1 AND environment = $4`,
        [row.realm_id, status, safeError, QB_ENVIRONMENT]
      );
      await client.query('COMMIT');
      console.error('❌ [QB] Refresh failed; token retained:', resp.status, status);
      return null;
    }

    const json = await resp.json() as { access_token: string; refresh_token?: string; expires_in: number };
    console.log('✅ [QB] Refresh successful, expires in:', json.expires_in, 'seconds');

    const tokenData: TokenStore = {
      realmId: row.realm_id,
      accessToken: json.access_token,
      refreshToken: json.refresh_token || row.refresh_token,
      expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString()
    };

    await client.query(
      `UPDATE public.quickbooks_tokens
       SET access_token = $2,
           refresh_token = $3,
           access_token_expires_at = $4,
           connection_status = 'connected',
           last_refresh_error = NULL,
           last_refresh_failed_at = NULL,
           last_refresh_succeeded_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE realm_id = $1 AND environment = $5`,
      [tokenData.realmId, tokenData.accessToken, tokenData.refreshToken, tokenData.expiresAt, QB_ENVIRONMENT]
    );
    await client.query('COMMIT');
    console.log('✅ [QB] Refreshed tokens saved successfully');

    return tokenData;
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('❌ [QB] Error refreshing token:', error);
    return null;
  } finally {
    client.release();
  }
}

/**
 * Get a valid access token, refreshing if necessary.
 * Returns null if no token exists or refresh fails.
 */
export async function getValidAccessToken(): Promise<string | null> {
  console.log('🎯 [QB] Getting valid access token...');

  const tokens = await getTokenFromDatabase();
  if (!tokens) {
    console.log('❌ [QB] No tokens available');
    return null;
  }

  const now = Date.now();
  const expiresAt = new Date(tokens.expiresAt).getTime();
  const timeUntilExpiry = expiresAt - now;

  console.log('⏱️ [QB] Time until expiry:', Math.round(timeUntilExpiry / 1000), 'seconds');

  // Check if token is expired or will expire in the next minute
  if (new Date(tokens.expiresAt) <= new Date(Date.now() + 60000)) {
    console.log('🔄 [QB] Token expired or expiring soon, refreshing...');
    const refreshed = await refreshQuickBooksToken();
    return refreshed ? refreshed.accessToken : null;
  }

  console.log('✅ [QB] Using existing valid token');
  return tokens.accessToken;
}

/**
 * Save QuickBooks tokens to Cloud SQL (upsert by realm_id + environment).
 */
export async function saveTokensToDatabase(tokens: TokenStore): Promise<void> {
  console.log('💾 [QB] Saving tokens to Cloud SQL...');

  const pool = getPool();
  const expiresAt = new Date(tokens.expiresAt);

  await pool.query(
    `INSERT INTO public.quickbooks_tokens (realm_id, access_token, refresh_token, access_token_expires_at, updated_at, environment)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
     ON CONFLICT (realm_id, environment)
     DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       access_token_expires_at = EXCLUDED.access_token_expires_at,
       connection_status = 'connected',
       last_refresh_error = NULL,
       last_refresh_failed_at = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [tokens.realmId, tokens.accessToken, tokens.refreshToken, expiresAt, QB_ENVIRONMENT]
  );

  console.log('✅ [QB] Tokens saved successfully');
}

/** Delete QuickBooks tokens from Cloud SQL (all rows for current environment). */
export async function deleteTokens(): Promise<void> {
  console.log('🗑️ [QB] Deleting tokens from Cloud SQL...');

  const pool = getPool();
  const { rowCount } = await pool.query(
    'DELETE FROM public.quickbooks_tokens WHERE environment = $1',
    [QB_ENVIRONMENT]
  );

  console.log('✅ [QB] Tokens deleted successfully', rowCount != null ? `(${rowCount} row(s))` : '');
}

// Add these exports for the QuickBooks service
export const getTokens = getTokenFromDatabase;
export const saveTokens = saveTokensToDatabase;

export async function getQuickBooksConnectionHealth(): Promise<QuickBooksConnectionHealth | null> {
  const { rows } = await getPool().query<{
    connection_status: QuickBooksConnectionHealth['status'];
    last_refresh_failed_at: Date | null;
    last_refresh_succeeded_at: Date | null;
  }>(
    `SELECT connection_status, last_refresh_failed_at, last_refresh_succeeded_at
     FROM public.quickbooks_tokens
     WHERE environment = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [QB_ENVIRONMENT]
  );
  if (!rows[0]) return null;
  return {
    status: rows[0].connection_status,
    lastRefreshFailedAt: rows[0].last_refresh_failed_at?.toISOString() || null,
    lastRefreshSucceededAt: rows[0].last_refresh_succeeded_at?.toISOString() || null,
  };
}
