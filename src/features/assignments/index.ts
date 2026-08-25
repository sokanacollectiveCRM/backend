/**
 * Assignment notifications feature API.
 */

export {
  DOULA_ASSIGNMENT_NOTIFICATION_SUBJECT,
  DOULA_ASSIGNMENT_EMAIL_FORBIDDEN_FIELD_LABELS,
  buildDoulaAssignmentNotificationEmail,
  buildAuthenticatedDoulaClientActivitiesUrl,
  doulaAssignmentEmailContainsForbiddenLabels,
} from './notifications/doulaAssignmentNotificationEmail';
export type {
  DoulaAssignmentNotificationInput,
  DoulaAssignmentEmailContent,
} from './notifications/doulaAssignmentNotificationEmail';
