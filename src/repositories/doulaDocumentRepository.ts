import { SupabaseClient } from '@supabase/supabase-js';

import { queryCloudSql } from '../db/cloudSqlPool';
import {
  GCS_PREFIX,
  getSignedReadUrl,
  objectPath,
} from '../services/gcs/documentStorage';

export interface DoulaDocument {
  id: string;
  doulaId: string;
  documentType: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt: Date;
  expiresAt?: Date;
  status: 'pending' | 'uploaded' | 'approved' | 'rejected';
  notes?: string;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDoulaDocumentData {
  doulaId: string;
  documentType: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  expiresAt?: Date;
  notes?: string;
}

interface DoulaDocumentRow {
  id: string;
  doula_id: string;
  document_type: string;
  file_name: string;
  file_path: string | null;
  file_url?: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: Date | string;
  expires_at: Date | string | null;
  status: string;
  notes: string | null;
  reviewed_at: Date | string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class DoulaDocumentRepository {
  constructor(supabaseClient: SupabaseClient) {
    void supabaseClient;
  }

  async createDocument(data: CreateDoulaDocumentData): Promise<DoulaDocument> {
    const { rows } = await queryCloudSql<DoulaDocumentRow>(
      `
      INSERT INTO public.doula_documents (
        doula_id,
        document_type,
        file_name,
        file_path,
        file_size,
        mime_type,
        expires_at,
        notes,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded')
      RETURNING *
      `,
      [
        data.doulaId,
        data.documentType,
        data.fileName,
        data.filePath,
        data.fileSize ?? null,
        data.mimeType ?? null,
        data.expiresAt ?? null,
        data.notes ?? null,
      ]
    );

    if (!rows[0]) {
      throw new Error('Failed to create document: no row returned');
    }

    return this.mapToDocument(rows[0]);
  }

  async getSignedUrl(
    filePath: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      return await getSignedReadUrl(
        objectPath(GCS_PREFIX.doulaDocuments, filePath),
        expiresIn
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to generate signed URL: ${message}`);
    }
  }

  async getDocumentsByDoulaId(doulaId: string): Promise<DoulaDocument[]> {
    const { rows } = await queryCloudSql<DoulaDocumentRow>(
      `
      SELECT *
      FROM public.doula_documents
      WHERE doula_id = $1
      ORDER BY uploaded_at DESC
      `,
      [doulaId]
    );
    return rows.map((doc) => this.mapToDocument(doc));
  }

  async getDocumentById(documentId: string): Promise<DoulaDocument | null> {
    const { rows } = await queryCloudSql<DoulaDocumentRow>(
      `
      SELECT *
      FROM public.doula_documents
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [documentId]
    );
    return rows[0] ? this.mapToDocument(rows[0]) : null;
  }

  async updateDocumentStatus(
    documentId: string,
    status: 'uploaded' | 'approved' | 'rejected',
    reviewedBy: string,
    rejectionReason?: string
  ): Promise<DoulaDocument> {
    const { rows } = await queryCloudSql<DoulaDocumentRow>(
      `
      UPDATE public.doula_documents
      SET status = $2,
          reviewed_at = NOW(),
          reviewed_by = $3,
          rejection_reason = CASE WHEN $2 = 'approved' THEN NULL ELSE $4 END,
          updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING *
      `,
      [documentId, status, reviewedBy, rejectionReason ?? null]
    );
    if (!rows[0]) {
      throw new Error('Failed to update document status: document not found');
    }
    return this.mapToDocument(rows[0]);
  }

  async getCurrentDocumentsByDoulaId(
    doulaId: string
  ): Promise<DoulaDocument[]> {
    const mapped = await this.getDocumentsByDoulaId(doulaId);
    const byType = new Map<string, DoulaDocument>();
    for (const doc of mapped) {
      if (!byType.has(doc.documentType)) {
        byType.set(doc.documentType, doc);
      }
    }
    return Array.from(byType.values());
  }

  async deleteDocument(documentId: string): Promise<void> {
    await queryCloudSql(
      `
      DELETE FROM public.doula_documents
      WHERE id = $1::uuid
      `,
      [documentId]
    );
  }

  async updateDocumentMetadata(
    documentId: string,
    updates: { fileName?: string; documentType?: string }
  ): Promise<DoulaDocument | null> {
    const { rows } = await queryCloudSql<DoulaDocumentRow>(
      `
      UPDATE public.doula_documents
      SET file_name = COALESCE($2, file_name),
          document_type = COALESCE($3, document_type),
          updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING *
      `,
      [documentId, updates.fileName ?? null, updates.documentType ?? null]
    );
    return rows[0] ? this.mapToDocument(rows[0]) : null;
  }

  async getCurrentDocumentByType(
    doulaId: string,
    documentType: string
  ): Promise<DoulaDocument | null> {
    const current = await this.getCurrentDocumentsByDoulaId(doulaId);
    return current.find((d) => d.documentType === documentType) ?? null;
  }

  async isDocumentOwner(documentId: string, doulaId: string): Promise<boolean> {
    const document = await this.getDocumentById(documentId);
    return document !== null && document.doulaId === doulaId;
  }

  private mapToDocument(data: DoulaDocumentRow): DoulaDocument {
    const status = data.status === 'pending' ? 'uploaded' : data.status;
    return {
      id: data.id,
      doulaId: data.doula_id,
      documentType: data.document_type,
      fileName: data.file_name,
      filePath: data.file_path || data.file_url || '',
      fileSize: data.file_size ?? undefined,
      mimeType: data.mime_type ?? undefined,
      uploadedAt: new Date(data.uploaded_at),
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      status: status as DoulaDocument['status'],
      notes: data.notes ?? undefined,
      reviewedAt: data.reviewed_at ? new Date(data.reviewed_at) : undefined,
      reviewedBy: data.reviewed_by ?? undefined,
      rejectionReason: data.rejection_reason ?? undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
