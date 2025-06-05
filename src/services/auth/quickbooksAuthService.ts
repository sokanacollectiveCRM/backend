// src/features/quickbooks/services/auth/quickbooksAuthService.ts

import OAuthClient from 'intuit-oauth';
import { URL } from 'url';
import {
    deleteTokens,
    getTokens,
    saveTokens,
    TokenStore
} from '../../utils/tokenUtils';

const {
  QB_CLIENT_ID     = '',
  QB_CLIENT_SECRET = '',
  QB_REDIRECT_URI  = '',
  QBO_ENV          = 'production'
} = process.env;

const oauthClient = new OAuthClient({
  clientId:     QB_CLIENT_ID,
  clientSecret: QB_CLIENT_SECRET,
  environment:  QBO_ENV === 'sandbox' ? 'sandbox' : 'production',
  redirectUri:  QB_REDIRECT_URI
});

/**
 * Build the Intuit consent URL.
 */
export function generateConsentUrl(state: string): string {
  return oauthClient.authorizeUri({
    scope: [ OAuthClient.scopes.Accounting ],
    state
  });
}

/**
 * Handle Intuit's callback:
 *   1) Exchange the code for tokens
 *   2) Extract realmId (from the JSON or the URL query)
 *   3) Persist tokens
 *   4) Return them
 */
export async function handleAuthCallback(
  callbackUrl: string
): Promise<Omit<TokenStore, 'userId'>> {
  // Exchange code for tokens
  const authResponse = await oauthClient.createToken(callbackUrl);
  const json = authResponse.getJson() as {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
    realmId?:      string;
  };

  // Intuit sometimes returns realmId in JSON or URL query
  const realmId = json.realmId ?? new URL(callbackUrl).searchParams.get('realmId');

  if (!realmId) {
    throw new Error('Missing realmId in QuickBooks callback');
  }

  // Build TokenStore
  const tokens: TokenStore = {
    realmId,
    accessToken:  json.access_token,
    refreshToken: json.refresh_token,
    expiresAt:    new Date(Date.now() + json.expires_in * 1000).toISOString()
  };

  // Persist tokens
  await saveTokens(tokens);
  return tokens;
}

/**
 * Check if connected (tokens exist & are not expired).
 * If tokens are expired, attempt to refresh them.
 */
export async function isConnected(): Promise<boolean> {
  console.log('🔍 [QB Auth] Checking if QuickBooks is connected...');
  
  const tokens = await getTokens();
  if (!tokens) {
    console.log('❌ [QB Auth] No tokens found - not connected');
    return false;
  }
  
  const now = new Date();
  const expiresAt = new Date(tokens.expiresAt);
  const isExpired = expiresAt <= now;
  
  console.log('⏰ [QB Auth] Current time:', now.toISOString());
  console.log('📅 [QB Auth] Token expires at:', expiresAt.toISOString());
  console.log('🔍 [QB Auth] Token expired?', isExpired);
  
  if (isExpired) {
    console.log('🔄 [QB Auth] Token expired, attempting refresh...');
    // Import and use getValidAccessToken which handles refresh
    const { getValidAccessToken } = await import('../../utils/tokenUtils');
    const validToken = await getValidAccessToken();
    const refreshSuccessful = !!validToken;
    console.log('📊 [QB Auth] Refresh successful?', refreshSuccessful);
    return refreshSuccessful;
  }
  
  console.log('📊 [QB Auth] Connected? true (token valid)');
  return true;
}

/**
 * Disconnect QuickBooks by deleting stored tokens.
 */
export async function disconnectQuickBooks(): Promise<void> {
  await deleteTokens();
}

