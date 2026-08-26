/**
 * Smoke-test client document upload/download against real GCS.
 * Does not write Cloud SQL rows (bytes-only verification).
 *
 * Usage:
 *   npx tsx scripts/verify-client-document-gcs.ts
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { ClientDocumentUploadService } from '../src/services/clientDocumentUploadService';
import {
  GCS_DOCUMENTS_BUCKET,
  GCS_PREFIX,
  downloadObject,
  objectPath,
} from '../src/services/gcs/documentStorage';

async function main() {
  const testClientId = '00000000-0000-4000-8000-000000000001';
  const documentType = 'insurance_card';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sokana-client-doc-'));
  const testFilePath = path.join(tmpDir, 'test-insurance-card.pdf');

  // Minimal PDF
  const pdf = Buffer.from(
    '%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
    'utf8'
  );
  fs.writeFileSync(testFilePath, pdf);

  const service = new ClientDocumentUploadService();
  console.log(
    `Uploading test doc to gs://${GCS_DOCUMENTS_BUCKET}/${GCS_PREFIX.clientDocuments}/...`
  );

  const uploaded = await service.uploadDocument(
    {
      originalname: 'test-insurance-card.pdf',
      mimetype: 'application/pdf',
      size: pdf.length,
      buffer: pdf,
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: 'test-insurance-card.pdf',
      path: testFilePath,
    } as any,
    testClientId,
    documentType
  );

  console.log('Uploaded relative filePath:', uploaded.filePath);

  const objectName = objectPath(GCS_PREFIX.clientDocuments, uploaded.filePath);
  const downloaded = await downloadObject(objectName);
  if (!downloaded.equals(pdf)) {
    throw new Error(
      `Downloaded bytes mismatch (got ${downloaded.length}, expected ${pdf.length})`
    );
  }
  console.log('Download OK:', objectName, `(${downloaded.length} bytes)`);

  await service.deleteDocument(uploaded.filePath);
  console.log('Deleted test object from GCS');

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('PASS: client document GCS upload/download/delete');
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
