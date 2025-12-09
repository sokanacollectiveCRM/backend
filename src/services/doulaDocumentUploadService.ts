import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { File as MulterFile } from 'multer';

export interface UploadedDocument {
  filePath: string; // Store file path instead of URL for private buckets
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export class DoulaDocumentUploadService {
  private supabaseClient: SupabaseClient;
  private bucketName: string = 'doula-documents';
  private supabaseUrl: string;

  constructor(supabaseClient: SupabaseClient) {
    this.supabaseClient = supabaseClient;
    this.supabaseUrl = process.env.SUPABASE_URL || '';
  }

  /**
   * Create a Supabase client with user's access token for storage operations
   */
  private createUserClient(accessToken: string): SupabaseClient {
    return createClient(this.supabaseUrl, process.env.SUPABASE_ANON_KEY || '', {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  /**
   * Upload a document to Supabase Storage
   * @param file - Multer file object
   * @param doulaId - ID of the doula uploading the document
   * @param documentType - Type of document (background_check, license, other)
   * @param accessToken - User's access token for authenticated storage operations
   * @returns UploadedDocument with file URL and metadata
   */
  async uploadDocument(
    file: MulterFile,
    doulaId: string,
    documentType: string,
    accessToken?: string
  ): Promise<UploadedDocument> {
    try {
      // Generate unique file path: {doula_id}/{document_type}/{timestamp}_{filename}
      const timestamp = Date.now();
      const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${doulaId}/${documentType}/${timestamp}_${sanitizedFileName}`;

      // Use user's token if provided, otherwise use service role (which should bypass RLS)
      const storageClient = accessToken
        ? this.createUserClient(accessToken)
        : this.supabaseClient;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await storageClient.storage
        .from(this.bucketName)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false, // Don't overwrite existing files
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        // If RLS error, try with service role as fallback
        if (uploadError.message.includes('row-level security') && accessToken) {
          console.log('⚠️  RLS error with user token, retrying with service role...');
          const { data: retryData, error: retryError } = await this.supabaseClient.storage
            .from(this.bucketName)
            .upload(filePath, file.buffer, {
              contentType: file.mimetype,
              upsert: false,
            });

          if (retryError) {
            throw new Error(`Failed to upload document: ${retryError.message}`);
          }

          // Return file path instead of URL (bucket is private, URLs will be signed on fetch)
          return {
            filePath: filePath,
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype
          };
        }
        throw new Error(`Failed to upload document: ${uploadError.message}`);
      }

      // Return file path instead of URL (bucket is private, URLs will be signed on fetch)
      return {
        filePath: filePath,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype
      };
    } catch (error: any) {
      console.error('Error uploading doula document:', error);
      throw new Error(`Document upload failed: ${error.message}`);
    }
  }

  /**
   * Delete a document from Supabase Storage
   * @param filePath - Path of the file to delete (e.g., "doula-id/background_check/timestamp_file.pdf")
   */
  async deleteDocument(filePath: string): Promise<void> {
    try {
      const { error } = await this.supabaseClient.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        throw new Error(`Failed to delete document: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Error deleting doula document:', error);
      throw new Error(`Document deletion failed: ${error.message}`);
    }
  }
}
