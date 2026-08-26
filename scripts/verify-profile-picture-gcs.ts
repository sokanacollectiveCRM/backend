/**
 * Smoke-test profile picture upload/download against real GCS.
 *
 * Usage:
 *   npx tsx scripts/verify-profile-picture-gcs.ts
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  GCS_DOCUMENTS_BUCKET,
  GCS_PREFIX,
  downloadObject,
  objectPath,
} from '../src/services/gcs/documentStorage';
import {
  deleteProfilePictureObject,
  resolveProfilePictureUrl,
  uploadProfilePictureObject,
} from '../src/services/gcs/profilePictureStorage';

async function main() {
  const testUserId = '00000000-0000-4000-8000-0000000000p1';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sokana-profile-pic-'));
  const testFilePath = path.join(tmpDir, 'test-headshot.png');

  // Minimal PNG header + IHDR-ish bytes (enough for storage smoke, not a real image decoder)
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  fs.writeFileSync(testFilePath, png);

  console.log(
    `Uploading test profile pic to gs://${GCS_DOCUMENTS_BUCKET}/${GCS_PREFIX.profilePictures}/...`
  );

  const { relativePath } = await uploadProfilePictureObject(testUserId, {
    originalname: 'test-headshot.png',
    mimetype: 'image/png',
    size: png.length,
    buffer: png,
    fieldname: 'profile_picture',
    encoding: '7bit',
    destination: '',
    filename: 'test-headshot.png',
    path: testFilePath,
  } as any);

  console.log('Uploaded relative path:', relativePath);

  const objectName = objectPath(GCS_PREFIX.profilePictures, relativePath);
  const downloaded = await downloadObject(objectName);
  if (!downloaded.equals(png)) {
    throw new Error(
      `Downloaded bytes mismatch (got ${downloaded.length}, expected ${png.length})`
    );
  }
  console.log('Download OK:', objectName, `(${downloaded.length} bytes)`);

  const resolved = await resolveProfilePictureUrl(relativePath);
  if (resolved) {
    console.log('Signed URL OK:', resolved.slice(0, 72) + '...');
  } else {
    console.log(
      'Signed URL skipped/unavailable locally (user ADC); download path verified'
    );
  }

  // Legacy http passthrough
  const legacy = await resolveProfilePictureUrl(
    'https://example.com/legacy-avatar.jpg'
  );
  if (legacy !== 'https://example.com/legacy-avatar.jpg') {
    throw new Error('Legacy http passthrough failed');
  }
  console.log('Legacy URL passthrough OK');

  await deleteProfilePictureObject(relativePath);
  console.log('Deleted test object from GCS');

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('PASS: profile picture GCS upload/download/delete');
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
