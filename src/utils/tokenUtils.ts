// src/features/quickbooks/utils/tokenUtils.ts
import supabase from '../supabase';

export interface TokenStore {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

/**
 * Load the QuickBooks OAuth tokens.
 */
export async function getTokenFromDatabase(): Promise<TokenStore | null> {
  const { data, error } = await supabase
    .from('quickbooks_tokens')
    .select('realm_id, access_token, refresh_token, expires_at')
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // no rows found
      return null;
    }
    throw new Error(`Could not load QuickBooks tokens: ${error.message}`);
  }

  return {
    realmId: data.realm_id,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  };
}

/**
 * Refresh QuickBooks access token using the refresh token.
 */
export async function refreshQuickBooksToken(refreshToken: string): Promise<TokenStore> {
  const url = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
  const auth = Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to refresh token: ${resp.status} — ${text}`);
  }

  const json = await resp.json();
  
  // Get the existing token data to preserve the realmId
  const existingToken = await getTokenFromDatabase();
  if (!existingToken) {
    throw new Error('No existing token found');
  }

  const tokenData: TokenStore = {
    realmId: existingToken.realmId,
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString()
  };

  await saveTokensToDatabase(tokenData);
  return tokenData;
}

/**
 * Save QuickBooks tokens to the database.
 */
export async function saveTokensToDatabase(tokens: TokenStore): Promise<void> {
  const { error } = await supabase
    .from('quickbooks_tokens')
    .upsert({
      realm_id: tokens.realmId,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Failed to save QuickBooks tokens: ${error.message}`);
  }
}

/** Delete QuickBooks tokens */
export async function deleteTokens(): Promise<void> {
  const { error } = await supabase
    .from('quickbooks_tokens')
    .delete();

  if (error) {
    throw new Error(`Failed to delete QuickBooks tokens: ${error.message}`);
  }
}

// Add these exports for the QuickBooks service
export const getTokens = getTokenFromDatabase;
export const saveTokens = saveTokensToDatabase;
