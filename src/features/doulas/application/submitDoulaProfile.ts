import { getPool } from '../../../db/cloudSqlPool';
import { NotFoundError, ValidationError } from '../../../domains/errors';
import { NodemailerService } from '../../../services/emailService';
import { missingProfileFields } from '../domain/profile';

/** Row lock and one transaction make repeated/concurrent submissions idempotent. */
export async function submitDoulaProfile(
  doulaId: string,
  tenantId: string
): Promise<string> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, full_name, address, city, state, country, zip_code, bio, profile_submitted_at
      FROM public.doulas WHERE id=$1::uuid AND tenant_id=$2::uuid FOR UPDATE`,
      [doulaId, tenantId]
    );
    const profile = rows[0];
    if (!profile) throw new NotFoundError('Profile not found.');
    if (profile.profile_submitted_at) {
      await client.query('COMMIT');
      return new Date(profile.profile_submitted_at).toISOString();
    }
    const [firstname, ...rest] = String(profile.full_name || '')
      .trim()
      .split(/\s+/);
    if (
      missingProfileFields({ ...profile, firstname, lastname: rest.join(' ') })
        .length
    ) {
      throw new ValidationError(
        'Complete your name, address, and bio before submitting.'
      );
    }
    const certificate = await client.query(
      `SELECT 1 FROM public.doula_documents doc
      JOIN public.doulas owner ON owner.id::text=doc.doula_id
      WHERE doc.doula_id=$1::text AND owner.tenant_id=$2::uuid AND doc.document_type='training_certificate'
      AND doc.status IN ('uploaded','approved') AND NULLIF(doc.file_path, '') IS NOT NULL LIMIT 1`,
      [doulaId, tenantId]
    );
    if (!certificate.rowCount)
      throw new ValidationError(
        'Upload your Doula training certificate before submitting.'
      );
    const crmLink = `${(process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/+$/, '')}/hours/${doulaId}`;
    const body = `${profile.full_name}\n${crmLink}`;
    const notices = await client.query(
      "SELECT to_regclass('public.dashboard_notices') AS name"
    );
    if (notices.rows[0]?.name) {
      await client.query(
        `INSERT INTO public.dashboard_notices
        (tenant_id, audience, doula_id, rule_id, severity, title, body, dedupe_key, blocks_payout)
        VALUES ($1::uuid, 'admin', $2::uuid, 'doula_profile_submitted', 'info', 'Doula profile submitted for review', $3, $4, false)
        ON CONFLICT DO NOTHING`,
        [
          tenantId,
          doulaId,
          body,
          `doula-profile-submitted:${tenantId}:${doulaId}`,
        ]
      );
    } else {
      const settings = await client.query(
        'SELECT intake_notification_email FROM public.tenant_settings WHERE tenant_id=$1::uuid',
        [tenantId]
      );
      const recipient = settings.rows[0]?.intake_notification_email?.trim();
      if (!recipient)
        throw new ValidationError(
          'Your organization must configure its notification email before profile submission.'
        );
      await new NodemailerService().sendEmail(
        recipient,
        'Doula profile submitted for review',
        body
      );
    }
    const submitted = await client.query(
      `UPDATE public.doulas SET profile_submitted_at=now(), updated_at=now()
      WHERE id=$1::uuid AND tenant_id=$2::uuid RETURNING profile_submitted_at`,
      [doulaId, tenantId]
    );
    await client.query('COMMIT');
    return new Date(submitted.rows[0].profile_submitted_at).toISOString();
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
