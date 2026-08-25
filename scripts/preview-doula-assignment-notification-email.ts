/**
 * HIPAA-05 local preview — render + optionally send the approved doula assignment email.
 *
 * Does NOT create an assignment / match a client.
 * Uses synthetic client_number + CRM URL only (no PHI payload).
 *
 * Usage:
 *   npx tsx scripts/preview-doula-assignment-notification-email.ts
 *   PREVIEW_TO=you@example.com npx tsx scripts/preview-doula-assignment-notification-email.ts
 *   SEND=false npx tsx scripts/preview-doula-assignment-notification-email.ts
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

import {
  buildAuthenticatedDoulaClientActivitiesUrl,
  buildDoulaAssignmentNotificationEmail,
} from '../src/features/assignments';
import { NodemailerService } from '../src/services/emailService';

dotenv.config();

const OUT_DIR = path.join(process.cwd(), 'tmp', 'email-previews');
const SEND = process.env.SEND !== 'false';
const PREVIEW_TO =
  process.env.PREVIEW_TO ||
  process.env.TEST_ADMIN_EMAIL ||
  'jerrybony5@gmail.com';
const CLIENT_ID =
  process.env.PREVIEW_CLIENT_ID || '00000000-0000-4000-8000-000000000005';
const CLIENT_NUMBER = process.env.PREVIEW_CLIENT_NUMBER || 'CL-00005';

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const crmActivitiesUrl = buildAuthenticatedDoulaClientActivitiesUrl(
    process.env.FRONTEND_URL || 'http://localhost:3001',
    CLIENT_ID
  );
  const mail = buildDoulaAssignmentNotificationEmail({
    clientNumber: CLIENT_NUMBER,
    crmActivitiesUrl,
  });

  const htmlPath = path.join(OUT_DIR, 'hipaa-05-doula-assignment.html');
  const textPath = path.join(OUT_DIR, 'hipaa-05-doula-assignment.txt');
  fs.writeFileSync(htmlPath, mail.html);
  fs.writeFileSync(textPath, mail.text);

  console.log('Subject:', mail.subject);
  console.log('HTML:', htmlPath);
  console.log('Text:', textPath);
  console.log('CRM URL:', crmActivitiesUrl);

  if (SEND) {
    const emailService = new NodemailerService();
    await emailService.sendEmail(
      PREVIEW_TO,
      `[PREVIEW] ${mail.subject}`,
      mail.text,
      mail.html
    );
    console.log('Sent preview to', PREVIEW_TO);
  } else {
    console.log('SEND=false — files only');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
