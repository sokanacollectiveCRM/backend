import { SupabaseClient } from '@supabase/supabase-js';
import { CLIENT_DOCUMENT_BUCKET } from '../constants/clientDocuments';
import { queryCloudSql } from '../db/cloudSqlPool';

export interface ClientDocument {
  id: string;
  clientId: string;
  documentType: string;
  category?: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt: Date;
  status: 'uploaded';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateClientDocumentData {
  clientId: string;
  documentType: string;
  category?: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
}

export class ClientDocumentRepository {
  constructor(private readonly supabaseClient: SupabaseClient) {}

  async createDocument(data: CreateClientDocumentData): Promise<ClientDocument> {
    const { rows } = await queryCloudSql(
      `
      INSERT INTO public.client_documents (
        client_id,
        document_type,
        category,
        file_name,
        file_path,
        file_size,
        mime_type,
        status
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, 'uploaded')
      RETURNING *
      `,
      [
        data.clientId,
        data.documentType,
        data.category ?? null,
        data.fileName,
        data.filePath,
        data.fileSize ?? null,
        data.mimeType ?? null,
      ]
    );

    if (!rows[0]) {
      throw new Error('Failed to create client document: no row returned');
    }

    return this.mapToDocument(rows[0]);
  }

  async getDocumentsByClientId(clientId: string): Promise<ClientDocument[]> {
    const { rows } = await queryCloudSql(
      `
      SELECT *
      FROM public.client_documents
      WHERE client_id = $1::uuid
      ORDER BY uploaded_at DESC
      `,
      [clientId]
    );

    return rows.map((row) => this.mapToDocument(row));
  }

  async getDocumentById(documentId: string): Promise<ClientDocument | null> {
    const { rows } = await queryCloudSql(
      `
      SELECT *
      FROM public.client_documents
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [documentId]
    );

    return rows[0] ? this.mapToDocument(rows[0]) : null;
  }

  async deleteDocument(documentId: string): Promise<void> {
    await queryCloudSql(
      `
      DELETE FROM public.client_documents
      WHERE id = $1::uuid
      `,
      [documentId]
    );
  }

  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await this.supabaseClient.storage
      .from(CLIENT_DOCUMENT_BUCKET)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      throw new Error(`Failed to generate client document URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  private mapToDocument(data: any): ClientDocument {
    return {
      id: data.id,
      clientId: data.client_id,
      documentType: data.document_type,
      category: data.category ?? undefined,
      fileName: data.file_name,
      filePath: data.file_path,
      fileSize: data.file_size ?? undefined,
      mimeType: data.mime_type ?? undefined,
      uploadedAt: new Date(data.uploaded_at),
      status: 'uploaded',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
