/**
 * Smoke-test doula document upload/download against real GCS.
 * Bytes-only; does not write doula_documents table rows.
 *
 * Usage:
 *   npx tsx scripts/verify-doula-document-gcs.ts
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { DoulaDocumentUploadService } from '../src/services/doulaDocumentUploadService';
import {
  GCS_DOCUMENTS_BUCKET,
  GCS_PREFIX,
  downloadObject,
  objectPath,
} from '../src/services/gcs/documentStorage';

async function main() {
  const testDoulaId = '00000000-0000-4000-8000-0000000000d1';
  const documentType = 'background_check';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sokana-doula-doc-'));
  const testFilePath = path.join(tmpDir, 'test-background-check.pdf');

  const pdf = Buffer.from(
    '%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
    'utf8'
  );
  fs.writeFileSync(testFilePath, pdf);

  const service = new DoulaDocumentUploadService();
  console.log(
    `Uploading test doc to gs://${GCS_DOCUMENTS_BUCKET}/${GCS_PREFIX.doulaDocuments}/...`
  );

  const uploaded = await service.uploadDocument(
    {
      originalname: 'test-background-check.pdf',
      mimetype: 'application/pdf',
      size: pdf.length,
      buffer: pdf,
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: 'test-background-check.pdf',
      path: testFilePath,
    } as any,
    testDoulaId,
    documentType
  );

  console.log('Uploaded relative filePath:', uploaded.filePath);

  const objectName = objectPath(GCS_PREFIX.doulaDocuments, uploaded.filePath);
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
  console.log('PASS: doula document GCS upload/download/delete');
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
