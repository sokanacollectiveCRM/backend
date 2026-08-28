/**
 * Lazy Firebase Admin init for GCP Identity Platform token verification.
 * Uses Application Default Credentials on Cloud Run / local gcloud ADC.
 */
import admin from 'firebase-admin';

import { optionalEnv } from '../../config/env';

let initialized = false;

export function getIdentityPlatformProjectId(): string {
  return (
    optionalEnv('IDENTITY_PLATFORM_PROJECT_ID') ??
    optionalEnv('GCLOUD_PROJECT') ??
    optionalEnv('GOOGLE_CLOUD_PROJECT') ??
    'sokana-private-data'
  );
}

export function isIdentityPlatformConfigured(): boolean {
  const provider = (optionalEnv('AUTH_PROVIDER') ?? 'supabase').toLowerCase();
  return (
    provider === 'identity_platform' ||
    provider === 'dual' ||
    optionalEnv('IDENTITY_PLATFORM_PROJECT_ID') !== undefined
  );
}

export function getAuthProviderMode():
  | 'supabase'
  | 'identity_platform'
  | 'dual' {
  const raw = (optionalEnv('AUTH_PROVIDER') ?? 'supabase').toLowerCase();
  if (raw === 'identity_platform' || raw === 'dual') return raw;
  return 'supabase';
}

export function getFirebaseAuth(): admin.auth.Auth {
  if (!initialized) {
    const projectId = getIdentityPlatformProjectId();
    if (admin.apps.length === 0) {
      admin.initializeApp({ projectId });
    }
    initialized = true;
  }
  return admin.auth();
}
