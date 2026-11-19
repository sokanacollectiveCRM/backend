import { Bucket, Storage } from '@google-cloud/storage';
import fs from 'fs/promises';
import path from 'path';

import { optionalEnv } from '../../config/env';

/** Single private documents bucket; types separated by prefix. */
export const GCS_DOCUMENTS_BUCKET =
  optionalEnv('GCS_DOCUMENTS_BUCKET') ?? 'sokana-private-documents';

export const GCS_PREFIX = {
  clientDocuments:
    optionalEnv('GCS_CLIENT_DOCUMENTS_PREFIX') ?? 'client-documents',
  doulaDocuments:
    optionalEnv('GCS_DOULA_DOCUMENTS_PREFIX') ?? 'doula-documents',
  contracts: optionalEnv('GCS_CONTRACTS_PREFIX') ?? 'contracts',
  contractTemplates:
    optionalEnv('GCS_CONTRACT_TEMPLATES_PREFIX') ?? 'contract-templates',
  profilePictures:
    optionalEnv('GCS_PROFILE_PICTURES_PREFIX') ?? 'profile-pictures',
} as const;

let storageClient: Storage | null = null;

/** Opt-in local-only object store. Never enabled in production. */
function localStorageRoot(objectName: string): string | null {
  const configured = optionalEnv('GCS_LOCAL_STORAGE_DIR');
  if (
    !configured ||
    process.env.NODE_ENV === 'production' ||
    !objectName.startsWith(`${GCS_PREFIX.doulaDocuments}/`)
  ) return null;
  return path.resolve(configured);
}

function localObjectPath(root: string, objectName: string): string {
  const resolved = path.resolve(root, objectName);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Invalid object path');
  }
  return resolved;
}

function getStorage(): Storage {
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient;
}

export function getDocumentsBucket(): Bucket {
  return getStorage().bucket(GCS_DOCUMENTS_BUCKET);
}

export function objectPath(prefix: string, relativePath: string): string {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  const cleanRelative = relativePath.replace(/^\/+/, '');
  if (cleanRelative.startsWith(`${cleanPrefix}/`)) {
    return cleanRelative;
  }
  return `${cleanPrefix}/${cleanRelative}`;
}

export async function downloadObject(objectName: string): Promise<Buffer> {
  const localRoot = localStorageRoot(objectName);
  if (localRoot) {
    try {
      return await fs.readFile(localObjectPath(localRoot, objectName));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      // Documents uploaded before local storage was enabled remain in GCS.
      // The calling admin/doula route performs authorization before reaching here.
    }
  }
  const [buf] = await getDocumentsBucket().file(objectName).download();
  return buf;
}

export async function uploadObject(
  objectName: string,
  data: Buffer,
  contentType: string,
  upsert = true
): Promise<void> {
  const localRoot = localStorageRoot(objectName);
  if (localRoot) {
    const destination = localObjectPath(localRoot, objectName);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    if (!upsert) {
      try {
        await fs.access(destination);
        throw new Error(`Object already exists: ${objectName}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    await fs.writeFile(destination, data, { flag: upsert ? 'w' : 'wx' });
    return;
  }
  const file = getDocumentsBucket().file(objectName);
  if (!upsert) {
    const [exists] = await file.exists();
    if (exists) {
      throw new Error(`Object already exists: ${objectName}`);
    }
  }
  await file.save(data, {
    contentType,
    resumable: false,
    metadata: { cacheControl: 'private, max-age=0' },
  });
}

export interface UploadedObjectMetadata {
  generation: string | null;
  size: number | null;
}

/**
 * Upload a private object and return the immutable GCS generation used as
 * evidence that later reads reference the exact stored bytes.
 */
export async function uploadObjectWithMetadata(
  objectName: string,
  data: Buffer,
  contentType: string,
  options: { upsert?: boolean; metadata?: Record<string, string> } = {}
): Promise<UploadedObjectMetadata> {
  const localRoot = localStorageRoot(objectName);
  if (localRoot) {
    const destination = localObjectPath(localRoot, objectName);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, data, {
      flag: options.upsert === false ? 'wx' : 'w',
    });
    return { generation: null, size: data.length };
  }
  const file = getDocumentsBucket().file(objectName);
  await file.save(data, {
    contentType,
    resumable: false,
    ...(options.upsert === false
      ? { preconditionOpts: { ifGenerationMatch: 0 } }
      : {}),
    metadata: {
      cacheControl: 'private, max-age=0',
      metadata: options.metadata,
    },
  });
  const [metadata] = await file.getMetadata();
  return {
    generation: metadata.generation ? String(metadata.generation) : null,
    size: metadata.size ? Number(metadata.size) : null,
  };
}

export async function deleteObject(objectName: string): Promise<void> {
  const localRoot = localStorageRoot(objectName);
  if (localRoot) {
    await fs.rm(localObjectPath(localRoot, objectName), { force: true });
    return;
  }
  await getDocumentsBucket().file(objectName).delete({ ignoreNotFound: true });
}

export async function listObjects(
  prefix: string,
  options?: { maxResults?: number }
): Promise<Array<{ name: string; size?: number; updated?: string }>> {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  const [files] = await getDocumentsBucket().getFiles({
    prefix: `${cleanPrefix}/`,
    maxResults: options?.maxResults ?? 200,
    autoPaginate: false,
  });

  return files
    .map((f) => {
      const relative = f.name.startsWith(`${cleanPrefix}/`)
        ? f.name.slice(cleanPrefix.length + 1)
        : f.name;
      return {
        name: relative,
        size: f.metadata?.size ? Number(f.metadata.size) : undefined,
        updated: f.metadata?.updated,
      };
    })
    .filter((f) => f.name && !f.name.endsWith('/') && !f.name.startsWith('.'));
}

export async function getSignedReadUrl(
  objectName: string,
  expiresInSeconds = 15 * 60
): Promise<string> {
  const localRoot = localStorageRoot(objectName);
  if (localRoot) {
    const base = optionalEnv('GCS_LOCAL_BASE_URL') ?? 'http://localhost:8080';
    return `${base.replace(/\/$/, '')}/api/doulas/documents/local/${encodeURIComponent(objectName)}`;
  }
  const [url] = await getDocumentsBucket()
    .file(objectName)
    .getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInSeconds * 1000,
    });
  return url;
}
