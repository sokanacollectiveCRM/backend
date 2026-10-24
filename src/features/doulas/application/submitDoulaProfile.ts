import { randomUUID } from 'crypto';

import { getPool } from '../../../db/cloudSqlPool';
import { NotFoundError, ValidationError } from '../../../domains/errors';
import { isValidPhone, missingProfileFields } from '../domain/profile';
import { deliverProfileReviewEmails } from './profileReviewEmail';

type ReviewAction = 'submitted' | 'changes_requested' | 'approved';
export async function transitionDoulaProfile(input: {
  doulaId: string;
  tenantId: string;
  actorId: string;
  action: ReviewAction;
  reason?: unknown;
  expectedVersion?: unknown;
}): Promise<string | null> {
  const client = await getPool().connect();
  let eventId: string | undefined;
  let submittedAt: string | null = null;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM public.doulas WHERE id=$1::uuid AND tenant_id=$2::uuid FOR UPDATE`,
      [input.doulaId, input.tenantId]
    );
    const profile = rows[0];
    if (!profile) throw new NotFoundError('Profile not found.');
    if (input.action !== 'changes_requested' && !isValidPhone(profile.phone))
      throw new ValidationError('Enter a 10-digit phone number');
    const state = profile.profile_review_status;
    submittedAt = profile.profile_submitted_at
      ? new Date(profile.profile_submitted_at).toISOString()
      : null;
    if (
      (input.action === 'submitted' &&
        (state === 'submitted' || state === 'approved')) ||
      (input.action === 'approved' && state === 'approved')
    ) {
      await client.query('COMMIT');
      return submittedAt;
    }
    if (
      input.action !== 'submitted' &&
      (!Number.isInteger(input.expectedVersion) ||
        input.expectedVersion !== profile.profile_review_version)
    ) {
      throw new ValidationError(
        'This profile has changed. Refresh it before reviewing.'
      );
    }
    if (input.action !== 'submitted' && state !== 'submitted')
      throw new ValidationError(
        'The doula must submit their profile before you can review it.'
      );
    if (
      input.action === 'submitted' &&
      !['draft', 'changes_requested'].includes(state)
    )
      throw new ValidationError(
        'This profile cannot be submitted in its current state.'
      );
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (
      input.action === 'changes_requested' &&
      (!reason || reason.length > 2000)
    )
      throw new ValidationError(
        'Provide a reason for the requested changes (1–2000 characters).'
      );
    if (input.action !== 'changes_requested') {
      const [firstname, ...rest] = String(profile.full_name || '')
        .trim()
        .split(/\s+/);
      if (
        missingProfileFields({
          ...profile,
          firstname,
          lastname: rest.join(' '),
        }).length
      )
        throw new ValidationError(
          'Complete your name, phone number, address, and bio before submitting.'
        );
      const certificate = await client.query(
        `SELECT 1 FROM public.doula_documents WHERE doula_id=$1::text
         AND document_type='training_certificate' AND NULLIF(file_path,'') IS NOT NULL
         AND (status='approved' OR ($2::text='submitted' AND status='uploaded')) LIMIT 1`,
        [input.doulaId, input.action]
      );
      if (!certificate.rowCount)
        throw new ValidationError(
          input.action === 'approved'
            ? 'Approve the required training certificate before approving the account.'
            : 'Upload your Doula training certificate before submitting.'
        );
      if (input.action === 'submitted') {
        const rejected = await client.query(
          "SELECT 1 FROM public.doula_documents WHERE doula_id=$1::text AND status='rejected' AND document_type IN ('training_certificate','liability_insurance_certificate','illinois_medicaid_certification','miscellaneous','license','other') LIMIT 1",
          [input.doulaId]
        );
        if (rejected.rowCount)
          throw new ValidationError(
            'Replace or remove rejected documents before resubmitting.'
          );
      }
    }
    const recipients = await client.query(
      `SELECT lower(trim(intake_notification_email)) AS email FROM public.tenant_settings
       WHERE tenant_id=$1::uuid AND NULLIF(trim(intake_notification_email),'') IS NOT NULL
       UNION SELECT lower(trim(email)) AS email FROM public.admins
       WHERE tenant_id=$1::uuid AND NULLIF(trim(email),'') IS NOT NULL`,
      [input.tenantId]
    );
    if (!recipients.rows.length || !profile.email)
      throw new ValidationError(
        'An admin email and doula email are required for review notifications.'
      );
    const version = profile.profile_review_version + 1;
    eventId = randomUUID();
    await client.query(
      `INSERT INTO public.doula_profile_reviews(id,tenant_id,doula_id,version,action,reason,actor_id)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        eventId,
        input.tenantId,
        input.doulaId,
        version,
        input.action,
        reason || null,
        input.actorId,
      ]
    );
    const updated = await client.query(
      `UPDATE public.doulas SET profile_review_status=$3,
      profile_review_reason=$4, profile_review_version=$5,
      profile_submitted_at=CASE WHEN $3='submitted' THEN now() ELSE profile_submitted_at END,
      updated_at=now()
      WHERE id=$1::uuid AND tenant_id=$2::uuid RETURNING profile_submitted_at`,
      [
        input.doulaId,
        input.tenantId,
        input.action,
        input.action === 'changes_requested' ? reason : null,
        version,
      ]
    );
    submittedAt = updated.rows[0].profile_submitted_at
      ? new Date(updated.rows[0].profile_submitted_at).toISOString()
      : null;
    const base = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(
      /\/+$/,
      ''
    );
    const reviewUrl = `${base}/team?review=${encodeURIComponent(input.doulaId)}`;
    const profileUrl = `${base}/doula-dashboard/profile`;
    const resubmitted =
      input.action === 'submitted' && state === 'changes_requested';
    const subject =
      input.action === 'approved'
        ? 'Sokana360: Doula account approved'
        : input.action === 'changes_requested'
          ? 'Sokana360: Changes requested to your profile'
          : resubmitted
            ? 'Sokana360: Profile resubmitted for review'
            : 'Sokana360: Profile submitted for review';
    const summary =
      input.action === 'approved'
        ? `${profile.full_name}’s profile and documents have been approved. Profile completion is now approved. Dashboard access remains available.`
        : input.action === 'changes_requested'
          ? `Changes are needed for ${profile.full_name}’s profile before approval.\n\nRequested changes:\n${reason}\n\nUpdate the profile and any rejected documents, then select Resubmit for review. Profile approval remains pending. Dashboard access remains available.`
          : `${profile.full_name} has ${resubmitted ? 'resubmitted' : 'submitted'} their profile and documents. Profile approval is pending. The doula can continue using dashboard tools while awaiting review.`;
    const doulaEmail = profile.email.trim().toLowerCase();
    for (const recipient of new Set(
      [doulaEmail, ...recipients.rows.map((row) => row.email)]
        .map((email: string) => email.trim().toLowerCase())
        .filter(Boolean)
    )) {
      const isDoula = recipient === doulaEmail;
      await client.query(
        `INSERT INTO public.doula_review_emails(event_id,recipient,subject,body) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [
          eventId,
          recipient,
          subject,
          `${summary}\n\n${isDoula ? 'View your profile' : 'Review in Teams'}: ${isDoula ? profileUrl : reviewUrl}\n\nSokana360`,
        ]
      );
    }
    await client.query(
      `INSERT INTO public.dashboard_notices(tenant_id,audience,doula_id,rule_id,severity,title,body,dedupe_key,blocks_payout)
      VALUES($1,'admin',$2,'doula_profile_submitted','info',$3,$4,$5,false) ON CONFLICT DO NOTHING`,
      [
        input.tenantId,
        input.doulaId,
        subject,
        `${profile.full_name}\n${reviewUrl}`,
        `doula-review:${eventId}`,
      ]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  // Delivery failures leave committed emails queued for the scheduled retry.
  if (eventId) await deliverProfileReviewEmails(eventId).catch(() => undefined);
  return submittedAt;
}
export async function submitDoulaProfile(
  doulaId: string,
  tenantId: string
): Promise<string> {
  return (await transitionDoulaProfile({
    doulaId,
    tenantId,
    actorId: doulaId,
    action: 'submitted',
  }))!;
}
