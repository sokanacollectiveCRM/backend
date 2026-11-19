#!/usr/bin/env npx tsx
/**
 * Copy residual Supabase Storage objects into the private Sokana GCS bucket.
 * Dry-run by default. Existing identical objects are preserved; conflicting
 * objects are never overwritten.
 */
import { createHash } from 'crypto';
import 'dotenv/config';
import WebSocket from 'ws';

import { Storage } from '@google-cloud/storage';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const BUCKETS = [
  'profile-pictures',
  'contract-templates',
  'contracts',
  'doula-documents',
  'client-documents',
] as const;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const supabase = createClient(
  requiredEnv('SUPABASE_URL'),
  requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket },
  }
);
const gcs = new Storage().bucket(
  process.env.GCS_DOCUMENTS_BUCKET || 'sokana-private-documents'
);

async function listObjects(
  bucket: string,
  prefix = ''
): Promise<Array<{ name: string; contentType?: string }>> {
  const objects: Array<{ name: string; contentType?: string }> = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
    if (error) throw new Error(`Failed to list storage bucket ${bucket}`);
    for (const entry of data || []) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.metadata) {
        objects.push({
          name,
          contentType:
            typeof entry.metadata.mimetype === 'string'
              ? entry.metadata.mimetype
              : undefined,
        });
      } else {
        objects.push(...(await listObjects(bucket, name)));
      }
    }
    if ((data || []).length < 100) break;
  }
  return objects;
}

async function downloadSupabaseObject(
  bucket: string,
  name: string
): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(bucket).download(name);
  if (error || !data) throw new Error(`Failed to download ${bucket} object`);
  return Buffer.from(await data.arrayBuffer());
}

async function main(): Promise<void> {
  const counts = {
    sourceObjects: 0,
    identical: 0,
    missing: 0,
    copied: 0,
    conflicts: 0,
    verified: 0,
  };

  for (const bucket of BUCKETS) {
    const objects = await listObjects(bucket);
    for (const object of objects) {
      counts.sourceObjects += 1;
      const source = await downloadSupabaseObject(bucket, object.name);
      const destination = gcs.file(`${bucket}/${object.name}`);
      const [exists] = await destination.exists();
      if (exists) {
        const [current] = await destination.download();
        if (sha256(current) === sha256(source)) counts.identical += 1;
        else counts.conflicts += 1;
        continue;
      }

      counts.missing += 1;
      if (!APPLY) continue;
      await destination.save(source, {
        resumable: false,
        contentType: object.contentType,
        metadata: {
          metadata: {
            migratedFrom: 'supabase-storage',
            migratedAt: new Date().toISOString(),
          },
        },
        preconditionOpts: { ifGenerationMatch: 0 },
      });
      const [copied] = await destination.download();
      if (sha256(copied) !== sha256(source)) {
        throw new Error('GCS post-copy checksum mismatch');
      }
      counts.copied += 1;
      counts.verified += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? 'apply' : 'dry-run',
        source: 'Supabase Storage',
        destination: 'private GCS bucket',
        ...counts,
      },
      null,
      2
    )
  );
  if (counts.conflicts > 0) {
    throw new Error(
      `${counts.conflicts} destination object conflict(s) require review`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
