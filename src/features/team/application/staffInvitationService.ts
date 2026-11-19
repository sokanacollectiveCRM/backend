import { createHash, randomBytes } from 'crypto';
import type { PoolClient } from 'pg';

import { logger } from '../../../common/utils/logger';
import { getPool } from '../../../db/cloudSqlPool';
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../domains/errors';
import { NodemailerService } from '../../../services/emailService';
import { emailVerificationService } from '../../../services/identityPlatform/emailVerificationService';
import { getFirebaseAuth } from '../../../services/identityPlatform/firebaseAdmin';
import { IdentityPlatformTokenService } from '../../../services/identityPlatform/identityPlatformTokenService';
import { assertStaffInviteEmail, isTenancyEnforced } from '../../tenancy';
import {
  runWithTenancyBypass,
  runWithTenant,
} from '../../tenancy/application/tenantRequestStore';
import { invitationCanBeAccepted } from '../domain/staffInvitation';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const emailService = new NodemailerService();

export interface PendingStaffInvitation {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: 'admin' | 'doula';
  invitation_status: 'pending';
  account_status: 'pending';
}

export interface StaffInvitationPreview {
  email: string;
  firstname: string;
  lastname: string;
  role: 'admin' | 'doula';
  organizationName: string;
  requiresSignIn: boolean;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function acceptUrl(token: string): string {
  const frontend = (
    process.env.FRONTEND_URL || 'http://localhost:3001'
  ).replace(/\/+$/, '');
  return `${frontend}/accept-invite?token=${encodeURIComponent(token)}`;
}

async function logEvent(
  input: {
    invitationId: string;
    tenantId: string;
    event: 'invited' | 'accepted';
    actorEmail: string | null;
  },
  database: Pick<PoolClient, 'query'> = getPool()
): Promise<void> {
  await database.query(
    `INSERT INTO public.staff_invitation_events
      (invitation_id, tenant_id, event, actor_email)
     VALUES ($1::uuid, $2::uuid, $3, $4)`,
    [input.invitationId, input.tenantId, input.event, input.actorEmail]
  );
  logger.info(
    {
      service: 'staff-invitations',
      event: input.event,
      invitationId: input.invitationId,
      tenantId: input.tenantId,
    },
    'Staff invitation event'
  );
}

export async function createStaffInvitation(input: {
  tenantId: string | null | undefined;
  firstname: string;
  lastname: string;
  email: string;
  role: 'admin' | 'doula';
  invitedByEmail: string | null;
}): Promise<PendingStaffInvitation> {
  if (!input.tenantId) {
    throw new ValidationError(
      'Sign in to an organization before inviting staff.'
    );
  }
  const email = input.email.trim().toLowerCase();
  const firstname = input.firstname.trim();
  const lastname = input.lastname.trim();
  await assertStaffInviteEmail({
    tenantId: input.tenantId,
    email,
    role: input.role,
  });
  const tenantId = input.tenantId as string;

  const token = randomBytes(32).toString('hex');
  const created = await runWithTenant(tenantId, async () => {
    const pool = await getPool().connect();
    try {
      await pool.query('BEGIN');
      await pool.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`${tenantId}:${email}`]
      );
      const existingStaff = await pool.query(
        `SELECT 1 FROM public.admins WHERE tenant_id = $1::uuid AND lower(email) = $2
       UNION ALL
       SELECT 1 FROM public.doulas WHERE tenant_id = $1::uuid AND lower(email) = $2
       UNION ALL
       SELECT 1 FROM public.memberships
        WHERE tenant_id = $1::uuid AND lower(email) = $2
          AND principal_type IN ('admin', 'doula')
       LIMIT 1`,
        [tenantId, email]
      );
      if (existingStaff.rowCount) {
        throw new ConflictError(
          'This email is already a member of your organization.'
        );
      }
      // Expired invitations must release the partial unique index before re-inviting.
      await pool.query(
        `UPDATE public.staff_invitations SET status = 'revoked', updated_at = now()
        WHERE tenant_id = $1::uuid AND lower(email) = $2
          AND status = 'pending' AND expires_at <= now()`,
        [tenantId, email]
      );
      const pending = await pool.query(
        `SELECT 1 FROM public.staff_invitations
        WHERE tenant_id = $1::uuid
          AND lower(email) = $2
          AND status = 'pending'
          AND expires_at > now()
        LIMIT 1`,
        [tenantId, email]
      );
      if (pending.rowCount) {
        throw new ConflictError(
          'An invitation is already pending for this email.'
        );
      }

      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO public.staff_invitations
        (tenant_id, email, first_name, last_name, role, token_hash, expires_at, invited_by_email)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
        [
          tenantId,
          email,
          firstname,
          lastname,
          input.role,
          hashToken(token),
          new Date(Date.now() + INVITE_TTL_MS).toISOString(),
          input.invitedByEmail,
        ]
      );
      const invitationId = rows[0].id;
      await logEvent(
        {
          invitationId,
          tenantId,
          event: 'invited',
          actorEmail: input.invitedByEmail,
        },
        pool
      );
      await pool.query('COMMIT');
      return { id: invitationId };
    } catch (error) {
      await pool.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictError(
          'An invitation is already pending for this email.'
        );
      }
      throw error;
    } finally {
      pool.release();
    }
  });

  const organizationName = await organizationNameFor(tenantId);
  try {
    await emailService.sendStaffInvitationEmail({
      to: email,
      firstname,
      lastname,
      role: input.role,
      organizationName,
      acceptUrl: acceptUrl(token),
    });
  } catch (error) {
    await runWithTenant(tenantId, async () => {
      await getPool().query(
        `DELETE FROM public.staff_invitation_events WHERE invitation_id = $1`,
        [created.id]
      );
      await getPool().query(
        `DELETE FROM public.staff_invitations WHERE id = $1`,
        [created.id]
      );
    });
    throw error;
  }

  return {
    id: created.id,
    firstname,
    lastname,
    email,
    role: input.role,
    invitation_status: 'pending',
    account_status: 'pending',
  };
}

