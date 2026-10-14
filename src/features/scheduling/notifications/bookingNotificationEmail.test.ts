import {
  BOOKING_EMAIL_FORBIDDEN_LABELS,
  bookingEmailContainsForbiddenLabels,
  buildBookingNotificationEmail,
  formatVisitWhen,
} from './bookingNotificationEmail';

const startAt = new Date('2026-10-13T15:00:00.000Z');
const note = 'Client mentioned gestational diabetes in the visit note.';

describe('booking notification emails', () => {
  it('formats the visit in America/Chicago with a zone label', () => {
    const when = formatVisitWhen(startAt, 'America/Chicago');
    expect(when).toMatch(/2026/);
    expect(when).toMatch(/CDT|CST|CT/);
  });

  it('never includes notes or forbidden clinical labels', () => {
    const kinds = [
      'request_created',
      'approved',
      'rejected',
      'cancelled_client',
      'cancelled_other',
    ] as const;

    for (const kind of kinds) {
      const content = buildBookingNotificationEmail({
        kind,
        audience:
          kind === 'request_created' || kind === 'cancelled_client'
            ? 'doula'
            : 'client',
        startAt,
        frontendBaseUrl: 'https://crm.example.com',
        clientNumber: 'CL-PILOT-001',
      });
      expect(content.text).not.toContain(note);
      expect(content.html).not.toContain(note);
      expect(content.text).toMatch(/log in/i);
      expect(bookingEmailContainsForbiddenLabels(content, [note])).toEqual([]);
      for (const label of BOOKING_EMAIL_FORBIDDEN_LABELS) {
        expect(content.text).not.toContain(label);
        expect(content.html).not.toContain(label);
      }
    }
  });

  it('uses client number only on doula mail', () => {
    const content = buildBookingNotificationEmail({
      kind: 'request_created',
      audience: 'doula',
      startAt,
      frontendBaseUrl: 'https://crm.example.com',
      clientNumber: 'CL-PILOT-001',
    });
    expect(content.text).toContain('CL-PILOT-001');
    expect(content.text).toContain('/doula-dashboard/schedule');
    expect(content.subject).toBe('New visit request');
  });
});
