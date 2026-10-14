# Oct21 dev visit reminders

DO NOT MERGE — dev pilot. Depends on notification rules PR #100, the scheduling
MVP (`cursor/pilot-scheduling-mvp-backend-c17a`), the deployed profile work, and
the Oct21 email branch. Existing dev features are retained.

## Behavior

The existing tick at `POST /internal/cron/notification-tick` sends separate
client and doula reminders 24 hours before a visit and from 7 AM on its local
date. A late booking skips the 24-hour reminder. A visit before 7 AM gets no
morning reminder. Tenant timezone is used, with America/Chicago as fallback.
Cancelled, postponed, started, or rescheduled visits are checked again
immediately before sending. Each recipient and start-time has a separate durable
delivery key.

The delivery claim is at most once. Ambiguous SMTP failures remain logged as
failed and require admin review; they are not automatically retried into a
possible duplicate. The existing notification kill switch applies.

## Dev migration order

Prerequisites already existed on dev and were verified through schema metadata:

1. `add_doula_availability_and_scheduling_cloudsql.sql`
2. `20261011_scheduling_booking_overlap_index.sql`
3. `20261012_notification_rules.sql`

New additive migrations applied on dev:

1. `20261014_family_auto_invites.sql` (email branch)
2. `20261014_visit_reminder_tenancy.sql`

## Scheduler

The existing ENABLED `sokana-dev-notification-tick` already targets:

`https://sokana-private-api-dev-46lcr3n2qa-uc.a.run.app/internal/cron/notification-tick`

No job was created, changed, or manually triggered. The older contract-only job
is paused. OIDC verification continues to use `NOTIFICATION_TICK_AUDIENCE` and
`NOTIFICATION_TICK_EMAIL`.

## Preview and verification

Optional `NOTIFICATION_DEV_TEST_TENANT_ID` enables an admin-only preview
endpoint for that fictional tenant. It is disabled unless the service is exactly
`sokana-private-api-dev` and database exactly `sokana_private_dev`.

`POST /api/notifications/dev/visit-reminders/tick` accepts `bookingId` and an
ISO `now`. It captures email previews and logs separate `preview:` delivery
keys; it never calls SMTP. Advancing `now` permits immediate morning/24-hour
tests without changing production timing constants. Leave this variable unset
for normal operation.

Run `scripts/e2e/verify-oct21-reminders.ts` with local dev proxy credentials,
`NODE_ENV=development`, and `CLOUD_SQL_DATABASE=sokana_private_dev`. It refuses
other databases, creates isolated fictional records, checks actual SQL delivery
claims, captures email HTML, and deletes its records in `finally`. Family invite
transport is intercepted; the actual durable claim and both gates are tested. It
does not inspect existing client records or call Firebase/SMTP.

The generated `/tmp/oct21-email-previews.json` feeds the frontend Playwright
configuration `playwright.oct21-emails.config.ts`. These checks verify rendered
email content, setup links, footer logo, timezone, and CRM links. They are email
rendering checks, not a claim that a real mailbox was tested. Video is omitted
per Jerry's earlier instruction.

## Family email notes

Staff invitations retain the requested Sokana360 footer logo and shared copy for
admins and doulas, following Jerry's explicit instruction. Both family emails
set Reply-To to hello@sokanacollective.com. An automatic family invite requires
eligibility, signed agreement, paid deposit, and not-invited status. Reading
readiness does not send email. `FAMILY_AUTO_INVITE_ENABLED` defaults on only for
the exact dev service and database; explicit false disables it. Manual invite
and resend continue to work. A failed/ambiguous automatic attempt requires a
manual resend after review.
