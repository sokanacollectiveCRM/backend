"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveTokens = exports.getTokens = void 0;
exports.getTokenFromDatabase = getTokenFromDatabase;
exports.refreshQuickBooksToken = refreshQuickBooksToken;
exports.getValidAccessToken = getValidAccessToken;
exports.saveTokensToDatabase = saveTokensToDatabase;
exports.deleteTokens = deleteTokens;
// src/features/quickbooks/utils/tokenUtils.ts
const supabase_1 = __importDefault(require("../supabase"));
/**
 * Load the QuickBooks OAuth tokens.
 */
async function getTokenFromDatabase() {
    console.log('🔍 [QB] Loading tokens from database...');
    const { data, error } = await supabase_1.default
        .from('quickbooks_tokens')
        .select('realm_id, access_token, refresh_token, expires_at')
        .single();
    if (error) {
        if (error.code === 'PGRST116') { // no rows found
            console.log('❌ [QB] No tokens found in database');
            return null;
        }
        console.error('❌ [QB] Database error loading tokens:', error.message);
        throw new Error(`Could not load QuickBooks tokens: ${error.message}`);
    }
    const tokens = {
        realmId: data.realm_id,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
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
async function refreshQuickBooksToken() {
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
            throw new Error(`Failed to refresh token: ${resp.status}`);
        }
        const json = await resp.json();
        console.log('✅ [QB] Refresh successful, expires in:', json.expires_in, 'seconds');
        const tokenData = {
            realmId: tokens.realmId,
            accessToken: json.access_token,
            refreshToken: json.refresh_token,
            expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString()
        };
        console.log('💾 [QB] Saving refreshed tokens...');
        await saveTokensToDatabase(tokenData);
        console.log('✅ [QB] Refreshed tokens saved successfully');
        return tokenData;
    }
    catch (error) {
        console.error('❌ [QB] Error refreshing token:', error);
        return null;
    }
}
/**
 * Get a valid access token, refreshing if necessary.
 * Returns null if no token exists or refresh fails.
 */
async function getValidAccessToken() {
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
 * Save QuickBooks tokens to the database.
 */
async function saveTokensToDatabase(tokens) {
    console.log('💾 [QB] Saving tokens to database...');
    const { error } = await supabase_1.default
        .from('quickbooks_tokens')
        .upsert({
        realm_id: tokens.realmId,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
        updated_at: new Date().toISOString(),
    });
    if (error) {
        console.error('❌ [QB] Failed to save tokens:', error.message);
        throw new Error(`Failed to save QuickBooks tokens: ${error.message}`);
    }
    console.log('✅ [QB] Tokens saved successfully');
}
/** Delete QuickBooks tokens */
async function deleteTokens() {
    console.log('🗑️ [QB] Deleting tokens...');
    const { error } = await supabase_1.default
        .from('quickbooks_tokens')
        .delete()
        .gt('realm_id', ''); // Delete all rows where realm_id > '' (which means all rows)
    if (error) {
        console.error('❌ [QB] Failed to delete tokens:', error.message);
        throw new Error(`Failed to delete QuickBooks tokens: ${error.message}`);
    }
    console.log('✅ [QB] Tokens deleted successfully');
}
// Add these exports for the QuickBooks service
exports.getTokens = getTokenFromDatabase;
exports.saveTokens = saveTokensToDatabase;
