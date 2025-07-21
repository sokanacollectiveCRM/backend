'use strict';
// src/features/quickbooks/utils/qboClient.ts
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.getAccessToken = getAccessToken;
exports.qboRequest = qboRequest;
const dotenv_1 = __importDefault(require('dotenv'));
dotenv_1.default.config();
const tokenUtils_1 = require('./tokenUtils');
const { QBO_ENV = 'production' } = process.env;
/**
 * Retrieve (and refresh, if needed) the current OAuth tokens & realm ID.
 */
async function getAccessToken() {
  const tokens = await (0, tokenUtils_1.getTokenFromDatabase)();
  if (!tokens) {
    throw new Error('No QuickBooks tokens found');
  }
  // Check if token is expired or will expire in the next minute
  if (new Date(tokens.expiresAt) <= new Date(Date.now() + 60000)) {
    const newTokens = await (0, tokenUtils_1.refreshQuickBooksToken)();
    return {
      accessToken: newTokens.accessToken,
      realmId: newTokens.realmId,
    };
  }
  return {
    accessToken: tokens.accessToken,
    realmId: tokens.realmId,
  };
}
/**
 * Make a QuickBooks Online API request.
 * @param path    e.g. '/customer?minorversion=65'
 * @param options fetch options (method, body, headers, etc.)
 */
async function qboRequest(path, options = {}) {
  const { accessToken, realmId } = await getAccessToken();
  const host =
    QBO_ENV === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';
  const url = `${host}/v3/company/${realmId}${path}`;
  console.log('QBO URL →', url);
  // Use dynamic import for node-fetch
  const fetch = (
    await Promise.resolve().then(() => __importStar(require('node-fetch')))
  ).default;
  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!resp.ok) {
    // cast the parsed JSON to that type
    const errBody = await resp.json().catch(() => ({}));
    const msg = errBody.Fault?.Error?.[0]?.Message ?? resp.statusText;
    throw new Error(`QBO ${resp.status}: ${msg}`);
  }
  return resp.json();
}
