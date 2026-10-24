import { File as MulterFile } from 'multer';

import {
  documentContentType,
  validateDocumentFile,
} from '../security/documentUpload';
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
 * Metadata is stored in Cloud SQL public.doula_documents.
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

    const validationError = validateDocumentFile(file);
    if (validationError) throw new Error(validationError);
    const mimeType = documentContentType(file.buffer)!;

    const timestamp = Date.now();
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${doulaId}/${documentType}/${timestamp}_${sanitizedFileName}`;

    try {
      await uploadObject(
        this.resolveObjectName(filePath),
        file.buffer,
        mimeType,
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
      mimeType,
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
