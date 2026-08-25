/**
 * HIPAA-13F / INV-01 — Approved minimal staff intake notification.
 *
 * Staff Gmail must NOT receive clinical or identity intake payloads.
 * Notify with client_number + authenticated CRM link only.
 */

export const INTAKE_STAFF_NOTIFICATION_SUBJECT = 'New lead submitted';

export const INTAKE_SUBMITTER_CONFIRMATION_SUBJECT =
  "Request Received - We're Working on Your Match";

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

/**
 * Submitter confirmation — no clinical payload; no name/identity in subject or body.
 * Delivery address is the SMTP `to` field only.
 */
export function buildIntakeSubmitterConfirmationEmail(): IntakeEmailContent {
  const text = `Thank you for submitting your request for doula services. We have received your information and are working on finding the perfect match for you.

Best regards,
The Sokana Collective Team`;

  const html = `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
                    <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                      <h1 style="color: #4CAF50; text-align: center; margin-bottom: 30px; border-bottom: 3px solid #4CAF50; padding-bottom: 10px;">Request Received</h1>
                      <p style="font-size: 16px; color: #555; line-height: 1.6; margin-bottom: 20px;">
                        Thank you for submitting your request for doula services. We have received your information and are working on finding the perfect match for you.
                      </p>
                      <div style="text-align: center; margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
                        <p style="margin: 0; font-weight: bold; color: #333;">Best regards,</p>
                        <p style="margin: 5px 0 0 0; color: #4CAF50; font-weight: bold;">The Sokana Collective Team</p>
                      </div>
                    </div>
                  </div>
                `;

  return {
    subject: INTAKE_SUBMITTER_CONFIRMATION_SUBJECT,
    text,
    html,
  };
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
