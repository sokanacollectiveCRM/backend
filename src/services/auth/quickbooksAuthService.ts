// src/features/quickbooks/services/auth/quickbooksAuthService.ts

import OAuthClient from 'intuit-oauth';
import { saveTokens, TokenStore } from '../../utils/tokenUtils';

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
 * Handle the Intuit callback, exchange code for tokens, persist them, and return.
 */
export async function handleAuthCallback(callbackUrl: string): Promise<TokenStore> {
  // throws if Intuit returns an error
  const authResponse = await oauthClient.createToken(callbackUrl);
  const json = authResponse.getJson();

  const tokens: TokenStore = {
    realmId:      json.realmId,
    accessToken:  json.access_token,
    refreshToken: json.refresh_token,
    expiresAt:    new Date(Date.now() + json.expires_in * 1000).toISOString()
  };

  await saveTokens(tokens);
  return tokens;
}
