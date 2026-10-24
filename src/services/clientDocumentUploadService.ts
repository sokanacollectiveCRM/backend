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

export interface UploadedClientDocument {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Client portal document uploads go through this API only.
 * Bytes live in private GCS under `client-documents/`.
 * `filePath` stored in Cloud SQL remains relative:
 * `{clientId}/{documentType}/{timestamp}_{fileName}`.
 */
export class ClientDocumentUploadService {
  private resolveObjectName(filePath: string): string {
    return objectPath(GCS_PREFIX.clientDocuments, filePath);
  }

  async uploadDocument(
    file: MulterFile,
    clientId: string,
    documentType: string
  ): Promise<UploadedClientDocument> {
    const validationError = validateDocumentFile(file);
    if (validationError) throw new Error(validationError);
    const mimeType = documentContentType(file.buffer)!;

    const timestamp = Date.now();
    const sanitizedFileName = file.originalname.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );
    const filePath = `${clientId}/${documentType}/${timestamp}_${sanitizedFileName}`;

    try {
      await uploadObject(
        this.resolveObjectName(filePath),
        file.buffer,
        mimeType,
        false
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to upload client document: ${message}`);
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
      throw new Error(`Failed to delete client document: ${message}`);
    }
  }
}
