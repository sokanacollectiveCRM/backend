/**
 * HIPAA-13F local preview — render + optionally send the approved intake emails.
 *
 * Does NOT submit a public intake / create a lead.
 * Uses synthetic client_number + CRM URL only (no clinical payload).
 *
 * Usage:
 *   npx tsx scripts/preview-intake-notification-email.ts
 *   PREVIEW_TO=you@example.com npx tsx scripts/preview-intake-notification-email.ts
 *   SEND=false npx tsx scripts/preview-intake-notification-email.ts   # HTML files only
 */

import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';

import {
  buildAuthenticatedCrmClientUrl,
  buildIntakeStaffNotificationEmail,
  buildIntakeSubmitterConfirmationEmail,
} from '../src/features/intake';
import { NodemailerService } from '../src/services/emailService';

dotenv.config();

const OUT_DIR = path.join(process.cwd(), 'tmp', 'email-previews');
const SEND = process.env.SEND !== 'false';
const PREVIEW_TO =
  process.env.PREVIEW_TO ||
  process.env.TEST_ADMIN_EMAIL ||
  'jerrybony5@gmail.com';

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const crmUrl = buildAuthenticatedCrmClientUrl(
    process.env.PREVIEW_FRONTEND_URL ||
      process.env.FRONTEND_URL ||
      'https://sokana-front-end-634744984887.us-central1.run.app',
    '00000000-0000-4000-8000-000000000013'
  );

  const staff = buildIntakeStaffNotificationEmail({
    clientNumber: 'CL-PREVIEW',
    crmProfileUrl: crmUrl,
  });
  const confirmation = buildIntakeSubmitterConfirmationEmail();

  const staffPath = path.join(OUT_DIR, 'hipaa-13f-staff-notification.html');
  const confirmPath = path.join(
    OUT_DIR,
    'hipaa-13f-submitter-confirmation.html'
  );

  fs.writeFileSync(staffPath, staff.html, 'utf8');
  fs.writeFileSync(confirmPath, confirmation.html, 'utf8');

  console.log('Wrote HTML previews (no PHI):');
  console.log(`  Staff:        ${staffPath}`);
  console.log(`  Confirmation: ${confirmPath}`);
  console.log(`  Staff subject: ${staff.subject}`);
  console.log(`  CRM link: ${crmUrl}`);

  if (!SEND) {
    console.log('\nSEND=false — skipped SMTP.');
    return;
  }

  if (process.env.USE_TEST_EMAIL === 'true') {
    console.warn(
      '\nUSE_TEST_EMAIL=true — emailService will log instead of sending.'
    );
  }

  const email = new NodemailerService();
  console.log(`\nSending staff preview to ${PREVIEW_TO} …`);
  await email.sendEmail(
    PREVIEW_TO,
    `[PREVIEW] ${staff.subject}`,
    staff.text,
    staff.html
  );
  console.log('Staff preview sent.');

  console.log(`Sending confirmation preview to ${PREVIEW_TO} …`);
  await email.sendEmail(
    PREVIEW_TO,
    `[PREVIEW] ${confirmation.subject}`,
    confirmation.text,
    confirmation.html
  );
  console.log('Confirmation preview sent.');
  console.log('\nCheck your inbox (and spam). Subjects are prefixed with [PREVIEW].');
}

main().catch((err) => {
  console.error('Preview failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
