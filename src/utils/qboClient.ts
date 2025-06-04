// src/features/quickbooks/utils/qboClient.ts

import dotenv from 'dotenv';
dotenv.config();

import { Buffer } from 'buffer';
import fetch, { RequestInit } from 'node-fetch';
import { loadTokens, saveTokens } from './tokenUtils';

const {
  QB_CLIENT_ID = '',
  QB_CLIENT_SECRET = '',
  QBO_ENV = 'production'
} = process.env;

interface TokenStore {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

interface AccessTokenResult {
  accessToken: string;
  realmId: string;
}

/**
 * Retrieve (and refresh, if needed) the current OAuth tokens & realm ID.
 */
export async function getAccessToken(): Promise<AccessTokenResult> {
  let { accessToken, refreshToken, expiresAt, realmId } =
    (await loadTokens()) as TokenStore;

  if (new Date() >= new Date(expiresAt)) {
    const url = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const auth = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString('base64');
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

    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`Failed to refresh token: ${resp.status} — ${text}`);
    }

    const json = JSON.parse(text);
    accessToken = json.access_token;
    refreshToken = json.refresh_token;
    expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();

    await saveTokens({ realmId, accessToken, refreshToken, expiresAt });
  }

  return { accessToken, realmId };
}

/**
 * Make a QuickBooks Online API request.
 * @param path    e.g. '/customer?minorversion=65'
 * @param options fetch options (method, body, headers, etc.)
 */
export async function qboRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { accessToken, realmId } = await getAccessToken();

  const host = QBO_ENV === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';

  const url = `${host}/v3/company/${realmId}${path}`;
  console.log('QBO URL →', url);

  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>)
    }
  });

  if (!resp.ok) {
    // define the shape of a QuickBooks error
    type QboError = {
      Fault?: {
        Error?: Array<{ Message: string }>;
      };
    };
    // cast the parsed JSON to that type
    const errBody = (await resp.json().catch(() => ({}))) as QboError;
    const msg = errBody.Fault?.Error?.[0]?.Message ?? resp.statusText;
    throw new Error(`QBO ${resp.status}: ${msg}`);
  }

  return resp.json() as Promise<T>;
}
