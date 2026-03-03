import { Response } from 'express';
import { AuthRequest } from '../types';
import { DoulaDocumentRepository } from '../repositories/doulaDocumentRepository';
import { SupabaseAssignmentRepository } from '../repositories/supabaseAssignmentRepository';
import { SupabaseUserRepository } from '../repositories/supabaseUserRepository';
import { DoulaDocumentUploadService } from '../services/doulaDocumentUploadService';
import { UserUseCase } from '../usecase/userUseCase';
import { ClientUseCase } from '../usecase/clientUseCase';
import { File as MulterFile } from 'multer';
import supabase from '../supabase';
import { NotFoundError } from '../domains/errors';
import { CloudSqlTeamService } from '../services/cloudSqlTeamService';
import { ActivityRepository } from '../repositories/interface/activityRepository';

export class DoulaController {
  private documentRepository: DoulaDocumentRepository;
  private assignmentRepository: SupabaseAssignmentRepository;
  private userRepository: SupabaseUserRepository;
  private activityRepository: ActivityRepository;
  private uploadService: DoulaDocumentUploadService;
  private userUseCase: UserUseCase;
  private clientUseCase: ClientUseCase;
  private cloudSqlTeamService: CloudSqlTeamService;

  constructor(
    documentRepository: DoulaDocumentRepository,
    assignmentRepository: SupabaseAssignmentRepository,
    userRepository: SupabaseUserRepository,
    activityRepository: ActivityRepository,
    uploadService: DoulaDocumentUploadService,
    userUseCase: UserUseCase,
    clientUseCase: ClientUseCase
  ) {
    this.documentRepository = documentRepository;
    this.assignmentRepository = assignmentRepository;
    this.userRepository = userRepository;
    this.activityRepository = activityRepository;
    this.uploadService = uploadService;
    this.userUseCase = userUseCase;
    this.clientUseCase = clientUseCase;
    this.cloudSqlTeamService = new CloudSqlTeamService();
  }

  private isMissingRelationError(error: any, relationName: string): boolean {
    const message = String(error?.message || '').toLowerCase();
    return message.includes(`relation "${relationName.toLowerCase()}" does not exist`) || message.includes(`public.${relationName.toLowerCase()}`);
  }

  /**
   * Upload a document (background check, license, etc.)
   * POST /api/doulas/documents
   */
  async uploadDocument(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const file = req.file as MulterFile;
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const { document_type, expires_at, notes } = req.body;
      if (!document_type) {
        res.status(400).json({ error: 'document_type is required' });
        return;
      }

      // Validate document type
      const validTypes = ['background_check', 'license', 'other'];
      if (!validTypes.includes(document_type)) {
        res.status(400).json({
          error: `Invalid document_type. Must be one of: ${validTypes.join(', ')}`
        });
        return;
      }

      // Get user's access token from request
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.split(' ')[1];

      // Get auth user ID from token (this is what auth.uid() returns in storage policies)
      // We need to use the auth user ID, not the users table ID, for the file path
      let authUserId = doulaId; // Fallback to doulaId if we can't get auth ID
      if (accessToken) {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser(accessToken);
          if (authUser?.id) {
            authUserId = authUser.id;
          }
        } catch (error) {
          console.warn('Could not get auth user ID from token, using doulaId:', error);
        }
      }

      // Upload file to Supabase Storage
      // Use authUserId for the file path to match auth.uid() in storage policies
      const uploadedDoc = await this.uploadService.uploadDocument(
        file,
        authUserId,
        document_type,
        accessToken
      );

      // Save document record to database
      // Pass accessToken so RLS policies can verify ownership
      const document = await this.documentRepository.createDocument({
        doulaId,
        documentType: document_type,
        fileName: uploadedDoc.fileName,
        filePath: uploadedDoc.filePath, // Store file path instead of URL
        fileSize: uploadedDoc.fileSize,
        mimeType: uploadedDoc.mimeType,
        expiresAt: expires_at ? new Date(expires_at) : undefined,
        notes: notes || undefined
      }, accessToken);

