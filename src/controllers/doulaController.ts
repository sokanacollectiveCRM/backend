import { Response } from 'express';
import { AuthRequest } from '../types';
import { DoulaDocumentRepository } from '../repositories/doulaDocumentRepository';
import { SupabaseAssignmentRepository } from '../repositories/supabaseAssignmentRepository';
import { SupabaseUserRepository } from '../repositories/supabaseUserRepository';
import { SupabaseActivityRepository } from '../repositories/supabaseActivityRepository';
import { DoulaDocumentUploadService } from '../services/doulaDocumentUploadService';
import { UserUseCase } from '../usecase/userUseCase';
import { ClientUseCase } from '../usecase/clientUseCase';
import { File as MulterFile } from 'multer';
import supabase from '../supabase';

export class DoulaController {
  private documentRepository: DoulaDocumentRepository;
  private assignmentRepository: SupabaseAssignmentRepository;
  private userRepository: SupabaseUserRepository;
  private activityRepository: SupabaseActivityRepository;
  private uploadService: DoulaDocumentUploadService;
  private userUseCase: UserUseCase;
  private clientUseCase: ClientUseCase;

  constructor(
    documentRepository: DoulaDocumentRepository,
    assignmentRepository: SupabaseAssignmentRepository,
    userRepository: SupabaseUserRepository,
    activityRepository: SupabaseActivityRepository,
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

      // Verify client is assigned to doula
      const assignedClients = await this.assignmentRepository.getAssignedClients(doulaId);
      if (!assignedClients.includes(clientId)) {
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
      const { client_id, start_time, end_time, note } = req.body;

      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!client_id || !start_time || !end_time) {
        res.status(400).json({
          error: 'Missing required fields: client_id, start_time, end_time'
        });
        return;
      }

      // Verify client is assigned to doula
      const assignedClients = await this.assignmentRepository.getAssignedClients(doulaId);
      if (!assignedClients.includes(client_id)) {
        res.status(403).json({
          error: 'You can only log hours for clients assigned to you'
        });
        return;
      }

      // Log hours
      const workEntry = await this.userUseCase.addNewHours(
        doulaId,
        client_id,
        new Date(start_time),
        new Date(end_time),
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

      // Filter to only include hours for assigned clients
      const assignedClients = await this.assignmentRepository.getAssignedClients(doulaId);
      const filteredHours = allHours.filter((entry: any) => {
        // Handle both possible client structures: entry.client?.id or entry.client?.user?.id
        const clientId = entry.client?.id || entry.client?.user?.id;
        return clientId && assignedClients.includes(clientId);
      });

      res.json({
        success: true,
        hours: filteredHours
      });
    } catch (error: any) {
      console.error('Error fetching hours:', error);
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

      // Verify client is assigned to doula
      const assignedClients = await this.assignmentRepository.getAssignedClients(doulaId);
      if (!assignedClients.includes(clientId)) {
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

      // Verify client is assigned to doula
      const assignedClients = await this.assignmentRepository.getAssignedClients(doulaId);
      if (!assignedClients.includes(clientId)) {
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

      const user = await this.userUseCase.getUserById(doulaId);
      if (!user) {
        res.status(404).json({ error: 'Profile not found' });
        return;
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

      console.log(`📝 Doula ${doulaId} (${req.user?.email}) attempting to update profile`);

      // Get current user for comparison
      const currentUser = await this.userUseCase.getUserById(doulaId);
      if (!currentUser) {
        console.error(`❌ Profile not found for doula ${doulaId}`);
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      console.log(`📋 Current profile state - Address: "${currentUser.address}", City: "${currentUser.city}", State: "${currentUser.state}"`);

      // Update user with new data
      const updateData = req.body;

      // Log all received fields, especially address
      console.log(`📥 Received update data:`, JSON.stringify(updateData, null, 2));
      console.log(`🏠 Address field specifically: "${updateData.address}" (type: ${typeof updateData.address})`);

      // Filter out undefined/null values but keep empty strings for explicit clearing
      const fieldsToUpdate = Object.entries(updateData).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      console.log(`📤 Fields to update (filtered):`, JSON.stringify(fieldsToUpdate, null, 2));
      console.log(`🎯 Targeting user ID: ${doulaId} (authenticated doula)`);

      // Use update() instead of save() to properly update all fields
      const updatedUser = await this.userRepository.update(doulaId, fieldsToUpdate);

      console.log(`✅ Profile updated successfully for doula ${doulaId}`);
      console.log(`📋 Updated profile - Address: "${updatedUser.address}", City: "${updatedUser.city}", State: "${updatedUser.state}"`);

      res.json({
        success: true,
        profile: updatedUser.toJSON()
      });
    } catch (error: any) {
      console.error(`❌ Error updating profile for doula ${req.user?.id}:`, error.message);
      console.error('Full error:', error);
      res.status(500).json({
        error: error.message || 'Failed to update profile'
      });
    }
  }
}
