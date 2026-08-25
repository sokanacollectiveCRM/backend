/**
 * HIPAA-05 — Approved minimal doula assignment notification.
 *
 * Doula assignment mail must NOT include client email, names, assignment notes,
 * or clinical details. Notify with client_number + authenticated CRM link only.
 */

export const DOULA_ASSIGNMENT_NOTIFICATION_SUBJECT = 'New client assignment';

/** Clinical / identity markers that must never appear in assignment mail content. */
export const DOULA_ASSIGNMENT_EMAIL_FORBIDDEN_FIELD_LABELS = [
  'Assignment Notes',
  'Client Details',
  'Health History',
  'Allergies',
  'Health Notes',
  'Annual Income',
  'Due Date',
  'Birth Location',
  'Birth Hospital',
  'Baby Name',
  'Provider Type',
  'Pregnancy Number',
  'Past Pregnancy',
  'Insurance',
  'Address:',
  'Phone:',
  'Email:',
  'Name:',
  'Medications',
  'Race/Ethnicity',
  'Demographics',
] as const;

export interface DoulaAssignmentNotificationInput {
  clientNumber: string | null | undefined;
  crmActivitiesUrl: string;
}

export interface DoulaAssignmentEmailContent {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Builds the approved doula assignment notification (no PHI in subject/body/URL query).
 * CRM URL must be an authenticated doula deep-link:
 * `/doula-dashboard/activities/{opaqueClientId}`.
 */
export function buildDoulaAssignmentNotificationEmail(
  input: DoulaAssignmentNotificationInput
): DoulaAssignmentEmailContent {
  const clientRef =
    typeof input.clientNumber === 'string' && input.clientNumber.trim()
      ? input.clientNumber.trim()
      : 'Unavailable — open CRM activities list';
  const crmUrl = input.crmActivitiesUrl.trim();
  const safeClientRef = escapeHtml(clientRef);
  const safeCrmUrl = escapeHtml(crmUrl);

  const text = `You have been assigned a new client.

Client number: ${clientRef}

Open the CRM to review the assignment and client activities:
${crmUrl}

Do not reply to this message with client details.`;

  const html = `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
                    <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                      <h1 style="color: #007934; text-align: center; margin-bottom: 24px; border-bottom: 3px solid #007934; padding-bottom: 10px;">New Client Assignment</h1>
                      <p style="font-size: 16px; color: #333; line-height: 1.6;">
                        You have been assigned a new client.
                      </p>
                      <p style="font-size: 16px; color: #333; line-height: 1.6;">
                        <strong>Client number:</strong> ${safeClientRef}
                      </p>
                      <p style="font-size: 14px; color: #555; line-height: 1.6;">
                        Open the CRM to review the assignment and client activities.
                      </p>
                      <div style="text-align: center; margin: 28px 0;">
                        <a href="${safeCrmUrl}"
                           style="background:#007934;color:white;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
                          Open assignment in CRM
                        </a>
                      </div>
                      <p style="font-size: 12px; color: #777; margin-top: 20px;">
                        Do not reply to this message with client details.
                      </p>
                    </div>
                  </div>
                `;

  return {
    subject: DOULA_ASSIGNMENT_NOTIFICATION_SUBJECT,
    text,
    html,
  };
}

/** True when subject/text/html contain any forbidden clinical/identity field labels. */
export function doulaAssignmentEmailContainsForbiddenLabels(
  content: Pick<DoulaAssignmentEmailContent, 'subject' | 'text' | 'html'>
): string[] {
  const haystack = `${content.subject}\n${content.text}\n${content.html}`;
  return DOULA_ASSIGNMENT_EMAIL_FORBIDDEN_FIELD_LABELS.filter((label) =>
    haystack.includes(label)
  );
}

export function buildAuthenticatedDoulaClientActivitiesUrl(
  frontendBaseUrl: string | undefined,
  clientId: string | undefined
): string {
  const base = (frontendBaseUrl || '').replace(/\/$/, '');
  if (!base || !clientId) {
    return base
      ? `${base}/doula-dashboard/activities`
      : '/doula-dashboard/activities';
  }
  return `${base}/doula-dashboard/activities/${encodeURIComponent(clientId)}`;
}
