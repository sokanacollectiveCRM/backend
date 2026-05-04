import { SupabaseClient } from '@supabase/supabase-js';
import { File as MulterFile } from 'multer';
import { CLIENT_DOCUMENT_BUCKET, CLIENT_DOCUMENT_BUCKET_MIME_TYPES } from '../constants/clientDocuments';
import { getSupabaseAdmin } from '../supabase';

export interface UploadedClientDocument {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Client portal document uploads go through this API only; storage must use the
 * Supabase service role so inserts are not blocked by Storage RLS (unlike
 * end-user JWT / anon clients).
 */
export class ClientDocumentUploadService {
  private readonly bucketName = CLIENT_DOCUMENT_BUCKET;
  /** Avoid hammering updateBucket on every request once sync succeeds. */
  private bucketConfigSynced = false;

  private getAdmin(): SupabaseClient {
    return getSupabaseAdmin();
  }

  async uploadDocument(
    file: MulterFile,
    clientId: string,
    documentType: string
  ): Promise<UploadedClientDocument> {
    await this.ensureBucketExists();

    const timestamp = Date.now();
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${clientId}/${documentType}/${timestamp}_${sanitizedFileName}`;

    const { error } = await this.getAdmin().storage.from(this.bucketName).upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

    if (error) {
      throw new Error(`Failed to upload client document: ${error.message}`);
    }

    return {
      filePath,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  /**
   * Bucket creation touches `storage.buckets` and must use the service role.
   * A user-scoped or anon Supabase client will hit RLS ("new row violates row-level security policy").
   */
  private async ensureBucketExists(): Promise<void> {
    const admin = this.getAdmin();
    const mimeList = [...CLIENT_DOCUMENT_BUCKET_MIME_TYPES];

    const { data, error: getError } = await admin.storage.getBucket(this.bucketName);
    if (!getError && data) {
      await this.syncBucketRestrictions(admin, mimeList);
      return;
    }

    const { error: createError } = await admin.storage.createBucket(this.bucketName, {
      public: false,
      fileSizeLimit: '10MB',
      allowedMimeTypes: mimeList,
    });

    if (!createError) {
      this.bucketConfigSynced = true;
      return;
    }

    const msgLower = (createError.message || '').toLowerCase();
    const alreadyExists =
      msgLower.includes('already exists') || msgLower.includes('duplicate') || msgLower.includes('resource already');

    if (!alreadyExists) {
      const msg = createError.message || '';
      const isRls =
        msgLower.includes('row-level security') || msgLower.includes('violates row-level security');
      if (isRls) {
        throw new Error(
          `Failed to ensure client documents bucket exists: storage bucket must be created with the Supabase service role or pre-created in Dashboard → Storage (${this.bucketName}). Underlying error: ${msg}`
        );
      }
      throw new Error(`Failed to ensure client documents bucket exists: ${createError.message}`);
    }

    const { data: existing, error: getAgainError } = await admin.storage.getBucket(this.bucketName);
    if (!getAgainError && existing) {
      await this.syncBucketRestrictions(admin, mimeList);
    }
  }

  /**
   * Existing projects may have been created with a narrow MIME list (e.g. no `image/jpg`),
   * which causes uploads to fail even when the API validates the file. Patch bucket rules idempotently.
   */
  private async syncBucketRestrictions(admin: SupabaseClient, mimeList: string[]): Promise<void> {
    if (this.bucketConfigSynced) {
      return;
    }
    const { error } = await admin.storage.updateBucket(this.bucketName, {
      public: false,
      fileSizeLimit: '10MB',
      allowedMimeTypes: mimeList,
    });
    if (!error) {
      this.bucketConfigSynced = true;
    }
  }

  async deleteDocument(filePath: string): Promise<void> {
    const { error } = await this.getAdmin().storage.from(this.bucketName).remove([filePath]);

    if (error) {
      throw new Error(`Failed to delete client document: ${error.message}`);
    }
  }
}
