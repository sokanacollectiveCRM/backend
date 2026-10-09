# Sokana360 messaging reminder engine

Admin-configurable reminder policies (backend prompt v4). Deploy the PR to the **dev / pilot** Cloud Run API first. **Do not create the Cloud Scheduler job until that deploy is live.**

Native contract signing in this repo is the e-sign implementation. There is no third-party e-sign vendor and **no deposit reminder policy**.

## Columns used by the engine

| Concern | Source |
| --- | --- |
| Baby delivered / outcomes recorded | `phi_clients.birth_outcomes_delivery_type` (also induction + medications on the dedicated PUT). There is **no** `baby_delivered` column; a `baby_delivered` event hook exists for a future flag. |
| Estimated due date | `phi_clients.due_date` (same column as `GET /api/dashboard/calendar`) |
| Deposit paid | `payment_installments.payment_type = 'deposit'` with status `paid` / `succeeded` / `completed`, joined through `payment_schedules.contract_id`. Deposit is required only for self-pay (`phi_clients.payment_method` → `isClientDepositRequired`). Zero / missing deposit installment = no deposit due. |
| Note activity | `client_activities.timestamp` (admin `POST /clients/:id/activity`, doula `POST /api/doulas/clients/:clientId/activities`) |
| Hours | `hours` (`type = postpartum`) vs contracted hours from the latest `phi_contracts` JSON (`total_hours` / `contract_data.total_hours`) |

## Migration

```bash
npm run migrate:cloudsql -- src/db/migrations/20261009_messaging_reminder_policies.sql
```

Not run at boot. Safe to re-run (insert-if-missing seeds; does not clobber admin edits).

## Env vars (set on the **dev** Cloud Run service)

| Variable | Dev value | Notes |
| --- | --- | --- |
| `REMINDER_CRON_OIDC_AUDIENCE` | `$CLOUD_RUN_URL` (no path, no trailing slash) | Must match Scheduler OIDC audience |
| `REMINDER_CRON_OIDC_SERVICE_ACCOUNT` | `reminder-scheduler@sokana-private-data.iam.gserviceaccount.com` | Verified token email |
| `REMINDERS_ENABLED` | `true` | Boot default; DB kill switch wins |
| `ADMIN_NOTIFICATION_EMAIL` | `hello@sokanacollective.com` | Default admin recipient |
| `BILLING_NOTIFICATION_EMAIL` | placeholder until Antrice's address is provided | DB setting wins |
| `REMINDER_TEST_TOOLS_ENABLED` | `true` | **Dev only.** Enables Advance now / Run tick now |

## Tick URL (Cloud Scheduler, after dev deploy)

`POST ${CLOUD_RUN_URL}/api/internal/cron/reminders/tick`

Anonymous calls must return 401/403. Job name (when created): `sokana-reminders-tick-dev`, every 5 minutes, OIDC.

## Frontend API catalog

All admin routes: cookie session + `authorizeRoles(['admin'])`. Success shape `{ success: true, data }` or `{ success: true, data, meta }`.

| Method | Path | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| GET | `/api/admin/messaging/policies` | admin | — | `{ success, data: Policy[], meta.count }` (includes `steps`) |
| GET | `/api/admin/messaging/policies/:id` | admin | — | `{ success, data: Policy }` |
| PATCH | `/api/admin/messaging/policies/:id` | admin | `{ enabled?, stopConditions?, endAction?, endActionDelayValue?, endActionDelayUnit?, endActionTemplateKeys?, notifyAdminEmail?, alertAdminAfterSends?, config?, name?, description? }` | `{ success, data: Policy }` |
| PUT | `/api/admin/messaging/policies/:id/steps` | admin | `{ steps: [{ stepOrder, delayValue, delayUnit, repeatEveryValue?, repeatEveryUnit?, channel, recipientRoles, templateId, enabled }] }` | `{ success, data: Step[] }` |
| GET | `/api/admin/messaging/templates` | admin | — | `{ success, data: Template[] }` |
| GET | `/api/admin/messaging/templates/:id` | admin | — | `{ success, data: Template }` |
| PATCH | `/api/admin/messaging/templates/:id` | admin | `{ name?, channel?, subject?, bodyText?, bodyHtml? }` (version bump; merge-field allow-list) | `{ success, data: Template }` |
| POST | `/api/admin/messaging/templates/:id/preview` | admin | `{ sample?: Record<string,string> }` | `{ success, data: { subject, bodyText, bodyHtml, version } }` |
| POST | `/api/admin/messaging/templates/:id/test-send` | admin | `{ sample? }` | Sends **only** to `req.user.email`. `{ success, data: { sentTo, templateKey } }` |
| GET | `/api/admin/messaging/runs` | admin | query `status`, `policyKey`, `clientId`, `contractId` | `{ success, data: Run[] }` |
| GET | `/api/admin/messaging/send-log` | admin | query `limit`, `offset`, `policyKey`, `status` | `{ success, data, meta: { count, limit, offset } }` |
| GET | `/api/admin/messaging/settings` | admin | — | `{ success, data }` includes `remindersEnabled`, emails, `evaluationLink`, **`overdue_days`**, `test_tools_enabled` |
| PATCH | `/api/admin/messaging/settings` | admin | `{ remindersEnabled?, testRecipientOverrideEmail?, contactEmail?, adminNotificationEmail?, billingNotificationEmail?, evaluationLink? }` | `{ success, data }` |
| GET | `/api/admin/messaging/alerts` | admin | query `unacknowledged=true` | `{ success, data: Alert[] }` |
| POST | `/api/admin/messaging/alerts/:id/ack` | admin | — | `{ success, data: Alert }` |
| POST | `/api/admin/contracts/:id/reminders/stop` | admin | `{ reason? }` | `{ success, data: { stopped: true } }` |
| POST | `/api/admin/contracts/:id/reminders/resume` | admin | — | `{ success, data: { resumed: true } }` (re-anchors to now) |
| GET | `/api/admin/clients/:id/postponements` | admin | — | `{ success, data: Postponement[] }` |
| POST | `/api/admin/clients/:id/postponements` | admin | `{ contractId?, reasonCode: waiting_paycheck\|waiting_insurance_medicaid\|other, reasonNote?, restartAt? }` | 201 `{ success, data: { postponement, warning? } }` |
| POST | `/api/admin/postponements/:id/approve` | admin | — | `{ success, data: Postponement }` |
| POST | `/api/admin/postponements/:id/lift` | admin | — | restart now from step 1 |
| POST | `/api/admin/postponements/:id/extend` | admin | `{ restartAt }` | `{ success, data: { postponement, warning? } }` |
| POST | `/api/admin/postponements/:id/cancel` | admin | — | runs end action now |
| POST | `/api/doulas/clients/:id/postponement-requests` | doula | same create body | 201 requested (not yet active) |
| POST | `/api/internal/cron/reminders/tick` | OIDC | empty | `{ claimed, sent, skipped, failed, endActions, postponedRestarted, scansStarted }` or `{ suppressed: true, ... }` |
| POST | `/api/admin/messaging/runs/:id/advance` | admin + flag | — | 404 unless `REMINDER_TEST_TOOLS_ENABLED` |
| POST | `/api/admin/messaging/tick-now` | admin + flag | — | 404 unless flag |

Recipient roles: `client | doula | admin | billing`. Delay units: `minutes | hours | days | business_days`.
