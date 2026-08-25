import {
  DOULA_ASSIGNMENT_EMAIL_FORBIDDEN_FIELD_LABELS,
  DOULA_ASSIGNMENT_NOTIFICATION_SUBJECT,
  buildAuthenticatedDoulaClientActivitiesUrl,
  buildDoulaAssignmentNotificationEmail,
  doulaAssignmentEmailContainsForbiddenLabels,
} from '../features/assignments';

describe('HIPAA-05 doula assignment notification email', () => {
  const crmUrl =
    'https://app.example.com/doula-dashboard/activities/11111111-2222-3333-4444-555555555555';

  it('includes only client number and authenticated CRM link', () => {
    const mail = buildDoulaAssignmentNotificationEmail({
      clientNumber: 'CL-00042',
      crmActivitiesUrl: crmUrl,
    });

    expect(mail.subject).toBe(DOULA_ASSIGNMENT_NOTIFICATION_SUBJECT);
    expect(mail.text).toContain('CL-00042');
    expect(mail.text).toContain(crmUrl);
    expect(mail.html).toContain('CL-00042');
    expect(mail.html).toContain(crmUrl);
    expect(mail.text).toContain(
      'Open the CRM to review the assignment and client activities'
    );
    expect(mail.html).toContain('Open assignment in CRM');
  });

  it('omits assignment notes, client details, and clinical labels', () => {
    const mail = buildDoulaAssignmentNotificationEmail({
      clientNumber: 'CL-00042',
      crmActivitiesUrl: crmUrl,
    });

    expect(doulaAssignmentEmailContainsForbiddenLabels(mail)).toEqual([]);

    const payload = `${mail.subject}\n${mail.text}\n${mail.html}`;
    for (const label of DOULA_ASSIGNMENT_EMAIL_FORBIDDEN_FIELD_LABELS) {
      expect(payload).not.toContain(label);
    }

    const forbiddenValues = [
      'Jane Doe',
      'jane.doe@example.com',
      '555-123-4567',
      '123 Main St',
      'Previous C-section',
      'Latex allergy',
      'Gestational diabetes',
      'Please call before first visit',
      'Baby Doe',
      'MEM-12345',
      'Blue Cross',
      '$45,000',
    ];
    for (const value of forbiddenValues) {
      expect(payload).not.toContain(value);
    }
  });

  it('does not put PHI in the CRM URL query string', () => {
    const url = buildAuthenticatedDoulaClientActivitiesUrl(
      'https://app.example.com/',
      'abc-123'
    );
    expect(url).toBe(
      'https://app.example.com/doula-dashboard/activities/abc-123'
    );
    expect(url).not.toMatch(/[?&]/);
  });

  it('falls back when client number is missing', () => {
    const mail = buildDoulaAssignmentNotificationEmail({
      clientNumber: undefined,
      crmActivitiesUrl: crmUrl,
    });
    expect(mail.text).toContain('Unavailable');
    expect(doulaAssignmentEmailContainsForbiddenLabels(mail)).toEqual([]);
  });

  it('subject is free of client-identifying information', () => {
    const mail = buildDoulaAssignmentNotificationEmail({
      clientNumber: 'CL-00042',
      crmActivitiesUrl: crmUrl,
    });
    expect(mail.subject).not.toContain('CL-');
    expect(mail.subject).not.toMatch(/Jane|Doe|@/);
  });
});
