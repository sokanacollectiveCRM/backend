import { SupabaseClient } from '@supabase/supabase-js';
import { File as MulterFile } from 'multer';
import { CLIENT_DOCUMENT_BUCKET } from '../constants/clientDocuments';

export interface UploadedClientDocument {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export class ClientDocumentUploadService {
  private readonly bucketName = CLIENT_DOCUMENT_BUCKET;

  constructor(private readonly supabaseClient: SupabaseClient) {}

  async uploadDocument(
    file: MulterFile,
    clientId: string,
    documentType: string
  ): Promise<UploadedClientDocument> {
    await this.ensureBucketExists();

    const timestamp = Date.now();
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${clientId}/${documentType}/${timestamp}_${sanitizedFileName}`;

    const { error } = await this.supabaseClient.storage
      .from(this.bucketName)
      .upload(filePath, file.buffer, {
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

  private async ensureBucketExists(): Promise<void> {
    const { data, error } = await this.supabaseClient.storage.getBucket(this.bucketName);
    if (!error && data) {
      return;
    }

    const { error: createError } = await this.supabaseClient.storage.createBucket(this.bucketName, {
      public: false,
      fileSizeLimit: '10MB',
      allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    });

    if (createError && !createError.message.toLowerCase().includes('already exists')) {
      throw new Error(`Failed to ensure client documents bucket exists: ${createError.message}`);
    }
  }

  async deleteDocument(filePath: string): Promise<void> {
    const { error } = await this.supabaseClient.storage
      .from(this.bucketName)
      .remove([filePath]);

    if (error) {
      throw new Error(`Failed to delete client document: ${error.message}`);
    }
  }
}
