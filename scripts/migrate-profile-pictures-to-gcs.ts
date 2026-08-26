/**
 * Migrate Supabase Storage `profile-pictures` → GCS
 * `gs://sokana-private-documents/profile-pictures/{userId}/…`
 *
 * - Copies every object under each user folder
 * - Updates Cloud SQL `doulas`/`admins`.profile_picture to relative path when
 *   the row currently points at a Supabase URL (or needs a current image)
 * - Orphan Supabase folders (no Cloud SQL user) are still copied under the
 *   same UUID prefix and reported
 *
 * Usage:
 *   npx tsx scripts/migrate-profile-pictures-to-gcs.ts           # apply
 *   npx tsx scripts/migrate-profile-pictures-to-gcs.ts --dry-run
 */
import 'dotenv/config';
import path from 'path';
import { Client } from 'pg';

import { createClient } from '@supabase/supabase-js';

import {
  GCS_DOCUMENTS_BUCKET,
  GCS_PREFIX,
  objectPath,
  uploadObject,
} from '../src/services/gcs/documentStorage';

const DRY_RUN = process.argv.includes('--dry-run');
const BUCKET = 'profile-pictures';

type StaffRow = {
  id: string;
  email: string | null;
  role: 'admin' | 'doula';
  profile_picture: string | null;
};

function mimeFromName(name: string): string {
  const ext = path.extname(name).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.heic':
      return 'image/heic';
    default:
      return 'application/octet-stream';
  }
}

function relativeFromSupabaseUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx >= 0) return decodeURIComponent(url.slice(idx + marker.length));
  const marker2 = `/object/sign/${BUCKET}/`;
  const idx2 = url.indexOf(marker2);
  if (idx2 >= 0) {
    const rest = url.slice(idx2 + marker2.length);
    return decodeURIComponent(rest.split('?')[0] || '');
  }
  return null;
}

function isImageFile(name: string): boolean {
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name);
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const sb = createClient(supabaseUrl, serviceKey);

  const db = new Client({
    host: process.env.CLOUD_SQL_HOST || '127.0.0.1',
    port: Number(process.env.CLOUD_SQL_PORT || 5433),
    user: process.env.CLOUD_SQL_USER,
    password: process.env.CLOUD_SQL_PASSWORD,
    database: process.env.CLOUD_SQL_DATABASE || 'sokana_private',
    ssl: false,
  });
  await db.connect();

  const { rows: staff } = await db.query<StaffRow>(
    `
    SELECT id::text AS id, email, profile_picture, 'doula'::text AS role
    FROM public.doulas
    UNION ALL
    SELECT id::text, email, profile_picture, 'admin'
    FROM public.admins
    `
  );
  const staffById = new Map(staff.map((s) => [s.id, s]));

  const { data: folders, error: listErr } = await sb.storage
    .from(BUCKET)
    .list('', { limit: 500 });
  if (listErr) throw new Error(`Supabase list failed: ${listErr.message}`);

  const userFolders = (folders || []).filter(
    (f) => f.name && !f.name.startsWith('.') && !f.metadata?.mimetype
  );

  console.log(
    `${DRY_RUN ? '[DRY-RUN] ' : ''}Migrating profile pictures → gs://${GCS_DOCUMENTS_BUCKET}/${GCS_PREFIX.profilePictures}/`
  );
  console.log(`Supabase user folders: ${userFolders.length}`);

  let copied = 0;
  let updatedDb = 0;
  const orphans: string[] = [];

  for (const folder of userFolders) {
    const userId = folder.name;
    const staffRow = staffById.get(userId);
    if (!staffRow) orphans.push(userId);

    const { data: files, error: filesErr } = await sb.storage
      .from(BUCKET)
      .list(userId, { limit: 200 });
    if (filesErr) {
      console.error(`Failed listing ${userId}:`, filesErr.message);
      continue;
    }

    const images = (files || []).filter(
      (f) => f.name && isImageFile(f.name) && !f.name.startsWith('.')
    );
    console.log(
      `\nUser ${userId} (${staffRow ? `${staffRow.role} ${staffRow.email}` : 'ORPHAN'}) — ${images.length} image(s)`
    );

    let preferredRelative: string | null = null;
    if (staffRow?.profile_picture) {
      preferredRelative = relativeFromSupabaseUrl(staffRow.profile_picture);
      if (preferredRelative && !preferredRelative.startsWith(`${userId}/`)) {
        preferredRelative = `${userId}/${preferredRelative}`;
      }
    }

    const sorted = [...images].sort((a, b) =>
      String(b.name).localeCompare(String(a.name))
    );
    const latestRelative = sorted[0]?.name
      ? `${userId}/${sorted[0].name}`
      : null;

    for (const file of images) {
      const objectKey = `${userId}/${file.name}`;
      const gcsObject = objectPath(GCS_PREFIX.profilePictures, objectKey);
      console.log(
        `  copy ${objectKey} → gs://${GCS_DOCUMENTS_BUCKET}/${gcsObject}`
      );

      if (!DRY_RUN) {
        const { data: blob, error: dlErr } = await sb.storage
          .from(BUCKET)
          .download(objectKey);
        if (dlErr || !blob) {
          console.error(`  download failed: ${dlErr?.message || 'null'}`);
          continue;
        }
        const buf = Buffer.from(await blob.arrayBuffer());
        await uploadObject(gcsObject, buf, mimeFromName(file.name), true);
      }
      copied += 1;
    }

    if (staffRow) {
      const preferredExists =
        !!preferredRelative &&
        images.some((f) => `${userId}/${f.name}` === preferredRelative);
      const nextPath = (preferredExists && preferredRelative) || latestRelative;

      if (nextPath) {
        const alreadyRelative =
          !!staffRow.profile_picture &&
          !/^https?:\/\//i.test(staffRow.profile_picture) &&
          staffRow.profile_picture === nextPath;

        if (!alreadyRelative) {
          console.log(
            `  DB update ${staffRow.role}.${staffRow.email}: → ${nextPath}`
          );
          if (!DRY_RUN) {
            const table = staffRow.role === 'admin' ? 'admins' : 'doulas';
            await db.query(
              `UPDATE public.${table} SET profile_picture = $1, updated_at = NOW() WHERE id = $2::uuid`,
              [nextPath, userId]
            );
          }
          updatedDb += 1;
        } else {
          console.log(`  DB already relative: ${nextPath}`);
        }
      }
    }
  }

  await db.end();

  console.log('\n=== Summary ===');
  console.log(`Copied objects: ${copied}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`DB rows updated: ${updatedDb}${DRY_RUN ? ' (dry-run)' : ''}`);
  if (orphans.length) {
    console.log(
      `Orphan Supabase folders (copied by UUID, no Cloud SQL user): ${orphans.join(', ')}`
    );
  }
  console.log(
    DRY_RUN ? 'DRY-RUN complete' : 'PASS: profile picture migration applied'
  );
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
