export const DEFAULT_ISOLATED_ADMIN_EMAIL = 'hello@sokanacollective.com';
export const DEFAULT_ISOLATED_ADMIN_NAME = 'Test Admin';
export const LEGACY_ISOLATED_ADMIN_EMAIL =
  'hello+isolated@sokanacollective.com';
export const DEFAULT_PILOT_CLIENT_EMAIL =
  'hello+pilot.client@sokanacollective.com';
export const DEFAULT_PILOT_CLIENT_FIRST_NAME = 'Maya';
export const DEFAULT_PILOT_CLIENT_LAST_NAME = 'Tester';

export function resolveIsolatedAdminEmail(raw?: string | null): string {
  const email = String(raw || DEFAULT_ISOLATED_ADMIN_EMAIL)
    .trim()
    .toLowerCase();
  if (!email.includes('@')) {
    throw new Error('DEV_ENV_ADMIN_EMAIL must be a valid email');
  }
  return email;
}

export function isolatedAdminRow(input: {
  email: string;
  uid: string;
  fullName?: string;
}): {
  email: string;
  identity_platform_uid: string;
  full_name: string;
  first_name: string;
  last_name: string;
} {
  const fullName = input.fullName?.trim() || DEFAULT_ISOLATED_ADMIN_NAME;
  return {
    email: resolveIsolatedAdminEmail(input.email),
    identity_platform_uid: input.uid,
    full_name: fullName,
    first_name: fullName,
    last_name: '',
  };
}

export function isolatedPilotClientRow(input: {
  email?: string;
  uid?: string | null;
}): {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  status: string;
  portal_status: string;
  payment_method: string;
  service_needed: string;
  health_notes: string;
  identity_platform_uid: string | null;
  user_id: string | null;
} {
  const email = resolveIsolatedAdminEmail(
    input.email || DEFAULT_PILOT_CLIENT_EMAIL
  );
  const uid = input.uid?.trim() || null;
  return {
    email,
    first_name: DEFAULT_PILOT_CLIENT_FIRST_NAME,
    last_name: DEFAULT_PILOT_CLIENT_LAST_NAME,
    phone: '555-010-0101',
    status: 'matching',
    portal_status: uid ? 'active' : 'not_invited',
    payment_method: 'Self-Pay',
    service_needed: 'Labor Support Services',
    health_notes: 'Pilot practice client. Not a real patient.',
    identity_platform_uid: uid,
    user_id: uid,
  };
}
