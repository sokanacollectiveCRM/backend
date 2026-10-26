import { createHash, randomBytes } from 'crypto';

import { logger } from '../../../common/utils/logger';
import { getPool } from '../../../db/cloudSqlPool';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../domains/errors';
import { NodemailerService } from '../../../services/emailService';
import { getFirebaseAuth } from '../../../services/identityPlatform/firebaseAdmin';
import { assertStaffInviteEmail } from '../../tenancy';
import {
  runWithTenancyBypass,
  runWithTenant,
} from '../../tenancy/application/tenantRequestStore';
import { invitationCanBeAccepted } from '../domain/staffInvitation';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface PendingStaffInvitation {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: 'admin' | 'doula' | 'hr';
  invitation_status: 'pending';
  account_status: 'pending';
}

export interface StaffInvitationPreview {
  email: string;
  firstname: string;
  lastname: string;
  role: 'admin' | 'doula' | 'hr';
  organizationName: string;
  existingAccount: boolean;
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
  role: 'admin' | 'doula' | 'hr';
  invitedByEmail: string | null;
  invitedById?: string;
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
    const existingStaff = await pool.query(
      `SELECT a.id,COALESCE(to_jsonb(a)->>'staff_role','admin') AS role FROM public.admins a
      WHERE a.tenant_id=$2::uuid AND lower(a.email)=$1 AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.tenant_id=a.tenant_id AND m.principal_id=a.id AND m.status='inactive')
      UNION ALL SELECT d.id,'doula' AS role FROM public.doulas d WHERE d.tenant_id=$2::uuid AND lower(d.email)=$1
      AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.tenant_id=d.tenant_id AND m.principal_id=d.id AND m.status='inactive')`,
      [email, tenantId]
    );
    if (existingStaff.rowCount)
      throw new ConflictError(
        'This email is already an active member of this organization.'
      );
    // Expired invitations must not keep the unique pending slot occupied.
    await pool.query(
      "UPDATE public.staff_invitations SET status='revoked',updated_at=now() WHERE tenant_id=$1::uuid AND lower(email)=$2 AND status='pending' AND expires_at<=now()",
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
        (tenant_id, email, first_name, last_name, role, token_hash, expires_at, invited_by_email,invited_by_id)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8,$9)
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
        input.invitedById ?? null,
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
    await new NodemailerService().sendStaffInvitationEmail({
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
    role: 'admin' | 'doula' | 'hr';
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
    existingAccount: !!(await existingIdentity(invitation.email)),
  };
}

async function existingIdentity(email: string) {
  try {
    return await getFirebaseAuth().getUserByEmail(email);
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/user-not-found')
      return null;
    throw error;
  }
}

export async function acceptStaffInvitation(input: {
  token: string;
  password: string;
  idToken?: string;
}): Promise<void> {
  const invitation = await findOpenInvitation(input.token);
  const auth = getFirebaseAuth();
  let identity = await existingIdentity(invitation.email);
  let created = false;
  if (identity) {
    if (!input.idToken)
      throw new ValidationError(
        'Sign in with your existing platform account to accept this invitation.'
      );
    const verified = await auth.verifyIdToken(input.idToken, true);
    if (
      verified.uid !== identity.uid ||
      verified.email?.toLowerCase() !== invitation.email.toLowerCase()
    )
      throw new ValidationError(
        'Sign in with the email this invitation was sent to.'
      );
  } else {
    if (!input.password || input.password.length < 8)
      throw new ValidationError('Password must be at least 8 characters long');
    identity = await auth.createUser({
      email: invitation.email,
      password: input.password,
      emailVerified: invitation.role !== 'doula',
      displayName: `${invitation.first_name} ${invitation.last_name}`.trim(),
    });
    created = true;
  }
  const uid = identity.uid;
  let db: import('pg').PoolClient | undefined;
  try {
    db = await getPool().connect();
    await db.query('BEGIN');
    await db.query('LOCK TABLE public.doula_hr_permissions IN EXCLUSIVE MODE');
    const locked = await db.query(
      'SELECT status,expires_at FROM public.staff_invitations WHERE id=$1::uuid AND tenant_id=$2::uuid FOR UPDATE',
      [invitation.id, invitation.tenant_id]
    );
    if (
      !locked.rows[0] ||
      !invitationCanBeAccepted(
        locked.rows[0].status,
        new Date(locked.rows[0].expires_at),
        new Date()
      )
    )
      throw new ValidationError(
        'This invitation has expired or was already accepted.'
      );
    const table = invitation.role === 'doula' ? 'doulas' : 'admins';
    const other = invitation.role === 'doula' ? 'admins' : 'doulas';
    const conflict = await db.query(
      `SELECT id FROM public.${other} WHERE tenant_id=$1::uuid AND lower(email)=$2`,
      [invitation.tenant_id, invitation.email.toLowerCase()]
    );
    if (conflict.rowCount)
      throw new ConflictError(
        'This organization already has a profile for this email with a different role.'
      );
    const retained = await db.query(
      `SELECT id,identity_platform_uid,${table === 'admins' ? 'staff_role' : "'doula'::text AS staff_role"} FROM public.${table} WHERE tenant_id=$1::uuid AND lower(email)=$2 FOR UPDATE`,
      [invitation.tenant_id, invitation.email.toLowerCase()]
    );
    const prior = retained.rows[0];
    if (
      prior &&
      (prior.staff_role !== invitation.role ||
        (prior.identity_platform_uid && prior.identity_platform_uid !== uid))
    )
      throw new ConflictError(
        'The retained organization profile does not match this invitation.'
      );
    let id: string;
    if (prior) {
      const membership = await db.query(
        'SELECT status FROM public.memberships WHERE tenant_id=$1::uuid AND principal_id=$2::uuid FOR UPDATE',
        [invitation.tenant_id, prior.id]
      );
      if (membership.rows[0]?.status !== 'inactive')
        throw new ConflictError(
          'This account is already active in this organization.'
        );
      id = prior.id;
      if (table === 'doulas')
        await db.query(
          `UPDATE public.doulas SET identity_platform_uid=$3,profile_review_status='draft',profile_review_reason=NULL,profile_review_version=profile_review_version+1,updated_at=now() WHERE id=$1::uuid AND tenant_id=$2::uuid`,
          [id, invitation.tenant_id, uid]
        );
      else
        await db.query(
          'UPDATE public.admins SET identity_platform_uid=$3,updated_at=now() WHERE id=$1::uuid AND tenant_id=$2::uuid',
          [id, invitation.tenant_id, uid]
        );
    } else {
      // New organization => new profile ID. Never copy another organization's data or files.
      const inserted =
        table === 'doulas'
          ? await db.query(
              `INSERT INTO public.doulas(id,tenant_id,full_name,email,identity_platform_uid,account_status) VALUES(gen_random_uuid(),$1::uuid,$2,$3,$4,'active') RETURNING id`,
              [
                invitation.tenant_id,
                `${invitation.first_name} ${invitation.last_name}`.trim(),
                invitation.email,
                uid,
              ]
            )
          : await db.query(
              `INSERT INTO public.admins(id,tenant_id,full_name,first_name,last_name,email,identity_platform_uid,staff_role) VALUES(gen_random_uuid(),$1::uuid,$2,$3,$4,$5,$6,$7) RETURNING id`,
              [
                invitation.tenant_id,
                `${invitation.first_name} ${invitation.last_name}`.trim(),
                invitation.first_name,
                invitation.last_name,
                invitation.email,
                uid,
                invitation.role,
              ]
            );
      id = inserted.rows[0].id;
    }
    await db.query(
      `INSERT INTO public.memberships(tenant_id,principal_type,principal_id,identity_platform_uid,email,role,status)
      VALUES($1::uuid,$2,$3::uuid,$4,$5,$6,'active') ON CONFLICT(tenant_id,principal_type,principal_id)
      DO UPDATE SET identity_platform_uid=EXCLUDED.identity_platform_uid,email=EXCLUDED.email,role=EXCLUDED.role,status='active',updated_at=now()`,
      [
        invitation.tenant_id,
        table === 'doulas' ? 'doula' : 'admin',
        id,
        uid,
        invitation.email,
        invitation.role,
      ]
    );
    if (invitation.role === 'hr') {
      const granted = await db.query(
        "INSERT INTO public.doula_hr_permissions(tenant_id,admin_id,department) VALUES($1::uuid,$2,'hr') ON CONFLICT DO NOTHING RETURNING admin_id",
        [invitation.tenant_id, id]
      );
      if (granted.rowCount)
        await db.query(
          "INSERT INTO public.staff_permission_events(tenant_id,actor_id,admin_id,capability,old_value,new_value) VALUES($1::uuid,$2,$3,'hr',false,true)",
          [
            invitation.tenant_id,
            invitation.invited_by_id ||
              invitation.invited_by_email ||
              'inviting-admin',
            id,
          ]
        );
    }
    await db.query(
      'INSERT INTO public.staff_membership_events(tenant_id,principal_id,event,actor_id) VALUES($1::uuid,$2::uuid,$3,$4)',
      [invitation.tenant_id, id, prior ? 'reinstated' : 'joined', uid]
    );
    await db.query(
      "UPDATE public.staff_invitations SET status='accepted',accepted_at=now(),updated_at=now() WHERE id=$1::uuid AND tenant_id=$2::uuid",
      [invitation.id, invitation.tenant_id]
    );
    await db.query(
      "INSERT INTO public.staff_invitation_events(invitation_id,tenant_id,event,actor_email) VALUES($1::uuid,$2::uuid,'accepted',$3)",
      [invitation.id, invitation.tenant_id, invitation.email]
    );
    await db.query('COMMIT');
  } catch (error) {
    if (db) await db.query('ROLLBACK');
    if (created) await auth.deleteUser(uid).catch(() => undefined);
    throw error;
  } finally {
    db?.release();
  }
  if (created && invitation.role === 'doula') {
    const { emailVerificationService } = await import(
      '../../../services/identityPlatform/emailVerificationService'
    );
    await emailVerificationService.sendVerificationEmailForUid(uid);
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
  role: 'admin' | 'doula' | 'hr';
  status: string;
  expires_at: Date;
  organization_name: string;
  invited_by_email: string | null;
  invited_by_id: string | null;
}

async function findOpenInvitation(token: string): Promise<OpenInvitation> {
  const trimmed = token.trim();
  if (!trimmed) throw new ValidationError('Invitation link is missing.');
  const invitation = await runWithTenancyBypass(async () => {
    const { rows } = await getPool().query<OpenInvitation>(
      `SELECT i.id, i.tenant_id, i.email, i.first_name, i.last_name, i.role, i.status, i.expires_at, i.invited_by_email,i.invited_by_id,
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
