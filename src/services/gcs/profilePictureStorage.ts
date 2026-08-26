import { File as MulterFile } from 'multer';

import {
  GCS_PREFIX,
  deleteObject,
  getSignedReadUrl,
  objectPath,
  uploadObject,
} from './documentStorage';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/** Relative DB path → GCS object under `profile-pictures/`. */
export function profilePictureObjectPath(relativePath: string): string {
  return objectPath(GCS_PREFIX.profilePictures, relativePath);
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/**
 * Resolve a stored profile_picture value to something usable in <img src>.
 * - Legacy Supabase/public http(s) URLs pass through
 * - Relative GCS paths become short-lived signed URLs
 */
export async function resolveProfilePictureUrl(
  stored: string | null | undefined,
  expiresInSeconds = 60 * 60
): Promise<string | null> {
  if (stored == null) return null;
  const value = String(stored).trim();
  if (!value) return null;
  if (isHttpUrl(value)) return value;

  try {
    return await getSignedReadUrl(
      profilePictureObjectPath(value),
      expiresInSeconds
    );
  } catch (err) {
    console.warn(
      'Failed to sign profile picture URL:',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export async function resolveProfilePictureFields<
  T extends { profile_picture?: string | null },
>(items: T[], expiresInSeconds = 60 * 60): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      profile_picture: await resolveProfilePictureUrl(
        item.profile_picture,
        expiresInSeconds
      ),
    }))
  );
}

export async function uploadProfilePictureObject(
  userId: string,
  file: MulterFile
): Promise<{ relativePath: string }> {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new Error(`Unsupported profile picture mime type: ${file.mimetype}`);
  }

  const timestamp = Date.now();
  const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const relativePath = `${userId}/${timestamp}_${sanitized}`;

  await uploadObject(
    profilePictureObjectPath(relativePath),
    file.buffer,
    file.mimetype,
    true
  );

  return { relativePath };
}

export async function deleteProfilePictureObject(
  relativePath: string
): Promise<void> {
  if (!relativePath || isHttpUrl(relativePath)) return;
  await deleteObject(profilePictureObjectPath(relativePath));
}
