# Messaging reminder API catalog (backend v4)

Base: session cookie / `X-Session-Token` unless noted. Admin routes return
`{ success: true, data }` or `{ success: true, data, meta: { count } }`.

Do not create the Cloud Scheduler job until this PR is deployed to the **dev**
Cloud Run API. Tick path: `POST /api/internal/cron/reminders/tick`.

## Admin (role `admin`)

| Method | Path                                           | Auth                                       | Request                                                                                                                                                                                                | Response                                                                                                   |
| ------ | ---------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| GET    | `/api/admin/messaging/policies`                | admin                                      | —                                                                                                                                                                                                      | `{ data: PolicyWithSteps[] }`                                                                              |
| GET    | `/api/admin/messaging/policies/:id`            | admin                                      | —                                                                                                                                                                                                      | `{ data: PolicyWithSteps }`                                                                                |
| PATCH  | `/api/admin/messaging/policies/:id`            | admin                                      | `{ enabled?, stop_conditions?, end_action?, end_action_delay_value?, end_action_delay_unit?, end_action_template_keys?, notify_admin_email?, alert_admin_after_sends?, config?, name?, description? }` | `{ data: PolicyWithSteps }`                                                                                |
| PUT    | `/api/admin/messaging/policies/:id/steps`      | admin                                      | `{ steps: [{ step_order, delay_value, delay_unit, repeat_every_value?, repeat_every_unit?, channel, recipient_roles, template_id, enabled }] }`                                                        | `{ data: PolicyWithSteps }`                                                                                |
| GET    | `/api/admin/messaging/templates`               | admin                                      | —                                                                                                                                                                                                      | `{ data: MessageTemplate[] }`                                                                              |
| GET    | `/api/admin/messaging/templates/:id`           | admin                                      | —                                                                                                                                                                                                      | `{ data: MessageTemplate }`                                                                                |
| PATCH  | `/api/admin/messaging/templates/:id`           | admin                                      | `{ name?, channel?, subject?, body_text?, body_html? }` (merge fields allow-listed; version++)                                                                                                         | `{ data: MessageTemplate }`                                                                                |
| POST   | `/api/admin/messaging/templates/:id/preview`   | admin                                      | `{ sample?: Record<string,string> }`                                                                                                                                                                   | `{ data: { subject, text, html, version, key } }`                                                          |
| POST   | `/api/admin/messaging/templates/:id/test-send` | admin                                      | `{ sample?: Record<string,string> }`                                                                                                                                                                   | `{ data: { sent, to } }` — always the logged-in admin                                                      |
| GET    | `/api/admin/messaging/runs`                    | admin                                      | `status, policy_key, client_id, contract_id, page, page_size`                                                                                                                                          | `{ data: ReminderRun[], meta }` (`test_tools_enabled` in meta)                                             |
| GET    | `/api/admin/messaging/send-log`                | admin                                      | pagination / `policy_key`                                                                                                                                                                              | `{ data: ReminderSendLog[] }`                                                                              |
| GET    | `/api/admin/messaging/settings`                | admin                                      | —                                                                                                                                                                                                      | kill switch, override, contact/admin/billing emails, evaluation_link, `overdue_days`, `test_tools_enabled` |
| PATCH  | `/api/admin/messaging/settings`                | admin                                      | `{ reminders_enabled?, test_recipient_override_email?, contact_email?, admin_notification_email?, billing_notification_email?, evaluation_link? }`                                                     | settings                                                                                                   |
| GET    | `/api/admin/messaging/alerts`                  | admin                                      | `acknowledged=true\|false`                                                                                                                                                                             | `{ data: AdminAlert[] }`                                                                                   |
| POST   | `/api/admin/messaging/alerts/:id/ack`          | admin                                      | —                                                                                                                                                                                                      | `{ data: AdminAlert }`                                                                                     |
| POST   | `/api/admin/contracts/:id/reminders/stop`      | admin                                      | `{ reason? }`                                                                                                                                                                                          | `{ data: { stopped } }`                                                                                    |
| POST   | `/api/admin/contracts/:id/reminders/resume`    | admin                                      | —                                                                                                                                                                                                      | `{ data: { resumed } }`                                                                                    |
| GET    | `/api/admin/clients/:id/postponements`         | admin                                      | —                                                                                                                                                                                                      | history                                                                                                    |
| POST   | `/api/admin/clients/:id/postponements`         | admin                                      | `{ contract_id?, reason_code, reason_note?, restart_at? }` (`waiting_paycheck \| waiting_insurance_medicaid \| other`; default restart = now+14d)                                                      | `{ postponement, warning }`                                                                                |
| POST   | `/api/admin/postponements/:id/approve`         | admin                                      | —                                                                                                                                                                                                      | postponement                                                                                               |
| POST   | `/api/admin/postponements/:id/lift`            | admin                                      | —                                                                                                                                                                                                      | postponement (restart now from step 1)                                                                     |
| POST   | `/api/admin/postponements/:id/extend`          | admin                                      | `{ restart_at }`                                                                                                                                                                                       | `{ postponement, warning }`                                                                                |
| POST   | `/api/admin/postponements/:id/cancel`          | admin                                      | —                                                                                                                                                                                                      | postponement (end action now)                                                                              |
| POST   | `/api/admin/messaging/tick-now`                | admin + `REMINDER_TEST_TOOLS_ENABLED=true` | —                                                                                                                                                                                                      | tick counts; **404 if flag off**                                                                           |
| POST   | `/api/admin/messaging/runs/:id/advance`        | admin + test tools                         | —                                                                                                                                                                                                      | tick counts for one run; **404 if flag off**                                                               |

## Doula

| Method | Path                                            | Auth  | Request                   | Response                                       |
| ------ | ----------------------------------------------- | ----- | ------------------------- | ---------------------------------------------- |
| POST   | `/api/doulas/clients/:id/postponement-requests` | doula | same body as admin create | `{ postponement, warning }` status=`requested` |

## Internal (Cloud Scheduler)

| Method | Path                                | Auth                                                                                                                                    | Response                                                                                                                   |
| ------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/internal/cron/reminders/tick` | Bearer Google OIDC. `aud` = `REMINDER_CRON_OIDC_AUDIENCE` (dev Cloud Run URL, no path). `email` = `REMINDER_CRON_OIDC_SERVICE_ACCOUNT`. | `{ claimed, sent, skipped, failed, endActions, postponementsRestarted, scansStarted }` or `{ suppressed: true, ...zeros }` |

## Seeded policies

Enabled: `contract_signing` (day 3 client + doula, day 7 void if unsigned),
`birth_outcomes` (due date + 5), `overdue_notes` (7 days), `admin_note_added`,
`headshot_updated`, `routine_updates`, `postponement_events`.

Disabled until their product trigger exists: `service_completed_evaluation`,
`evaluation_received`, `postpartum_hours_low`, `card_not_on_file`,
`doula_interview_logged`.

No `deposit_payment` policy.

## Columns the engine uses

- Estimated due date: `phi_clients.due_date`
- Baby Delivered: no dedicated column; hook `baby_delivered` or due-date scan
- Birth outcomes recorded: structured `birth_outcomes_induction`,
  `birth_outcomes_delivery_type`, `birth_outcomes_medications_used`
- Deposit paid: `payment_installments.payment_type = 'deposit'` status in
  `paid|succeeded|completed`; no deposit due if no positive deposit installment
- Notes: `client_activities.timestamp`
- Per-contract stop: `phi_contracts.reminders_stopped` (not a contract status)