      // Generate signed URL for the response (valid for 1 hour)
      const signedUrl = await this.documentRepository.getSignedUrl(document.filePath, 3600);

      res.status(201).json({
        success: true,
        document: {
          id: document.id,
          documentType: document.documentType,
          fileName: document.fileName,
          fileUrl: signedUrl, // Return signed URL for frontend
          fileSize: document.fileSize,
          uploadedAt: document.uploadedAt,
          expiresAt: document.expiresAt,
          status: document.status
        }
      });
    } catch (error: any) {
      console.error('Error uploading document:', error);
      res.status(500).json({
        error: error.message || 'Failed to upload document'
      });
    }
  }

  /**
   * Get all documents for the authenticated doula
   * GET /api/doulas/documents
   */
  async getMyDocuments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const documents = await this.documentRepository.getDocumentsByDoulaId(doulaId);

      // Generate signed URLs for each document (valid for 1 hour)
      const documentsWithUrls = await Promise.all(
        documents.map(async (doc) => {
          try {
            const signedUrl = await this.documentRepository.getSignedUrl(doc.filePath, 3600);
            return {
              id: doc.id,
              documentType: doc.documentType,
              fileName: doc.fileName,
              fileUrl: signedUrl, // Return signed URL for frontend
              fileSize: doc.fileSize,
              mimeType: doc.mimeType,
              uploadedAt: doc.uploadedAt,
              expiresAt: doc.expiresAt,
              status: doc.status,
              notes: doc.notes
            };
          } catch (error: any) {
            console.error(`Error generating signed URL for document ${doc.id}:`, error);
            // Return document without URL if signing fails
            return {
              id: doc.id,
              documentType: doc.documentType,
              fileName: doc.fileName,
              fileUrl: null, // Indicate URL generation failed
              fileSize: doc.fileSize,
              mimeType: doc.mimeType,
              uploadedAt: doc.uploadedAt,
              expiresAt: doc.expiresAt,
              status: doc.status,
              notes: doc.notes,
              error: 'Failed to generate access URL'
            };
          }
        })
      );

      res.json({
        success: true,
        documents: documentsWithUrls
      });
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      const message = String(error?.message || '');
      const lowered = message.toLowerCase();
      const isMissingDocumentsTable =
        message.includes("Could not find the table 'public.doula_documents'") ||
        (lowered.includes('public.doula_documents') && lowered.includes('schema')) ||
        (lowered.includes('doula_documents') &&
          (lowered.includes('does not exist') ||
            lowered.includes('schema cache') ||
            lowered.includes('could not find the table')));
      if (isMissingDocumentsTable) {
        res.json({
          success: true,
          documents: [],
          degraded: true,
          source: 'supabase',
          reason: 'doula_documents_table_missing',
        });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to fetch documents'
      });
    }
  }

  /**
   * Delete a document
   * DELETE /api/doulas/documents/:documentId
   */
  async deleteDocument(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      const { documentId } = req.params;

      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!documentId) {
        res.status(400).json({ error: 'Missing document ID' });
        return;
      }

      // Verify doula owns the document
      const isOwner = await this.documentRepository.isDocumentOwner(documentId, doulaId);
      if (!isOwner) {
        res.status(403).json({ error: 'You do not have permission to delete this document' });
        return;
      }

      // Get document to get file path for deletion
      const document = await this.documentRepository.getDocumentById(documentId);
      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      // Delete from storage using file path
      await this.uploadService.deleteDocument(document.filePath);

      // Delete from database
      await this.documentRepository.deleteDocument(documentId);

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting document:', error);
      res.status(500).json({
        error: error.message || 'Failed to delete document'
      });
    }
  }

  /**
   * Get all assigned clients for the authenticated doula
   * GET /api/doulas/clients
   */
  async getMyClients(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Use ClientUseCase which properly handles the client repository with user joins
      const clients = await this.clientUseCase.getClientsLite(doulaId, 'doula');

      res.json({
        success: true,
        clients: clients.map(client => client.toJson())
      });
    } catch (error: any) {
      console.error('Error fetching assigned clients:', error);
      if (this.isMissingRelationError(error, 'assignments')) {
        res.json({
          success: true,
          clients: [],
          degraded: true,
          source: 'cloud_sql',
          reason: 'assignments_table_missing'
        });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to fetch clients'
      });
    }
  }

  /**
   * Get client details (only if assigned to doula)
   * GET /api/doulas/clients/:clientId
   */
  async getClientDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      const { clientId } = req.params;

      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!clientId) {
        res.status(400).json({ error: 'Missing client ID' });
        return;
      }

      // Verify client is assigned to doula using Cloud SQL-backed client list.
      const assignedClients = await this.clientUseCase.getClientsLite(doulaId, 'doula');
      const hasAssignment = assignedClients.some((client) => client.id === clientId);
      if (!hasAssignment) {
        res.status(403).json({
          error: 'You do not have access to this client'
        });
        return;
      }

      // Get client details
      const client = await this.clientUseCase.getClientDetailed(clientId);
      if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      res.json({
        success: true,
        client: client.toJson()
      });
    } catch (error: any) {
      console.error('Error fetching client details:', error);
      res.status(500).json({
        error: error.message || 'Failed to fetch client details'
      });
    }
  }

  /**
   * Log hours for an assigned client
   * POST /api/doulas/hours
   */
  async logHours(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      const clientId = req.body?.client_id ?? req.body?.clientId;
      const startTime = req.body?.start_time ?? req.body?.startTime;
      const endTime = req.body?.end_time ?? req.body?.endTime;
      const note = req.body?.note ?? req.body?.notes ?? req.body?.description;

      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!clientId || !startTime || !endTime) {
        res.status(400).json({
          error: 'Missing required fields: client_id/clientId, start_time/startTime, end_time/endTime'
        });
        return;
      }

      // Verify client is assigned to doula using Cloud SQL-backed assignment join.
      const assignedClients = await this.clientUseCase.getClientsLite(doulaId, 'doula');
      const hasAssignment = assignedClients.some((client) => client.id === clientId);
      if (!hasAssignment) {
        res.status(403).json({
          error: 'You can only log hours for clients assigned to you'
        });
        return;
      }

      // Log hours
      const workEntry = await this.userUseCase.addNewHours(
        doulaId,
        clientId,
        new Date(startTime),
        new Date(endTime),
        note || ''
      );

      res.status(201).json({
        success: true,
        workEntry
      });
    } catch (error: any) {
      console.error('Error logging hours:', error);
      res.status(500).json({
        error: error.message || 'Failed to log hours'
      });
    }
  }

  /**
   * Get hours logs for the authenticated doula (only for assigned clients)
   * GET /api/doulas/hours
   */
  async getMyHours(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get all hours for this doula
      const allHours = await this.userUseCase.getHoursById(doulaId);

      // Filter to only include hours for clients assigned in Cloud SQL.
      const assignedClients = await this.clientUseCase.getClientsLite(doulaId, 'doula');
      const assignedClientIds = new Set(assignedClients.map((client) => client.id));
      const filteredHours = allHours.filter((entry: any) => {
        // Handle both possible client structures: entry.client?.id or entry.client?.user?.id
        const clientId = entry.client?.id || entry.client?.user?.id;
        return clientId && assignedClientIds.has(clientId);
      });

      // Avoid 304/no-body caching behavior for frequently changing dashboard data.
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      res.json({
        success: true,
        hours: filteredHours
      });
    } catch (error: any) {
      console.error('Error fetching hours:', error);
      if (this.isMissingRelationError(error, 'hours')) {
        res.json({
          success: true,
          hours: [],
          degraded: true,
          source: 'cloud_sql',
          reason: 'hours_table_missing'
        });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to fetch hours'
      });
    }
  }

  /**
   * Add activity/note for an assigned client
   * POST /api/doulas/clients/:clientId/activities
   */
  async addClientActivity(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      const { clientId } = req.params;
      const { type, description, metadata } = req.body;

      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!clientId) {
        res.status(400).json({ error: 'Missing client ID' });
        return;
      }

      if (!type || !description) {
        res.status(400).json({
          error: 'Missing required fields: type, description'
        });
        return;
      }

      // Verify client is assigned to doula using Cloud SQL-backed assignment join.
      const assignedClients = await this.clientUseCase.getClientsLite(doulaId, 'doula');
      const hasAssignment = assignedClients.some((client) => client.id === clientId);
      if (!hasAssignment) {
        res.status(403).json({
          error: 'You can only add activities for clients assigned to you'
        });
        return;
      }

      // Create activity
      const activity = await this.activityRepository.createActivity({
        clientId,
        type,
        description,
        metadata: metadata || {},
        timestamp: new Date(),
        createdBy: doulaId
      });

      res.status(201).json({
        success: true,
        activity: activity.toJson()
      });
    } catch (error: any) {
      console.error('Error adding activity:', error);
      if (this.isMissingRelationError(error, 'client_activities')) {
        res.status(503).json({
          error: 'Activities feature not available - client_activities table pending migration',
          degraded: true,
          source: 'cloud_sql',
          reason: 'client_activities_table_missing',
        });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to add activity'
      });
    }
  }

  /**
   * Get activities for an assigned client
   * GET /api/doulas/clients/:clientId/activities
   */
  async getClientActivities(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      const { clientId } = req.params;

      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!clientId) {
        res.status(400).json({ error: 'Missing client ID' });
        return;
      }

      // Verify client is assigned to doula using Cloud SQL-backed assignment join.
      const assignedClients = await this.clientUseCase.getClientsLite(doulaId, 'doula');
      const hasAssignment = assignedClients.some((client) => client.id === clientId);
      if (!hasAssignment) {
        res.status(403).json({
          error: 'You do not have access to this client'
        });
        return;
      }

      // Get activities
      const activities = await this.activityRepository.getActivitiesByClientId(clientId);

      res.json({
        success: true,
        activities: activities.map(activity => activity.toJson())
      });
    } catch (error: any) {
      console.error('Error fetching activities:', error);
      if (this.isMissingRelationError(error, 'client_activities')) {
        res.json({
          success: true,
          activities: [],
          degraded: true,
          source: 'cloud_sql',
          reason: 'client_activities_table_missing',
        });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to fetch activities'
      });
    }
  }

  /**
   * Get doula's own profile
   * GET /api/doulas/profile
   */
  async getMyProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const cloudSqlMember = await this.cloudSqlTeamService.getTeamMemberById(doulaId);
      if (cloudSqlMember && cloudSqlMember.role === 'doula') {
        const reqUserJson = req.user?.toJSON?.() as any;
        const profile = {
          id: cloudSqlMember.id,
          email: cloudSqlMember.email,
          firstname: cloudSqlMember.firstname,
          lastname: cloudSqlMember.lastname,
          fullName: cloudSqlMember.fullName,
          role: 'doula',
          phone_number: cloudSqlMember.phone_number,
          address: cloudSqlMember.address ?? '',
          city: cloudSqlMember.city ?? '',
          state: cloudSqlMember.state ?? '',
          country: cloudSqlMember.country ?? '',
          zip_code: cloudSqlMember.zip_code ?? '',
          bio: cloudSqlMember.bio ?? '',
          account_status: cloudSqlMember.account_status,
          profile_picture: reqUserJson?.profile_picture ?? null,
          created_at: cloudSqlMember.created_at,
          updatedAt: cloudSqlMember.updated_at,
        };
        res.json({
          success: true,
          profile,
        });
        return;
      }

      let user;
      try {
        user = await this.userUseCase.getUserById(doulaId);
      } catch (error) {
        if (error instanceof NotFoundError && req.user) {
          user = req.user;
        } else {
          throw error;
        }
      }

      res.json({
        success: true,
        profile: user.toJSON()
      });
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      res.status(500).json({
        error: error.message || 'Failed to fetch profile'
      });
    }
  }

  /**
   * Update doula's own profile
   * PUT /api/doulas/profile
   */
  async updateMyProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      // Filter out undefined/null values but keep empty strings for explicit clearing.
      const fieldsToUpdate = Object.entries(req.body || {}).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          (acc as any)[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);

      const cloudSqlUpdateData: {
        firstname?: string;
        lastname?: string;
        fullName?: string;
        email?: string;
        phone?: string | null;
        phone_number?: string | null;
        address?: string | null;
        city?: string | null;
        state?: string | null;
        country?: string | null;
        zip_code?: string | null;
        account_status?: string;
        bio?: string | null;
      } = {};

      if (fieldsToUpdate.firstname !== undefined) cloudSqlUpdateData.firstname = String(fieldsToUpdate.firstname);
      if (fieldsToUpdate.lastname !== undefined) cloudSqlUpdateData.lastname = String(fieldsToUpdate.lastname);
      if (fieldsToUpdate.fullName !== undefined) cloudSqlUpdateData.fullName = String(fieldsToUpdate.fullName);
      if (fieldsToUpdate.email !== undefined) cloudSqlUpdateData.email = String(fieldsToUpdate.email);
      if (fieldsToUpdate.phone !== undefined) cloudSqlUpdateData.phone = fieldsToUpdate.phone;
      if (fieldsToUpdate.phone_number !== undefined) cloudSqlUpdateData.phone_number = fieldsToUpdate.phone_number;
      if (fieldsToUpdate.address !== undefined) cloudSqlUpdateData.address = fieldsToUpdate.address;
      if (fieldsToUpdate.city !== undefined) cloudSqlUpdateData.city = fieldsToUpdate.city;
      if (fieldsToUpdate.state !== undefined) cloudSqlUpdateData.state = fieldsToUpdate.state;
      if (fieldsToUpdate.country !== undefined) cloudSqlUpdateData.country = fieldsToUpdate.country;
      if (fieldsToUpdate.zip_code !== undefined) cloudSqlUpdateData.zip_code = fieldsToUpdate.zip_code;
      if (fieldsToUpdate.account_status !== undefined) cloudSqlUpdateData.account_status = String(fieldsToUpdate.account_status);
      if (fieldsToUpdate.bio !== undefined) cloudSqlUpdateData.bio = fieldsToUpdate.bio;

      const updatedMember = await this.cloudSqlTeamService.updateTeamMember(doulaId, cloudSqlUpdateData);
      if (!updatedMember || updatedMember.role !== 'doula') {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      const reqUserJson = req.user?.toJSON?.() as any;
      const profile = {
        id: updatedMember.id,
        email: updatedMember.email,
        firstname: updatedMember.firstname,
        lastname: updatedMember.lastname,
        fullName: updatedMember.fullName,
        role: 'doula',
        phone_number: updatedMember.phone_number,
        address: updatedMember.address ?? '',
        city: updatedMember.city ?? '',
        state: updatedMember.state ?? '',
        country: updatedMember.country ?? '',
        zip_code: updatedMember.zip_code ?? '',
        bio: updatedMember.bio ?? '',
        account_status: updatedMember.account_status,
        profile_picture: reqUserJson?.profile_picture ?? null,
        created_at: updatedMember.created_at,
        updatedAt: updatedMember.updated_at,
      };

      res.json({
        success: true,
        profile,
      });
    } catch (error: any) {
      console.error(`Error updating profile for doula ${req.user?.id}:`, error?.message || error);
      res.status(500).json({
        error: error.message || 'Failed to update profile'
      });
    }
  }
}
