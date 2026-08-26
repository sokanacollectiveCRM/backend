import { Bucket, Storage } from '@google-cloud/storage';

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
  const [buf] = await getDocumentsBucket().file(objectName).download();
  return buf;
}

export async function uploadObject(
  objectName: string,
  data: Buffer,
  contentType: string,
  upsert = true
): Promise<void> {
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

export async function deleteObject(objectName: string): Promise<void> {
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
  const [url] = await getDocumentsBucket()
    .file(objectName)
    .getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInSeconds * 1000,
    });
  return url;
}
