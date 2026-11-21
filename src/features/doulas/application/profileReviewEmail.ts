import type { PoolClient } from 'pg';

import { getPool } from '../../../db/cloudSqlPool';
import { NodemailerService } from '../../../services/emailService';

export function findDoulaReviewAdminEmails(
  database: Pick<PoolClient, 'query'>,
  tenantId: string
) {
  return database.query<{ email: string }>(
    `SELECT lower(trim(intake_notification_email)) AS email FROM public.tenant_settings
     WHERE tenant_id=$1::uuid AND NULLIF(trim(intake_notification_email),'') IS NOT NULL
     UNION SELECT lower(trim(email)) AS email FROM public.admins
     WHERE tenant_id=$1::uuid AND NULLIF(trim(email),'') IS NOT NULL`,
    [tenantId]
  );
}

/** Durable queue: concurrent workers cannot deliver the same row simultaneously. */
export async function deliverProfileReviewEmails(
  eventId?: string
): Promise<void> {
  const client = await getPool().connect();
  try {
    for (let i = 0; i < 20; i++) {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT id, recipient, subject, body FROM public.doula_review_emails
         WHERE sent_at IS NULL AND retry_at <= now() AND ($1::uuid IS NULL OR event_id=$1::uuid)
         ORDER BY retry_at FOR UPDATE SKIP LOCKED LIMIT 1`,
        [eventId ?? null]
      );
      if (!rows[0]) {
        await client.query('COMMIT');
        break;
      }
      const email = rows[0];
      try {
        await new NodemailerService().sendEmail(
          email.recipient,
          email.subject,
          email.body
        );
        await client.query(
          'UPDATE public.doula_review_emails SET sent_at=now(), attempts=attempts+1 WHERE id=$1',
          [email.id]
        );
      } catch {
        await client.query(
          "UPDATE public.doula_review_emails SET attempts=attempts+1, retry_at=now()+interval '5 minutes' WHERE id=$1",
          [email.id]
        );
      }
      await client.query('COMMIT');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
