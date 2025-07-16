"use strict";
// src/features/quickbooks/services/auth/quickbooksAuthService.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateConsentUrl = generateConsentUrl;
exports.handleAuthCallback = handleAuthCallback;
exports.isConnected = isConnected;
exports.disconnectQuickBooks = disconnectQuickBooks;
const intuit_oauth_1 = __importDefault(require("intuit-oauth"));
const url_1 = require("url");
const tokenUtils_1 = require("../../utils/tokenUtils");
const { QB_CLIENT_ID = '', QB_CLIENT_SECRET = '', QB_REDIRECT_URI = '', QBO_ENV = 'production' } = process.env;
const oauthClient = new intuit_oauth_1.default({
    clientId: QB_CLIENT_ID,
    clientSecret: QB_CLIENT_SECRET,
    environment: QBO_ENV === 'sandbox' ? 'sandbox' : 'production',
    redirectUri: QB_REDIRECT_URI
});
/**
 * Build the Intuit consent URL.
 */
function generateConsentUrl(state) {
    return oauthClient.authorizeUri({
        scope: [intuit_oauth_1.default.scopes.Accounting],
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
async function handleAuthCallback(callbackUrl) {
    // Exchange code for tokens
    const authResponse = await oauthClient.createToken(callbackUrl);
    const json = authResponse.getJson();
    // Intuit sometimes returns realmId in JSON or URL query
    const realmId = json.realmId ?? new url_1.URL(callbackUrl).searchParams.get('realmId');
    if (!realmId) {
        throw new Error('Missing realmId in QuickBooks callback');
    }
    // Build TokenStore
    const tokens = {
        realmId,
        accessToken: json.access_token,
        refreshToken: json.refresh_token,
        expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString()
    };
    // Persist tokens
    await (0, tokenUtils_1.saveTokens)(tokens);
    return tokens;
}
/**
 * Check if connected (tokens exist & are not expired).
 * If tokens are expired, attempt to refresh them.
 */
async function isConnected() {
    console.log('🔍 [QB Auth] Checking if QuickBooks is connected...');
    const tokens = await (0, tokenUtils_1.getTokens)();
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
        const { getValidAccessToken } = await Promise.resolve().then(() => __importStar(require('../../utils/tokenUtils')));
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
async function disconnectQuickBooks() {
    await (0, tokenUtils_1.deleteTokens)();
}
