import { File as MulterFile } from 'multer';

import { CLIENT_DOCUMENT_BUCKET_MIME_TYPES } from '../constants/clientDocuments';
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
    const mimeList = CLIENT_DOCUMENT_BUCKET_MIME_TYPES as readonly string[];
    if (!mimeList.includes(file.mimetype)) {
      throw new Error(
        `Unsupported client document mime type: ${file.mimetype}`
      );
    }

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
        file.mimetype,
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
      mimeType: file.mimetype,
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
