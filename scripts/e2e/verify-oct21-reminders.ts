/** Dev-only, fictional fixtures. Captures email builders; never sends SMTP. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import { getPool } from '../../src/db/cloudSqlPool';
import { buildIntakeSubmitterConfirmationEmail } from '../../src/features/intake/notifications/intakeStaffNotificationEmail';
import { runVisitReminders } from '../../src/features/notifications/application/runVisitReminders';
import type {
  VisitRecipientRole,
  VisitReminderCandidate,
} from '../../src/features/notifications/domain/visitReminders';
import {
  NotificationEmail,
  buildVisitReminderEmail,
} from '../../src/features/notifications/infrastructure/notificationEmail';
import { NotificationStore } from '../../src/features/notifications/infrastructure/notificationStore';
import { buildFamilyInvitationEmail } from '../../src/features/portal/application/familyInvitationEmail';
import { maybeAutoInviteFamily } from '../../src/features/portal/application/maybeAutoInviteFamily';
import type { PortalEligibilitySnapshot } from '../../src/features/portal/domain/eligibility';
import { assertDevSchedulingTarget } from '../../src/features/scheduling/application/devTargetGuard';
import { runWithTenant } from '../../src/features/tenancy';
import { PortalInviteService } from '../../src/services/portalInviteService';
import { buildStaffInvitationEmail } from '../../src/services/staffInvitationEmail';

async function main() {
  assertDevSchedulingTarget();
  assert.equal(process.env.CLOUD_SQL_DATABASE, 'sokana_private_dev');
  process.env.FRONTEND_URL =
    'https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app';
  process.env.USE_TEST_EMAIL = 'true';
  process.env.FAMILY_AUTO_INVITE_ENABLED = 'true';
  const pool = getPool();
  const tenant = randomUUID(),
    client = randomUUID(),
    doula = randomUUID(),
    booking = randomUUID();
  const captured: Array<{ subject: string; text: string; html: string }> = [];
  class CaptureEmail extends NotificationEmail {
    override async sendVisitReminder(
      row: VisitReminderCandidate,
      role: VisitRecipientRole,
      now: Date
    ) {
      captured.push(buildVisitReminderEmail(row, role, now));
    }
  }
  const oldInvite = PortalInviteService.prototype.inviteClientToPortal;
  let invites = 0;
  try {
    await pool.query(
      `INSERT INTO public.tenants(id,slug,name) VALUES($1,$2,'Oct21 fictional reminders')`,
      [tenant, `oct21-reminders-${tenant}`]
    );
    await pool.query(
      `INSERT INTO public.tenant_settings(tenant_id,timezone,intake_enabled) VALUES($1,'America/Chicago',false)`,
      [tenant]
    );
    await pool.query(
      `INSERT INTO public.doulas(id,full_name,email,tenant_id) VALUES($1,'Jordan Lake','jerry+reminder-doula@example.com',$2)`,
      [doula, tenant]
    );
    await pool.query(
      `INSERT INTO public.phi_clients(id,first_name,last_name,email,tenant_id,portal_status,is_test) VALUES($1,'Maya','Rivers','jerry+reminder-family@example.com',$2,'not_invited',true)`,
      [client, tenant]
    );
    await pool.query(
      `INSERT INTO public.doula_booking_requests(id,client_id,doula_id,start_at,end_at,status,created_at,tenant_id) VALUES($1,$2,$3,'2099-10-21T15:00:00Z','2099-10-21T16:00:00Z','approved','2099-10-18T15:00:00Z',$4)`,
      [booking, client, doula, tenant]
    );
    const store = new NotificationStore(),
      email = new CaptureEmail(),
      scope = { bookingId: booking, tenantId: tenant };
    const tick = (time: string) =>
      runVisitReminders(new Date(time), store, email, scope);
    assert.equal((await tick('2099-10-20T15:00:00Z')).sent, 2);
    assert.equal((await tick('2099-10-20T15:00:00Z')).sent, 0);
    assert.equal((await tick('2099-10-21T12:00:00Z')).sent, 2);
    assert.equal((await tick('2099-10-21T12:00:00Z')).sent, 0);
    assert.equal(captured.length, 4);
    const deliveries = await pool.query(
      `SELECT rule_id,count(*)::int AS count FROM public.notification_deliveries WHERE subject_id=$1 AND tenant_id=$2 GROUP BY rule_id`,
      [booking, tenant]
    );
    assert.deepEqual(
      deliveries.rows.sort((a, b) => a.rule_id.localeCompare(b.rule_id)),
      [
        { rule_id: 'visit_reminder_24h', count: 2 },
        { rule_id: 'visit_reminder_morning', count: 2 },
      ]
    );
    await pool.query(
      `UPDATE public.doula_booking_requests SET start_at='2099-10-22T15:00:00Z',end_at='2099-10-22T16:00:00Z' WHERE id=$1 AND tenant_id=$2`,
      [booking, tenant]
    );
    assert.equal((await tick('2099-10-21T15:00:00Z')).sent, 2);
    await pool.query(
      `UPDATE public.doula_booking_requests SET status='cancelled' WHERE id=$1 AND tenant_id=$2`,
      [booking, tenant]
    );
    assert.equal((await tick('2099-10-22T12:00:00Z')).sent, 0);
    // Test the real durable claim with an intercepted invitation boundary: no Firebase or SMTP calls.
    PortalInviteService.prototype.inviteClientToPortal = async function (
      id,
      actor
    ) {
      assert.equal(id, client);
      assert.equal(actor, 'system:auto');
      invites++;
      await pool.query(
        `UPDATE public.phi_clients SET portal_status='invited' WHERE id=$1 AND tenant_id=$2`,
        [client, tenant]
      );
      return {} as never;
    };
    const ready = {
      is_eligible: true,
      contract_signed: true,
      deposit_paid: true,
    } as PortalEligibilitySnapshot;
    await runWithTenant(tenant, () =>
      maybeAutoInviteFamily(client, { ...ready, deposit_paid: false })
    );
    assert.equal(invites, 0);
    await runWithTenant(tenant, () =>
      maybeAutoInviteFamily(client, { ...ready, contract_signed: false })
    );
    assert.equal(invites, 0);
    await runWithTenant(tenant, () =>
      Promise.all([
        maybeAutoInviteFamily(client, ready),
        maybeAutoInviteFamily(client, ready),
      ])
    );
    await runWithTenant(tenant, () => maybeAutoInviteFamily(client, ready));
    assert.equal(invites, 1);
    const setupUrl =
      'https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app/signup?oobCode=fictional-preview';
    writeFileSync(
      process.env.OCT21_EMAIL_PREVIEW_FILE || '/tmp/oct21-email-previews.json',
      JSON.stringify({
        staff: buildStaffInvitationEmail({
          firstname: 'Jordan',
          email: 'jerry+reminder-doula@example.com',
          setupUrl,
          frontendUrl: 'https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app',
        }),
        received: buildIntakeSubmitterConfirmationEmail('Maya'),
        family: buildFamilyInvitationEmail({
          firstName: 'Maya',
          setupUrl: setupUrl.replace('/signup', '/auth/set-password'),
        }),
        reminders: captured,
      })
    );
    console.log(
      'PASS: dev SQL 2 deliveries/rule, repeat dedupe, reschedule, cancel, signed/deposit gates, concurrent family claim. Email boundaries intercepted; no mail sent.'
    );
  } finally {
    PortalInviteService.prototype.inviteClientToPortal = oldInvite;
    await pool.query(
      'DELETE FROM public.notification_deliveries WHERE tenant_id=$1 AND subject_id=$2',
      [tenant, booking]
    );
    await pool.query(
      'DELETE FROM public.family_auto_invites WHERE tenant_id=$1 AND client_id=$2',
      [tenant, client]
    );
    await pool.query(
      'DELETE FROM public.doula_booking_requests WHERE id=$1 AND tenant_id=$2',
      [booking, tenant]
    );
    await pool.query(
      'DELETE FROM public.phi_clients WHERE id=$1 AND tenant_id=$2',
      [client, tenant]
    );
    await pool.query('DELETE FROM public.doulas WHERE id=$1 AND tenant_id=$2', [
      doula,
      tenant,
    ]);
    await pool.query('DELETE FROM public.tenant_settings WHERE tenant_id=$1', [
      tenant,
    ]);
    await pool.query('DELETE FROM public.tenants WHERE id=$1', [tenant]);
    await pool.end();
    console.log(
      'Removed all fictional booking, client, doula, tenant settings, tenant and delivery fixtures.'
    );
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
