// src/features/quickbooks/utils/qboClient.ts

import dotenv from 'dotenv';
dotenv.config();

import fetch, { RequestInit } from 'node-fetch';
import { getTokenFromDatabase, refreshQuickBooksToken } from './tokenUtils';

const {
  QB_CLIENT_ID = '',
  QB_CLIENT_SECRET = '',
  QBO_ENV = 'production'
} = process.env;

interface AccessTokenResult {
  accessToken: string;
  realmId: string;
}

/**
 * Retrieve (and refresh, if needed) the current OAuth tokens & realm ID.
 */
export async function getAccessToken(): Promise<AccessTokenResult> {
  const tokens = await getTokenFromDatabase();
  if (!tokens) {
    throw new Error('No QuickBooks tokens found');
  }

  // Check if token is expired or will expire in the next minute
  if (new Date(tokens.expiresAt) <= new Date(Date.now() + 60000)) {
    const newTokens = await refreshQuickBooksToken(tokens.refreshToken);
    return {
      accessToken: newTokens.accessToken,
      realmId: newTokens.realmId
    };
  }

  return {
    accessToken: tokens.accessToken,
    realmId: tokens.realmId
  };
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
