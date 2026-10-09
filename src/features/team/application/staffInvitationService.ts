import { createHash, randomBytes } from 'crypto';

import { logger } from '../../../common/utils/logger';
import { getPool } from '../../../db/cloudSqlPool';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../domains/errors';
import { NodemailerService } from '../../../services/emailService';
import { emailVerificationService } from '../../../services/identityPlatform/emailVerificationService';
import { getFirebaseAuth } from '../../../services/identityPlatform/firebaseAdmin';
import { assertStaffInviteEmail } from '../../tenancy';
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

async function logEvent(input: {
  invitationId: string;
  tenantId: string;
  event: 'invited' | 'accepted';
  actorEmail: string | null;
}): Promise<void> {
  await getPool().query(
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
    const pool = getPool();
    const existingStaff = await runWithTenancyBypass(() =>
      pool.query(
        `SELECT 1 FROM public.admins WHERE lower(email) = $1
         UNION ALL
         SELECT 1 FROM public.doulas WHERE lower(email) = $1
         LIMIT 1`,
        [email]
      )
    );
    if (existingStaff.rowCount) {
      throw new ConflictError('This email is already on the team.');
    }
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
    await logEvent({
      invitationId,
      tenantId,
      event: 'invited',
      actorEmail: input.invitedByEmail,
    });
    return { id: invitationId };
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
  return {
    email: invitation.email,
    firstname: invitation.first_name,
    lastname: invitation.last_name,
    role: invitation.role,
    organizationName: invitation.organization_name,
  };
}

export async function acceptStaffInvitation(input: {
  token: string;
  password: string;
}): Promise<void> {
  if (!input.password || input.password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long');
  }
  const invitation = await findOpenInvitation(input.token);
  const auth = getFirebaseAuth();
  const skipInboxVerification = invitation.role === 'admin';
  const createdAuth = await auth.createUser({
    email: invitation.email,
    password: input.password,
    emailVerified: skipInboxVerification,
    displayName: `${invitation.first_name} ${invitation.last_name}`.trim(),
  });

  try {
    await runWithTenant(invitation.tenant_id, async () => {
      const pool = getPool();
      const inserted = await pool.query<{ id: string }>(
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
              createdAuth.uid,
              invitation.tenant_id,
            ]
          : [
              `${invitation.first_name} ${invitation.last_name}`.trim(),
              invitation.first_name,
              invitation.last_name,
              invitation.email,
              createdAuth.uid,
              invitation.tenant_id,
            ]
      );
      const principalId = inserted.rows[0]?.id;
      if (!principalId) {
        throw new ValidationError('Could not record the accepted invitation.');
      }
      await pool.query(
        `INSERT INTO public.memberships (
           tenant_id, principal_type, principal_id, identity_platform_uid, email, role, status
         ) VALUES ($1::uuid, $2, $3::uuid, $4, $5, $2, 'active')
         ON CONFLICT (tenant_id, principal_type, principal_id) DO UPDATE SET
           identity_platform_uid = EXCLUDED.identity_platform_uid,
           email = EXCLUDED.email,
           status = 'active',
           updated_at = now()`,
        [
          invitation.tenant_id,
          invitation.role,
          principalId,
          createdAuth.uid,
          invitation.email,
        ]
      );
      await pool.query(
        `UPDATE public.staff_invitations
            SET status = 'accepted', accepted_at = now(), updated_at = now()
          WHERE id = $1::uuid`,
        [invitation.id]
      );
      await logEvent({
        invitationId: invitation.id,
        tenantId: invitation.tenant_id,
        event: 'accepted',
        actorEmail: invitation.email,
      });
    });
  } catch (error) {
    await auth.deleteUser(createdAuth.uid).catch(() => undefined);
    throw error;
  }

  if (!skipInboxVerification) {
    await emailVerificationService.sendVerificationEmailForUid(createdAuth.uid);
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
        WHERE i.token_hash = $1
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