export async function listPendingStaffInvitations(
  tenantId: string | null | undefined
): Promise<PendingStaffInvitation[]> {
  if (!tenantId) return [];
  const { rows } = await getPool().query<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: 'admin' | 'doula';
  }>(
    `SELECT id, email, first_name, last_name, role
       FROM public.staff_invitations
      WHERE tenant_id = $1::uuid
        AND status = 'pending'
        AND expires_at > now()
      ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows.map((row) => ({
    id: row.id,
    firstname: row.first_name,
    lastname: row.last_name,
    email: row.email,
    role: row.role,
    invitation_status: 'pending',
    account_status: 'pending',
  }));
}

export async function previewStaffInvitation(
  token: string
): Promise<StaffInvitationPreview> {
  const invitation = await findOpenInvitation(token);
  const existing = await findIdentity(invitation.email);
  return {
    email: invitation.email,
    firstname: invitation.first_name,
    lastname: invitation.last_name,
    role: invitation.role,
    organizationName: invitation.organization_name,
    requiresSignIn: Boolean(existing),
  };
}

/** Reuse a verified login; create only the new organization's staff profile. */
export async function acceptStaffInvitation(input: {
  token: string;
  password?: string;
  /** ID token or authenticated session cookie; never accept a caller-supplied UID. */
  identityToken?: string;
}): Promise<{ requiresEmailVerification: boolean; organizationName: string }> {
  const invitation = await findOpenInvitation(input.token);
  const auth = getFirebaseAuth();
  const existing = await findIdentity(invitation.email);
  if (existing) {
    if (!isTenancyEnforced()) {
      throw new ValidationError(
        'Organization isolation must be enabled before accepting invitations with an existing account.'
      );
    }
    if (!input.identityToken) {
      throw new AuthenticationError(
        'Sign in to your existing account to accept this invitation.'
      );
    }
    const claims =
      await new IdentityPlatformTokenService().verifySessionOrIdToken(
        input.identityToken
      );
    if (
      claims.uid !== existing.uid ||
      claims.email?.trim().toLowerCase() !== invitation.email.toLowerCase()
    ) {
      throw new AuthorizationError(
        'Sign in with the email address this invitation was sent to.'
      );
    }
    if (existing.disabled) {
      throw new AuthorizationError('This account is disabled.');
    }
  } else if (!input.password || input.password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long');
  }

  let createdUid: string | undefined;
  let identityUid = existing?.uid;
  const skipInboxVerification = invitation.role === 'admin';
  await runWithTenant(invitation.tenant_id, async () => {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      // One acceptance owns this invitation, including during Firebase provisioning.
      const locked = await client.query(
        `SELECT id FROM public.staff_invitations
          WHERE id = $1::uuid AND tenant_id = $2::uuid
            AND status = 'pending' AND expires_at > now()
          FOR UPDATE`,
        [invitation.id, invitation.tenant_id]
      );
      if (!locked.rowCount) {
        throw new ConflictError(
          'This invitation has expired or was already accepted.'
        );
      }
      const member = await client.query(
        `SELECT 1 FROM public.memberships
          WHERE tenant_id = $1::uuid AND lower(email) = $2
            AND principal_type IN ('admin', 'doula')
         UNION ALL
         SELECT 1 FROM public.doulas WHERE tenant_id = $1::uuid AND lower(email) = $2
         UNION ALL
         SELECT 1 FROM public.admins WHERE tenant_id = $1::uuid AND lower(email) = $2
         LIMIT 1`,
        [invitation.tenant_id, invitation.email.toLowerCase()]
      );
      if (member.rowCount) {
        throw new ConflictError(
          'This email is already a member of your organization.'
        );
      }
      if (!existing) {
        try {
          const created = await auth.createUser({
            email: invitation.email,
            password: input.password,
            emailVerified: skipInboxVerification,
            displayName:
              `${invitation.first_name} ${invitation.last_name}`.trim(),
          });
          identityUid = createdUid = created.uid;
        } catch (error) {
          if (
            (error as { code?: string }).code === 'auth/email-already-exists'
          ) {
            throw new AuthenticationError(
              'Sign in to your existing account to accept this invitation.'
            );
          }
          throw error;
        }
        if (process.env.CLOUD_SQL_DATABASE) {
          await auth.setCustomUserClaims(identityUid, {
            sokanaAccountDatabase: process.env.CLOUD_SQL_DATABASE,
          });
        }
      }
      const inserted = await client.query<{ id: string }>(
        invitation.role === 'doula'
          ? `INSERT INTO public.doulas (
               id, full_name, email, phone, account_status, identity_platform_uid, tenant_id, created_at, updated_at
             ) VALUES (gen_random_uuid(), $1, $2, NULL, 'approved', $3, $4::uuid, now(), now())
             RETURNING id`
          : `INSERT INTO public.admins (
               id, full_name, first_name, last_name, email, identity_platform_uid, tenant_id, created_at, updated_at
             ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::uuid, now(), now())
             RETURNING id`,
        invitation.role === 'doula'
          ? [
              `${invitation.first_name} ${invitation.last_name}`.trim(),
              invitation.email,
              identityUid,
              invitation.tenant_id,
            ]
          : [
              `${invitation.first_name} ${invitation.last_name}`.trim(),
              invitation.first_name,
              invitation.last_name,
              invitation.email,
              identityUid,
              invitation.tenant_id,
            ]
      );
      const principalId = inserted.rows[0]?.id;
      if (!principalId) {
        throw new ValidationError('Could not record the accepted invitation.');
      }
      await client.query(
        `INSERT INTO public.memberships (
           tenant_id, principal_type, principal_id, identity_platform_uid, email, role, status
         ) VALUES ($1::uuid, $2, $3::uuid, $4, $5, $2, 'active')`,
        [
          invitation.tenant_id,
          invitation.role,
          principalId,
          identityUid,
          invitation.email,
        ]
      );
      await client.query(
        `UPDATE public.staff_invitations
            SET status = 'accepted', accepted_at = now(), updated_at = now()
          WHERE id = $1::uuid AND tenant_id = $2::uuid`,
        [invitation.id, invitation.tenant_id]
      );
      await logEvent(
        {
          invitationId: invitation.id,
          tenantId: invitation.tenant_id,
          event: 'accepted',
          actorEmail: invitation.email,
        },
        client
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      // Never delete or modify the shared identity when adding a membership fails.
      if (createdUid) await auth.deleteUser(createdUid).catch(() => undefined);
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictError(
          'This email is already a member of your organization.'
        );
      }
      throw error;
    } finally {
      client.release();
    }
  });

  const requiresEmailVerification = existing
    ? !existing.emailVerified
    : !skipInboxVerification;
  if (requiresEmailVerification) {
    await emailVerificationService.sendVerificationEmailForUid(identityUid);
  }
  return {
    requiresEmailVerification,
    organizationName: invitation.organization_name,
  };
}

async function findIdentity(email: string) {
  try {
    return await getFirebaseAuth().getUserByEmail(email);
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/user-not-found')
      return null;
    throw error;
  }
}

async function organizationNameFor(tenantId: string): Promise<string> {
  const { rows } = await getPool().query<{ name: string }>(
    `SELECT name FROM public.tenants WHERE id = $1::uuid`,
    [tenantId]
  );
  return rows[0]?.name || 'your organization';
}

interface OpenInvitation {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'doula';
  status: string;
  expires_at: Date;
  organization_name: string;
}

async function findOpenInvitation(token: string): Promise<OpenInvitation> {
  const trimmed = token.trim();
  if (!trimmed) throw new ValidationError('Invitation link is missing.');
  const invitation = await runWithTenancyBypass(async () => {
    const { rows } = await getPool().query<OpenInvitation>(
      `SELECT i.id, i.tenant_id, i.email, i.first_name, i.last_name, i.role, i.status, i.expires_at,
              t.name AS organization_name
         FROM public.staff_invitations i
         JOIN public.tenants t ON t.id = i.tenant_id
        WHERE i.token_hash = $1 AND t.status = 'active'
        LIMIT 1`,
      [hashToken(trimmed)]
    );
    return rows[0] ?? null;
  });
  if (!invitation)
    throw new NotFoundError('This invitation is no longer valid.');
  if (
    !invitationCanBeAccepted(
      invitation.status,
      new Date(invitation.expires_at),
      new Date()
    )
  ) {
    throw new ValidationError(
      'This invitation has expired or was already accepted.'
    );
  }
  return invitation;
}
