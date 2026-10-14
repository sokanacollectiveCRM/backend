import { DISPLAY_TIME_ZONE } from '../domain/types';

export const BOOKING_EMAIL_FORBIDDEN_LABELS = [
  'Assignment Notes',
  'Notes:',
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

export type BookingEmailKind =
  | 'request_created'
  | 'approved'
  | 'rejected'
  | 'cancelled_client'
  | 'cancelled_other';

export interface BookingEmailContent {
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

export function formatVisitWhen(
  startAt: Date,
  timeZone: string = DISPLAY_TIME_ZONE
): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  return formatter.format(startAt);
}

export function buildSchedulingLoginUrl(
  frontendBaseUrl: string,
  audience: 'doula' | 'client' | 'admin'
): string {
  const base = (frontendBaseUrl || '').replace(/\/+$/, '');
  if (audience === 'doula') {
    return base
      ? `${base}/doula-dashboard/schedule`
      : '/doula-dashboard/schedule';
  }
  if (audience === 'admin') {
    return base ? `${base}/scheduling` : '/scheduling';
  }
  return base ? `${base}/client-dashboard` : '/client-dashboard';
}

function wrapHtml(
  title: string,
  body: string,
  url: string,
  cta: string
): string {
  const safeTitle = escapeHtml(title);
  const safeUrl = escapeHtml(url);
  const safeCta = escapeHtml(cta);
  return `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
                    <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                      <h1 style="color: #007934; text-align: center; margin-bottom: 24px; border-bottom: 3px solid #007934; padding-bottom: 10px;">${safeTitle}</h1>
                      ${body}
                      <p style="font-size: 14px; color: #555; line-height: 1.6;">
                        Log in to view the visit in Sokana360.
                      </p>
                      <div style="text-align: center; margin: 28px 0;">
                        <a href="${safeUrl}"
                           style="background:#007934;color:white;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
                          ${safeCta}
                        </a>
                      </div>
                      <p style="font-size: 12px; color: #777; margin-top: 20px;">
                        Do not reply to this message with client details.
                      </p>
                    </div>
                  </div>
                `;
}

export function buildBookingNotificationEmail(input: {
  kind: BookingEmailKind;
  audience: 'doula' | 'client';
  startAt: Date;
  frontendBaseUrl: string;
  clientNumber?: string | null;
}): BookingEmailContent {
  const when = formatVisitWhen(input.startAt);
  const url = buildSchedulingLoginUrl(input.frontendBaseUrl, input.audience);
  const clientRef =
    typeof input.clientNumber === 'string' && input.clientNumber.trim()
      ? input.clientNumber.trim()
      : 'Unavailable — open the CRM to view';

  if (input.kind === 'request_created' && input.audience === 'doula') {
    const subject = 'New visit request';
    const text = `You have a new visit request.

When: ${when}
Client number: ${clientRef}

Log in to review and approve or decline:
${url}

Do not reply to this message with client details.`;
    const html = wrapHtml(
      'New Visit Request',
      `<p style="font-size: 16px; color: #333; line-height: 1.6;">You have a new visit request.</p>
       <p style="font-size: 16px; color: #333; line-height: 1.6;"><strong>When:</strong> ${escapeHtml(when)}</p>
       <p style="font-size: 16px; color: #333; line-height: 1.6;"><strong>Client number:</strong> ${escapeHtml(clientRef)}</p>`,
      url,
      'Open schedule in CRM'
    );
    return { subject, text, html };
  }

  if (input.kind === 'approved' && input.audience === 'client') {
    const subject = 'Visit request approved';
    const text = `Your visit request was approved.

When: ${when}

Log in to view the visit:
${url}

Do not reply to this message with health details.`;
    const html = wrapHtml(
      'Visit Approved',
      `<p style="font-size: 16px; color: #333; line-height: 1.6;">Your visit request was approved.</p>
       <p style="font-size: 16px; color: #333; line-height: 1.6;"><strong>When:</strong> ${escapeHtml(when)}</p>`,
      url,
      'View visit'
    );
    return { subject, text, html };
  }

  if (input.kind === 'rejected' && input.audience === 'client') {
    const subject = 'Visit request declined';
    const text = `Your visit request was declined.

When: ${when}

Log in to view details or request another time:
${url}

Do not reply to this message with health details.`;
    const html = wrapHtml(
      'Visit Declined',
      `<p style="font-size: 16px; color: #333; line-height: 1.6;">Your visit request was declined.</p>
       <p style="font-size: 16px; color: #333; line-height: 1.6;"><strong>When:</strong> ${escapeHtml(when)}</p>`,
      url,
      'View visits'
    );
    return { subject, text, html };
  }

  if (input.kind === 'cancelled_client' && input.audience === 'doula') {
    const subject = 'Visit cancelled';
    const text = `A client cancelled a visit.

When: ${when}
Client number: ${clientRef}

Log in to view your schedule:
${url}

Do not reply to this message with client details.`;
    const html = wrapHtml(
      'Visit Cancelled',
      `<p style="font-size: 16px; color: #333; line-height: 1.6;">A client cancelled a visit.</p>
       <p style="font-size: 16px; color: #333; line-height: 1.6;"><strong>When:</strong> ${escapeHtml(when)}</p>
       <p style="font-size: 16px; color: #333; line-height: 1.6;"><strong>Client number:</strong> ${escapeHtml(clientRef)}</p>`,
      url,
      'Open schedule in CRM'
    );
    return { subject, text, html };
  }

  const subject = 'Visit cancelled';
  const text = `A visit was cancelled.

When: ${when}

Log in to view your visits:
${url}

Do not reply to this message with health details.`;
  const html = wrapHtml(
    'Visit Cancelled',
    `<p style="font-size: 16px; color: #333; line-height: 1.6;">A visit was cancelled.</p>
     <p style="font-size: 16px; color: #333; line-height: 1.6;"><strong>When:</strong> ${escapeHtml(when)}</p>`,
    url,
    'View visits'
  );
  return { subject, text, html };
}

export function bookingEmailContainsForbiddenLabels(
  content: Pick<BookingEmailContent, 'subject' | 'text' | 'html'>,
  extraNeedles: string[] = []
): string[] {
  const haystack = `${content.subject}\n${content.text}\n${content.html}`;
  const hits: string[] = BOOKING_EMAIL_FORBIDDEN_LABELS.filter((label) =>
    haystack.includes(label)
  );
  for (const needle of extraNeedles) {
    if (needle && haystack.includes(needle)) hits.push(needle);
  }
  return hits;
}
