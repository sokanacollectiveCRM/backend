import { File as MulterFile } from 'multer';

import { ALLOWED_MIME_TYPES } from '../constants/doulaDocuments';
import {
  GCS_PREFIX,
  deleteObject,
  objectPath,
  uploadObject,
} from './gcs/documentStorage';

export interface UploadedDocument {
  /** Relative path stored in DB: `{doulaId}/{documentType}/{timestamp}_{file}` */
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Doula document bytes live in private GCS under `doula-documents/`.
 * Metadata remains in the doula_documents table (Supabase/Cloud SQL path unchanged).
 */
export class DoulaDocumentUploadService {
  private resolveObjectName(filePath: string): string {
    return objectPath(GCS_PREFIX.doulaDocuments, filePath);
  }

  async uploadDocument(
    file: MulterFile,
    doulaId: string,
    documentType: string,
    _accessToken?: string
  ): Promise<UploadedDocument> {
    void _accessToken;

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error(`Unsupported doula document mime type: ${file.mimetype}`);
    }

    const timestamp = Date.now();
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${doulaId}/${documentType}/${timestamp}_${sanitizedFileName}`;

    try {
      await uploadObject(
        this.resolveObjectName(filePath),
        file.buffer,
        file.mimetype,
        false
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Document upload failed: ${message}`);
    }

    return {
      filePath,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  async deleteDocument(filePath: string): Promise<void> {
    try {
      await deleteObject(this.resolveObjectName(filePath));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Document deletion failed: ${message}`);
    }
  }
}
