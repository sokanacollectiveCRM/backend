// src/features/quickbooks/utils/tokenUtils.ts
// QuickBooks OAuth tokens are stored in Google Cloud SQL (public.quickbooks_tokens), not Supabase.
import { getPool } from '../db/cloudSqlPool';

export interface TokenStore {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
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

  const tokens = await getTokenFromDatabase();
  if (!tokens) {
    console.log('❌ [QB] No tokens to refresh');
    return null;
  }

  const url = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
  const auth = Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken
  });

  console.log('📤 [QB] Making refresh request to:', url);

  try {
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
      console.error('❌ [QB] Refresh failed:', resp.status, errorText);

      // Parse error response to check for invalid_grant
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // If parsing fails, use the raw text
      }

      // If token is invalid (invalid_grant), delete the stored tokens
      // This allows the user to reconnect with a new authorization
      if (errorData.error === 'invalid_grant' || resp.status === 400) {
        console.warn('⚠️ [QB] Token is invalid (invalid_grant). Deleting stored tokens to allow reconnection...');
        try {
          await deleteTokens();
          console.log('✅ [QB] Invalid tokens deleted successfully');
        } catch (deleteError) {
          console.error('❌ [QB] Failed to delete invalid tokens:', deleteError);
        }
      }

      throw new Error(`Failed to refresh token: ${resp.status}`);
    }

    const json = await resp.json() as { access_token: string; refresh_token: string; expires_in: number };
    console.log('✅ [QB] Refresh successful, expires in:', json.expires_in, 'seconds');

    const tokenData: TokenStore = {
      realmId: tokens.realmId,
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString()
    };

    console.log('💾 [QB] Saving refreshed tokens...');
    await saveTokensToDatabase(tokenData);
    console.log('✅ [QB] Refreshed tokens saved successfully');

    return tokenData;
  } catch (error: any) {
    console.error('❌ [QB] Error refreshing token:', error);

    // If the error indicates invalid token, try to clean up
    if (error?.message?.includes('invalid_grant') || error?.message?.includes('400')) {
      console.warn('⚠️ [QB] Detected invalid token error. Attempting to clean up...');
      try {
        await deleteTokens();
        console.log('✅ [QB] Cleaned up invalid tokens');
      } catch (deleteError) {
        console.error('❌ [QB] Failed to clean up tokens:', deleteError);
      }
    }

    return null;
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
