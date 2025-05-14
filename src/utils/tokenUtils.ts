// src/features/quickbooks/utils/tokenUtils.ts
import supabase from '../supabase'

export interface TokenStore {
  realmId:      string
  accessToken:  string
  refreshToken: string
  expiresAt:    string
}

/**
 * Load the QuickBooks OAuth tokens & realm ID.
 */
export async function loadTokens(): Promise<TokenStore> {
  const { data, error } = await supabase
    .from('quickbooks_tokens')
    .select('realm_id, access_token, refresh_token, expires_at')
    .single()

  if (error || !data) {
    throw new Error(`Could not load QuickBooks tokens: ${error?.message}`)
  }

  return {
    realmId:      data.realm_id,
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    data.expires_at,
  }
}

/**
 * Safe read: returns null if no row or on error.
 */
export async function getTokens(): Promise<TokenStore | null> {
  try {
    return await loadTokens()
  } catch {
    return null
  }
}

/**
 * Persist updated QuickBooks OAuth tokens & expiry.
 */
export async function saveTokens(tokens: TokenStore): Promise<void> {
  const { realmId, accessToken, refreshToken, expiresAt } = tokens

  const { error } = await supabase
    .from('quickbooks_tokens')
    .upsert(
      {
        realm_id:     realmId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at:   expiresAt,
        updated_at:   new Date().toISOString(),
      },
      { onConflict: 'realm_id' }
    )

  if (error) {
    throw new Error(`Failed to save QuickBooks tokens: ${error.message}`)
  }
}

/**
 * Delete all QuickBooks OAuth tokens.
 */
export async function deleteTokens(): Promise<void> {
  const { error } = await supabase
    .from('quickbooks_tokens')
    .delete()

  if (error) {
    throw new Error(`Failed to delete QuickBooks tokens: ${error.message}`)
  }
}
