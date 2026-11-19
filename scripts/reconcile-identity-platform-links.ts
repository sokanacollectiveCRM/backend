#!/usr/bin/env npx tsx
/**
 * Reconcile existing GCP Identity Platform users to Cloud SQL principals.
 *
 * Dry-run by default. Pass --apply to persist exact, unambiguous links.
 * This script never creates auth users, changes passwords, or sends email.
 */
import 'dotenv/config';
import { Pool, PoolClient } from 'pg';

import { getFirebaseAuth } from '../src/services/identityPlatform/firebaseAdmin';

type PrincipalType = 'admin' | 'doula' | 'client';

interface Principal {
  type: PrincipalType;
  id: string;
  legacyAuthId: string | null;
  email: string | null;
  existingUid: string | null;
}

interface IdentityAccount {
  uid: string;
  email: string | null;
}

interface Match {
  principal: Principal;
  account: IdentityAccount;
  basis: 'uid' | 'email';
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizedEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() || '';
  return normalized || null;
}

async function listIdentityAccounts(): Promise<IdentityAccount[]> {
  const auth = getFirebaseAuth();
  const accounts: IdentityAccount[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    accounts.push(
      ...page.users.map((user) => ({
        uid: user.uid,
        email: normalizedEmail(user.email),
      }))
    );
    pageToken = page.pageToken;
  } while (pageToken);
  return accounts;
}

async function loadPrincipals(pool: Pool): Promise<Principal[]> {
  const { rows } = await pool.query<{
    principal_type: PrincipalType;
    id: string;
    legacy_auth_id: string | null;
    email: string | null;
    identity_platform_uid: string | null;
  }>(`
    SELECT 'admin'::text AS principal_type, id::text, id::text AS legacy_auth_id,
           lower(email) AS email, identity_platform_uid
      FROM public.admins
    UNION ALL
    SELECT 'doula'::text, id::text, id::text, lower(email), identity_platform_uid
      FROM public.doulas
    UNION ALL
    SELECT 'client'::text, id::text, user_id::text, lower(email), identity_platform_uid
      FROM public.phi_clients
  `);
  return rows.map((row) => ({
    type: row.principal_type,
    id: row.id,
    legacyAuthId: row.legacy_auth_id,
    email: normalizedEmail(row.email),
    existingUid: row.identity_platform_uid,
  }));
}

function selectMatches(
  principals: Principal[],
  accounts: IdentityAccount[]
): { matches: Match[]; ambiguous: number; conflicts: number } {
  const accountsByUid = new Map(
    accounts.map((account) => [account.uid, account])
  );
  const accountsByEmail = new Map<string, IdentityAccount>();
  for (const account of accounts) {
    if (account.email) accountsByEmail.set(account.email, account);
  }

  const candidates: Match[] = [];
  let conflicts = 0;
  for (const principal of principals) {
    const byUid = principal.legacyAuthId
      ? accountsByUid.get(principal.legacyAuthId)
      : undefined;
    const account =
      byUid ??
      (principal.email ? accountsByEmail.get(principal.email) : undefined);
    if (!account) continue;
    if (principal.existingUid && principal.existingUid !== account.uid) {
      conflicts += 1;
      continue;
    }
    candidates.push({
      principal,
      account,
      basis: byUid ? 'uid' : 'email',
    });
  }

  const byIdentityUid = new Map<string, Match[]>();
  for (const candidate of candidates) {
    const group = byIdentityUid.get(candidate.account.uid) ?? [];
    group.push(candidate);
    byIdentityUid.set(candidate.account.uid, group);
  }

  const matches: Match[] = [];
  let ambiguous = 0;
  for (const group of byIdentityUid.values()) {
    if (group.length === 1) {
      matches.push(group[0]);
      continue;
    }
    const direct = group.filter((candidate) => candidate.basis === 'uid');
    if (direct.length === 1) {
      matches.push(direct[0]);
      ambiguous += group.length - 1;
      continue;
    }

    // Match the same precedence used by request authorization. This safely
    // handles a staff member whose email also appears on a historical client
    // record without linking the Identity UID to both principals.
    const admins = group.filter(
      (candidate) => candidate.principal.type === 'admin'
    );
    const doulas = group.filter(
      (candidate) => candidate.principal.type === 'doula'
    );
    const clients = group.filter(
      (candidate) => candidate.principal.type === 'client'
    );
    const preferred =
      admins.length === 1
        ? admins[0]
        : admins.length === 0 && doulas.length === 1
          ? doulas[0]
          : admins.length === 0 && doulas.length === 0 && clients.length === 1
            ? clients[0]
            : null;
    if (preferred) {
      matches.push(preferred);
      ambiguous += group.length - 1;
    } else {
      ambiguous += group.length;
    }
  }

  return { matches, ambiguous, conflicts };
}

async function applyMatches(
  client: PoolClient,
  matches: Match[]
): Promise<number> {
  let updated = 0;
  const tableByType: Record<PrincipalType, string> = {
    admin: 'admins',
    doula: 'doulas',
    client: 'phi_clients',
  };
  for (const match of matches) {
    const table = tableByType[match.principal.type];
    const result = await client.query(
      `UPDATE public.${table}
          SET identity_platform_uid = $1, updated_at = NOW()
        WHERE id = $2::uuid
          AND (identity_platform_uid IS NULL OR identity_platform_uid = $1)`,
      [match.account.uid, match.principal.id]
    );
    updated += result.rowCount ?? 0;
  }
  return updated;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const sslMode = (process.env.CLOUD_SQL_SSLMODE || 'disable').toLowerCase();
  const pool = new Pool({
    host: requiredEnv('CLOUD_SQL_HOST'),
    port: Number(process.env.CLOUD_SQL_PORT || 5432),
    database: requiredEnv('CLOUD_SQL_DATABASE'),
    user: requiredEnv('CLOUD_SQL_USER'),
    password: requiredEnv('CLOUD_SQL_PASSWORD'),
    ssl: sslMode === 'require' ? { rejectUnauthorized: false } : false,
  });

  try {
    const [principals, accounts] = await Promise.all([
      loadPrincipals(pool),
      listIdentityAccounts(),
    ]);
    const { matches, ambiguous, conflicts } = selectMatches(
      principals,
      accounts
    );
    const byType = (type: PrincipalType) =>
      matches.filter((match) => match.principal.type === type).length;

    let updated = 0;
    if (apply) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        updated = await applyMatches(client, matches);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          identityAccounts: accounts.length,
          cloudSqlPrincipals: principals.length,
          exactMatches: matches.length,
          matchedAdmins: byType('admin'),
          matchedDoulas: byType('doula'),
          matchedClients: byType('client'),
          ambiguousSkipped: ambiguous,
          conflictingExistingLinksSkipped: conflicts,
          unmatched: principals.length - matches.length - ambiguous - conflicts,
          updated,
          emailsSent: 0,
          accountsCreated: 0,
        },
        null,
        2
      )
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
