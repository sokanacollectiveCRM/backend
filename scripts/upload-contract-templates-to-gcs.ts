/**
 * Upload local contract templates from ./templates/ to GCS
 * gs://sokana-private-documents/contract-templates/{filename}
 *
 * Usage:
 *   npx tsx scripts/upload-contract-templates-to-gcs.ts
 *   npx tsx scripts/upload-contract-templates-to-gcs.ts --dry-run
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

import {
  GCS_DOCUMENTS_BUCKET,
  GCS_PREFIX,
  listObjects,
  objectPath,
  uploadObject,
} from '../src/services/gcs/documentStorage';

const DRY_RUN = process.argv.includes('--dry-run');
const TEMPLATES_DIR = path.join(process.cwd(), 'templates');

function mimeFromName(name: string): string {
  const ext = path.extname(name).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.doc':
      return 'application/msword';
    default:
      return 'application/octet-stream';
  }
}

function isTemplateFile(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    !name.startsWith('.') &&
    (lower.endsWith('.docx') ||
      lower.endsWith('.doc') ||
      lower.endsWith('.pdf'))
  );
}

async function main() {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    throw new Error(`Templates directory not found: ${TEMPLATES_DIR}`);
  }

  const localFiles = fs
    .readdirSync(TEMPLATES_DIR)
    .filter((name) => fs.statSync(path.join(TEMPLATES_DIR, name)).isFile())
    .filter(isTemplateFile)
    .sort();

  if (localFiles.length === 0) {
    console.log('No template files found in templates/.');
    return;
  }

  const existing = new Set(
    (await listObjects(GCS_PREFIX.contractTemplates)).map((file) => file.name)
  );

  console.log(
    `Bucket: gs://${GCS_DOCUMENTS_BUCKET}/${GCS_PREFIX.contractTemplates}/`
  );
  console.log(`Mode: ${DRY_RUN ? 'dry-run' : 'upload'}`);
  console.log(`Local templates: ${localFiles.length}`);

  for (const fileName of localFiles) {
    const gcsObject = objectPath(GCS_PREFIX.contractTemplates, fileName);
    const localPath = path.join(TEMPLATES_DIR, fileName);
    const bytes = fs.readFileSync(localPath);
    const action = existing.has(fileName) ? 'replace' : 'create';

    console.log(
      `- ${fileName} (${bytes.length} bytes) -> ${gcsObject} [${action}]`
    );

    if (!DRY_RUN) {
      await uploadObject(gcsObject, bytes, mimeFromName(fileName), true);
    }
  }

  console.log(
    DRY_RUN
      ? 'Dry run complete. Re-run without --dry-run to upload.'
      : 'Upload complete.'
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
