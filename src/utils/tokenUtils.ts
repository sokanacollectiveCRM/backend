// src/features/quickbooks/utils/tokenUtils.ts
import supabase from '../supabase';

export interface TokenStore {
  userId: string;
  realmId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

/**
 * Load the QuickBooks OAuth tokens for a specific user.
 */
export async function getTokenFromDatabase(userId: string): Promise<TokenStore | null> {
  const { data, error } = await supabase
    .from('quickbooks_tokens')
    .select('user_id, realm_id, access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // no rows found
      return null;
    }
    throw new Error(`Could not load QuickBooks tokens: ${error.message}`);
  }

  return {
    userId: data.user_id,
    realmId: data.realm_id,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  };
}

/**
 * Refresh QuickBooks access token using the refresh token.
 */
export async function refreshQuickBooksToken(userId: string, refreshToken: string): Promise<TokenStore> {
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
  const existingToken = await getTokenFromDatabase(userId);
  if (!existingToken) {
    throw new Error('No existing token found for user');
  }

  const tokenData: TokenStore = {
    userId,
    realmId: existingToken.realmId,
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString()
  };

  await saveTokensToDatabase(userId, tokenData);
  return tokenData;
}

/**
 * Save QuickBooks tokens to the database for a specific user.
 */
export async function saveTokensToDatabase(userId: string, tokens: TokenStore): Promise<void> {
  const { error } = await supabase
    .from('quickbooks_tokens')
    .upsert({
      user_id: userId,
      realm_id: tokens.realmId,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    throw new Error(`Failed to save QuickBooks tokens: ${error.message}`);
  }
}

/**
 * Get a valid access token for a user, refreshing if necessary.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const tokens = await getTokenFromDatabase(userId);
  if (!tokens) {
    throw new Error('No QuickBooks tokens found for user');
  }

  // Check if token is expired or will expire in the next minute
  if (new Date(tokens.expiresAt) <= new Date(Date.now() + 60000)) {
    const newTokens = await refreshQuickBooksToken(userId, tokens.refreshToken);
    return newTokens.accessToken;
  }

  return tokens.accessToken;
}

/** Delete QuickBooks tokens for a specific user */
export async function deleteUserTokens(userId: string): Promise<void> {
  const { error } = await supabase
    .from('quickbooks_tokens')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete QuickBooks tokens: ${error.message}`);
  }
}
