import {
  INTAKE_EMAIL_FORBIDDEN_FIELD_LABELS,
  INTAKE_STAFF_NOTIFICATION_SUBJECT,
  INTAKE_SUBMITTER_CONFIRMATION_SUBJECT,
  buildAuthenticatedCrmClientUrl,
  buildIntakeStaffNotificationEmail,
  buildIntakeSubmitterConfirmationEmail,
  intakeEmailContainsForbiddenLabels,
} from '../features/intake';

describe('HIPAA-13F intake staff notification email', () => {
  const crmUrl =
    'https://app.example.com/admin/clients/11111111-2222-3333-4444-555555555555';

  it('includes only client number and CRM link', () => {
    const mail = buildIntakeStaffNotificationEmail({
      clientNumber: 'CL-00042',
      crmProfileUrl: crmUrl,
    });

    expect(mail.subject).toBe(INTAKE_STAFF_NOTIFICATION_SUBJECT);
    expect(mail.text).toContain('CL-00042');
    expect(mail.text).toContain(crmUrl);
    expect(mail.html).toContain('CL-00042');
    expect(mail.html).toContain(crmUrl);
    expect(mail.text).toContain(
      'Open the CRM to review the incoming request for service'
    );
    expect(mail.html).toContain(
      'Open the CRM to review the incoming request for service.'
    );
    expect(mail.html).toContain('Open request in CRM');
  });

  it('omits clinical and identity field labels from subject and body', () => {
    const mail = buildIntakeStaffNotificationEmail({
      clientNumber: 'CL-00042',
      crmProfileUrl: crmUrl,
    });

    expect(intakeEmailContainsForbiddenLabels(mail)).toEqual([]);

    const payload = `${mail.subject}\n${mail.text}\n${mail.html}`;
    for (const label of INTAKE_EMAIL_FORBIDDEN_FIELD_LABELS) {
      expect(payload).not.toContain(label);
    }

    // Sample clinical / identity values must never appear
    const forbiddenValues = [
      'Previous C-section',
      'Latex allergy',
      'Gestational diabetes',
      '123 Main St',
      'jane.doe@example.com',
      '555-123-4567',
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
    const url = buildAuthenticatedCrmClientUrl(
      'https://app.example.com/',
      'abc-123'
    );
    expect(url).toBe('https://app.example.com/admin/clients/abc-123');
    expect(url).not.toMatch(/[?&]/);
  });

  it('falls back when client number is missing', () => {
    const mail = buildIntakeStaffNotificationEmail({
      clientNumber: undefined,
      crmProfileUrl: crmUrl,
    });
    expect(mail.text).toContain('Unavailable');
    expect(intakeEmailContainsForbiddenLabels(mail)).toEqual([]);
  });
});

describe('HIPAA-13F intake submitter confirmation email', () => {
  it('has no name or clinical content in subject/body', () => {
    const mail = buildIntakeSubmitterConfirmationEmail();
    expect(mail.subject).toBe(INTAKE_SUBMITTER_CONFIRMATION_SUBJECT);
    expect(mail.text).toMatch(/Thank you for submitting/i);
    expect(mail.text).not.toMatch(/Dear /);
    expect(intakeEmailContainsForbiddenLabels(mail)).toEqual([]);
  });
});
