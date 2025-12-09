import { SupabaseClient, createClient } from '@supabase/supabase-js';

export interface DoulaDocument {
  id: string;
  doulaId: string;
  documentType: string;
  fileName: string;
  filePath: string; // Store file path instead of URL for private buckets
  fileSize?: number;
  mimeType?: string;
  uploadedAt: Date;
  expiresAt?: Date;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDoulaDocumentData {
  doulaId: string;
  documentType: string;
  fileName: string;
  filePath: string; // Store file path instead of URL
  fileSize?: number;
  mimeType?: string;
  expiresAt?: Date;
  notes?: string;
}

export class DoulaDocumentRepository {
  private supabaseClient: SupabaseClient;
  private supabaseUrl: string;

  constructor(supabaseClient: SupabaseClient) {
    this.supabaseClient = supabaseClient;
    this.supabaseUrl = process.env.SUPABASE_URL || '';
  }

  /**
   * Create a Supabase client with user's access token for RLS policies
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
   * Create a new doula document
   * @param data - Document data
   * @param accessToken - Optional user access token for RLS policies
   */
  async createDocument(data: CreateDoulaDocumentData, accessToken?: string): Promise<DoulaDocument> {
    // Use user's token if provided (for RLS), otherwise use service role
    const client = accessToken ? this.createUserClient(accessToken) : this.supabaseClient;

    const { data: document, error } = await client
      .from('doula_documents')
      .insert({
        doula_id: data.doulaId,
        document_type: data.documentType,
        file_name: data.fileName,
        file_path: data.filePath, // Store file path instead of URL
        file_size: data.fileSize,
        mime_type: data.mimeType,
        expires_at: data.expiresAt,
        notes: data.notes,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create document: ${error.message}`);
    }

    return this.mapToDocument(document);
  }

  /**
   * Generate a signed URL for a file path
   * @param filePath - Path to the file in storage
   * @param expiresIn - Expiration time in seconds (default: 1 hour)
   * @returns Signed URL that works for private buckets
   */
  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await this.supabaseClient.storage
      .from('doula-documents')
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Get all documents for a specific doula
   */
  async getDocumentsByDoulaId(doulaId: string): Promise<DoulaDocument[]> {
    const { data, error } = await this.supabaseClient
      .from('doula_documents')
      .select('*')
      .eq('doula_id', doulaId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    return data.map(doc => this.mapToDocument(doc));
  }

  /**
   * Get a specific document by ID
   */
  async getDocumentById(documentId: string): Promise<DoulaDocument | null> {
    const { data, error } = await this.supabaseClient
      .from('doula_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Document not found
      }
      throw new Error(`Failed to fetch document: ${error.message}`);
    }

    return this.mapToDocument(data);
  }

  /**
   * Update document status
   */
  async updateDocumentStatus(
    documentId: string,
    status: 'pending' | 'approved' | 'rejected',
    notes?: string
  ): Promise<DoulaDocument> {
    const updateData: any = { status };
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const { data, error } = await this.supabaseClient
      .from('doula_documents')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update document status: ${error.message}`);
    }

    return this.mapToDocument(data);
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('doula_documents')
      .delete()
      .eq('id', documentId);

    if (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  /**
   * Check if a doula owns a document
   */
  async isDocumentOwner(documentId: string, doulaId: string): Promise<boolean> {
    const document = await this.getDocumentById(documentId);
    return document !== null && document.doulaId === doulaId;
  }

  /**
   * Map database row to DoulaDocument object
   */
  private mapToDocument(data: any): DoulaDocument {
    return {
      id: data.id,
      doulaId: data.doula_id,
      documentType: data.document_type,
      fileName: data.file_name,
      filePath: data.file_path || data.file_url, // Support both for migration period
      fileSize: data.file_size,
      mimeType: data.mime_type,
      uploadedAt: new Date(data.uploaded_at),
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      status: data.status,
      notes: data.notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}
