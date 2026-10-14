/**
 * Sokana360 notification rules. These values are the source of truth.
 * There is no editor. Later rules stay off until that feature exists.
 */

export const CONTACT_EMAIL = 'hello@sokanacollective.com';

export const SIGNING_WINDOW_DAYS = 7;
export const SIGNING_REMINDER_DAY = 3;
export const POSTPONEMENT_DEFAULT_DAYS = 14;
export const BIRTH_OUTCOME_GRACE_DAYS = 5;
export const BIRTH_OUTCOME_REPEAT_HOURS = 48;
export const BIRTH_OUTCOME_ADMIN_AFTER_REMINDERS = 3;
export const NOTE_OVERDUE_DAYS = 7;

export interface NotificationRule {
  readonly enabled: boolean;
  readonly editable: false;
  readonly adminEmail: boolean;
  readonly seededOff?: boolean;
}

const fixed = (
  enabled: boolean,
  adminEmail = false,
  seededOff = false
): NotificationRule => ({
  enabled,
  editable: false,
  adminEmail,
  ...(seededOff ? { seededOff: true } : {}),
});

export const NOTIFICATION_RULES = {
  contract_day0_sign_by: fixed(true),
  contract_day3_client: fixed(true),
  contract_day3_doula: fixed(true),
  contract_day7_void: fixed(true, false),
  contract_day7_deposit_unpaid: fixed(true, false),
  postponement_doula: fixed(true),
  postponement_restart: fixed(true),
  birth_outcomes_doula: fixed(true),
  birth_outcomes_admin: fixed(true, false),
  overdue_notes: fixed(true, true),
  event_admin_note: fixed(true),
  event_headshot: fixed(true, false),
  event_routine_update: fixed(true, false),
  event_postponement: fixed(true),
  service_completed_evaluation: fixed(false, false, true),
  evaluation_received: fixed(false, false, true),
  postpartum_hours_low: fixed(false, false, true),
  billing_card_issue: fixed(false, false, true),
  doula_interview_logged: fixed(false, false, true),
} as const;

export type NotificationRuleId = keyof typeof NOTIFICATION_RULES;

export function isRuleEnabled(ruleId: NotificationRuleId): boolean {
  return NOTIFICATION_RULES[ruleId].enabled;
}
