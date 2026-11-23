import { randomUUID } from 'crypto';

import { UPLOADABLE_DOULA_DOCUMENT_TYPES } from '../../../constants/doulaDocuments';
import { getPool } from '../../../db/cloudSqlPool';
import { NotFoundError, ValidationError } from '../../../domains/errors';
import {
  REQUIRED_DOULA_DOCUMENT_TYPES,
  backgroundCheckSatisfied,
} from '../domain/documentPolicy';
import { isValidPhone, missingProfileFields } from '../domain/profile';
import {
  SENSITIVE_DOCUMENT_TYPES,
  isSensitiveDocument,
} from './backgroundCheck';
import {
  deliverProfileReviewEmails,
  findDoulaReviewAdminEmails,
} from './profileReviewEmail';

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
    if (input.action !== 'submitted' && !profile.profile_submitted_at)
      throw new ValidationError(
        'This profile cannot be reviewed until the doula completes onboarding and submits it.'
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
      if (
        input.action === 'approved' &&
        !backgroundCheckSatisfied(profile.background_check_status)
      )
        throw new ValidationError(
          'HR/payroll must mark the background check Cleared before profile review.'
        );
      let canApproveSensitiveDocuments = false;
      if (input.action === 'approved') {
        const access = await client.query(
          `SELECT 1 FROM public.doula_hr_permissions
           WHERE tenant_id=$1::uuid AND admin_id=$2
             AND department IN ('hr','payroll') LIMIT 1`,
          [input.tenantId, input.actorId]
        );
        canApproveSensitiveDocuments = !!access.rowCount;
      }
      for (const type of REQUIRED_DOULA_DOCUMENT_TYPES) {
        const canApproveUploaded =
          input.action === 'submitted' ||
          (input.action === 'approved' &&
            (!isSensitiveDocument(type) || canApproveSensitiveDocuments));
        const document = await client.query(
          `SELECT 1 FROM (
             SELECT status,file_path FROM public.doula_documents WHERE doula_id=$1::text
             AND tenant_id=$4::uuid AND document_type=$3 ORDER BY uploaded_at DESC,id DESC LIMIT 1
           ) current_document WHERE NULLIF(file_path,'') IS NOT NULL
           AND (status='approved' OR ($2::boolean AND status='uploaded'))`,
          [input.doulaId, canApproveUploaded, type, input.tenantId]
        );
        if (!document.rowCount)
          throw new ValidationError(
            `Required ${type === 'training_certificate' ? 'training certificate' : type} must be ${input.action === 'approved' && isSensitiveDocument(type) && !canApproveSensitiveDocuments ? 'approved by HR/payroll' : 'uploaded'} before profile review.`
          );
      }
      if (['submitted', 'approved'].includes(input.action)) {
        const rejected = await client.query(
          `SELECT 1 FROM (
             SELECT DISTINCT ON (document_type) status
             FROM public.doula_documents
             WHERE doula_id=$1::text AND tenant_id=$2::uuid
               AND document_type=ANY($3::text[])
             ORDER BY document_type,uploaded_at DESC,id DESC
           ) current_documents WHERE status='rejected' LIMIT 1`,
          [input.doulaId, input.tenantId, UPLOADABLE_DOULA_DOCUMENT_TYPES]
        );
        if (rejected.rowCount)
          throw new ValidationError(
            `Replace or remove rejected documents before ${input.action === 'approved' ? 'approval' : 'resubmitting'}.`
          );
      }
      if (input.action === 'approved') {
        await client.query(
          `WITH current_documents AS (
             SELECT DISTINCT ON (document_type) id,document_type
             FROM public.doula_documents
             WHERE doula_id=$1::text AND tenant_id=$2::uuid
               AND document_type=ANY($4::text[])
             ORDER BY document_type,uploaded_at DESC,id DESC
           )
           UPDATE public.doula_documents d
           SET status='approved',reviewed_at=now(),reviewed_by=$3,
               rejection_reason=NULL,updated_at=now()
           FROM current_documents current
           WHERE d.id=current.id AND d.status='uploaded'
             AND ($5::boolean OR NOT (d.document_type=ANY($6::text[])))`,
          [
            input.doulaId,
            input.tenantId,
            input.actorId,
            UPLOADABLE_DOULA_DOCUMENT_TYPES,
            canApproveSensitiveDocuments,
            SENSITIVE_DOCUMENT_TYPES,
          ]
        );
      }
    }
    const recipients = await findDoulaReviewAdminEmails(client, input.tenantId);
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
    const doulaName = String(profile.full_name || 'Doula').trim() || 'Doula';
    const doulaFirstName = doulaName.split(/\s+/)[0] || 'Doula';
    const doulaSubject =
      input.action === 'approved'
        ? 'Sokana360: Your profile is approved'
        : input.action === 'changes_requested'
          ? 'Sokana360: Changes requested for your profile'
          : resubmitted
            ? 'Sokana360: Your profile was resubmitted for review'
            : 'Sokana360: Your profile was submitted for review';
    const adminSubject =
      input.action === 'approved'
        ? 'Sokana360: ' + doulaName + "'s profile was approved"
        : input.action === 'changes_requested'
          ? 'Sokana360: Changes were requested from ' + doulaName
          : 'Sokana360: ' +
            doulaName +
            (resubmitted
              ? ' resubmitted a profile for review'
              : ' submitted a profile for review');
    const doulaSummary =
      input.action === 'approved'
        ? 'Hello ' +
          doulaFirstName +
          ',\n\nYour profile and all current uploaded documents have been approved. Your profile setup is complete, and your dashboard remains available.'
        : input.action === 'changes_requested'
          ? 'Hello ' +
            doulaFirstName +
            ',\n\nThe Sokana team reviewed your profile and requested changes before approval.\n\nRequested changes:\n' +
            reason +
            '\n\nUpdate your profile and any rejected documents. Your dashboard remains available while you complete these updates.'
          : resubmitted
            ? 'Hello ' +
              doulaFirstName +
              ',\n\nYou completed the requested updates, and your profile has been resubmitted to the Sokana team for review. Your dashboard remains available while you wait for the review.'
            : 'Hello ' +
              doulaFirstName +
              ',\n\nYou completed the required profile information and uploaded the required documents. Your profile has been submitted to the Sokana team for review. Your dashboard remains available while you wait for the review.';
    const adminSummary =
      input.action === 'approved'
        ? 'Hello Sokana team,\n\n' +
          doulaName +
          "'s profile and all current uploaded documents were approved. No further onboarding review action is required."
        : input.action === 'changes_requested'
          ? 'Hello Sokana team,\n\nThe requested changes were sent to ' +
            doulaName +
            '.\n\nRequested changes:\n' +
            reason +
            '\n\nThe profile remains pending until the doula completes the updates and resubmits it.'
          : 'Hello Sokana team,\n\n' +
            doulaName +
            ' completed the required profile information and uploaded the required documents. The profile has been ' +
            (resubmitted ? 'resubmitted' : 'submitted') +
            ' and is ready for admin review.';
    const doulaEmail = profile.email.trim().toLowerCase();
    for (const recipient of new Set(
      [doulaEmail, ...recipients.rows.map((row) => row.email)]
        .map((email: string) => email.trim().toLowerCase())
        .filter(Boolean)
    )) {
      const isDoula = recipient === doulaEmail;
      const subject = isDoula ? doulaSubject : adminSubject;
      const summary = isDoula ? doulaSummary : adminSummary;
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
        adminSubject,
        `${adminSummary}\n\nReview in Teams: ${reviewUrl}`,
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
