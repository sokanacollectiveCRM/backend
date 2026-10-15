/**
 * HIPAA-13F / INV-01 — Approved minimal staff intake notification.
 *
 * Staff Gmail must NOT receive clinical or identity intake payloads.
 * Notify with client_number + authenticated CRM link only.
 */

export const INTAKE_STAFF_NOTIFICATION_SUBJECT = 'New lead submitted';

export const INTAKE_SUBMITTER_CONFIRMATION_SUBJECT =
  'We Received Your Request for Services';

/** Clinical / identity markers that must never appear in staff notification content. */
export const INTAKE_EMAIL_FORBIDDEN_FIELD_LABELS = [
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

export interface IntakeStaffNotificationInput {
  clientNumber: string | null | undefined;
  crmProfileUrl: string;
}

export interface IntakeEmailContent {
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
 * Builds the approved staff notification (no PHI in subject/body/URL query).
 * CRM URL must be an authenticated staff deep-link that opens the lead profile
 * modal: `/admin/clients/{opaqueClientId}` (see frontend Clients deep-link).
 */
export function buildIntakeStaffNotificationEmail(
  input: IntakeStaffNotificationInput
): IntakeEmailContent {
  const clientRef =
    typeof input.clientNumber === 'string' && input.clientNumber.trim()
      ? input.clientNumber.trim()
      : 'Unavailable — open CRM leads list';
  const crmUrl = input.crmProfileUrl.trim();
  const safeClientRef = escapeHtml(clientRef);
  const safeCrmUrl = escapeHtml(crmUrl);

  const text = `A new lead was submitted via the public request form.

Client number: ${clientRef}

Open the CRM to review the incoming request for service:
${crmUrl}

Do not reply to this message with client details.`;

  const html = `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
                    <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                      <h1 style="color: #007934; text-align: center; margin-bottom: 24px; border-bottom: 3px solid #007934; padding-bottom: 10px;">New Lead Submitted</h1>
                      <p style="font-size: 16px; color: #333; line-height: 1.6;">
                        A new lead was submitted via the public request form.
                      </p>
                      <p style="font-size: 16px; color: #333; line-height: 1.6;">
                        <strong>Client number:</strong> ${safeClientRef}
                      </p>
                      <p style="font-size: 14px; color: #555; line-height: 1.6;">
                        Open the CRM to review the incoming request for service.
                      </p>
                      <div style="text-align: center; margin: 28px 0;">
                        <a href="${safeCrmUrl}"
                           style="background:#007934;color:white;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
                          Open request in CRM
                        </a>
                      </div>
                      <p style="font-size: 12px; color: #777; margin-top: 20px;">
                        Do not reply to this message with client details.
                      </p>
                    </div>
                  </div>
                `;

  return {
    subject: INTAKE_STAFF_NOTIFICATION_SUBJECT,
    text,
    html,
  };
}

/** Confirmation sent only to the submitting family, after persistence. */
export function buildIntakeSubmitterConfirmationEmail(
  firstName = 'there'
): IntakeEmailContent {
  const text = `Hi ${firstName},

Thank you for submitting a request for services with Sokana Collective. We have received your request and our team is working on your match.

Our next step is to identify a doula who may be a good fit for your needs and availability. Once we identify a match, we will connect you to arrange an initial visit with the doula(s).

In the meantime, if you have any questions or need to update the information you submitted, simply reply to this email.

Thank you for considering Sokana Collective. We look forward to connecting with you!

Sokana Collective
Removing Barriers to Access`;
  const html =
    '<div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: auto;">' +
    escapeHtml(text)
      .split('\n\n')
      .map((paragraph) => '<p>' + paragraph.replace(/\n/g, '<br>') + '</p>')
      .join('') +
    '</div>';
  return { subject: INTAKE_SUBMITTER_CONFIRMATION_SUBJECT, text, html };
}

/** True when subject/text/html contain any forbidden clinical/identity field labels. */
export function intakeEmailContainsForbiddenLabels(
  content: Pick<IntakeEmailContent, 'subject' | 'text' | 'html'>
): string[] {
  const haystack = `${content.subject}\n${content.text}\n${content.html}`;
  return INTAKE_EMAIL_FORBIDDEN_FIELD_LABELS.filter((label) =>
    haystack.includes(label)
  );
}

export function buildAuthenticatedCrmClientUrl(
  frontendBaseUrl: string | undefined,
  clientId: string | undefined
): string {
  const base = (frontendBaseUrl || '').replace(/\/$/, '');
  if (!base || !clientId) {
    return base ? `${base}/clients` : '/clients';
  }
  return `${base}/admin/clients/${encodeURIComponent(clientId)}`;
}
