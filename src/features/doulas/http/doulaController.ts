import { downloadObject, GCS_PREFIX, objectPath } from '../../../services/gcs/documentStorage';
import { isHttpUrl, profilePictureObjectPath } from '../../../services/gcs/profilePictureStorage';
import { Response } from 'express';
import { File as MulterFile } from 'multer';

import { logger } from '../../../common/utils/logger';
import { sanitizeDoulaRaceEthnicity } from '../../../constants/doulaDemographics';
import {
  ALLOWED_MIME_TYPES,
  ALL_DOULA_DOCUMENT_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
} from '../../../constants/doulaDocuments';
import { NotFoundError } from '../../../domains/errors';
import { contractNotifications } from '../../../config/env';
import {
  MAX_DOULA_DOCUMENT_FILE_NAME_LENGTH,
  renameDoulaDocumentSchema,
} from '../../../dto/request/RenameDoulaDocumentRequestDTO';
import { ActivityDTO } from '../../../dto/response/ActivityDTO';
import { ActivityMapper } from '../../../mappers/ActivityMapper';
import { DoulaDocumentRepository } from '../../../repositories/doulaDocumentRepository';
import { ActivityRepository } from '../../../repositories/interface/activityRepository';
import { CloudSqlTeamService } from '../../../services/cloudSqlTeamService';
import type { TeamMemberDto } from '../../../services/cloudSqlTeamService';
import { DoulaAvailabilityService } from '../../../services/doulaAvailabilityService';
import {
  DoulaDocumentCompletenessService,
  type DocumentCompletenessSummary,
} from '../../../services/doulaDocumentCompletenessService';
import { DoulaDocumentIdResolver } from '../../../services/doulaDocumentIdResolver';
import { DoulaDocumentUploadService } from '../../../services/doulaDocumentUploadService';
import { NodemailerService } from '../../../services/emailService';
import { CloudSqlIdentityUserService } from '../../../services/identityPlatform/cloudSqlIdentityUserService';
import { AuthRequest } from '../../../types';
import { ClientUseCase } from '../../../usecase/clientUseCase';
import { UserUseCase } from '../../../usecase/userUseCase';
import {
  buildHourSummary,
  parseHourFilter,
  parseHourType,
} from '../../../utils/hourTypes';

const DOULA_DOCUMENT_REVIEW_NOTIFICATION_EMAIL = 'hello@sokanacollective.com';

export class DoulaController {
  private documentRepository: DoulaDocumentRepository;
  private activityRepository: ActivityRepository;
  private uploadService: DoulaDocumentUploadService;
  private completenessService: DoulaDocumentCompletenessService;
  private userUseCase: UserUseCase;
  private clientUseCase: ClientUseCase;
  private cloudSqlTeamService: CloudSqlTeamService;
  private documentIdResolver: DoulaDocumentIdResolver;
  private doulaAvailabilityService: DoulaAvailabilityService;

  constructor(
    documentRepository: DoulaDocumentRepository,
    _assignmentRepository: unknown,
    _userRepository: unknown,
    activityRepository: ActivityRepository,
    uploadService: DoulaDocumentUploadService,
    userUseCase: UserUseCase,
    clientUseCase: ClientUseCase
  ) {
    this.documentRepository = documentRepository;
    this.activityRepository = activityRepository;
    this.uploadService = uploadService;
    this.completenessService = new DoulaDocumentCompletenessService(
      documentRepository
    );
    this.userUseCase = userUseCase;
    this.clientUseCase = clientUseCase;
    this.cloudSqlTeamService = new CloudSqlTeamService();
    this.documentIdResolver = new DoulaDocumentIdResolver(
      this.cloudSqlTeamService
    );
    this.doulaAvailabilityService = new DoulaAvailabilityService();
  }

  private async resolveDocumentDoulaId(
    req: AuthRequest
  ): Promise<string | null> {
    const userId = req.user?.id;
    if (!userId) return null;
    return this.documentIdResolver.resolveStorageDoulaId(
      String(userId),
      req.user?.email
    );
  }

  private isDoulaProfileComplete(
    doula: TeamMemberDto | null,
    documents: DocumentCompletenessSummary
  ): boolean {
    if (!doula) return false;
    const requiredText = [
      doula.firstname,
      doula.lastname,
      doula.phone_number,
      doula.address,
      doula.city,
      doula.state,
      doula.country,
      doula.zip_code,
      doula.bio,
      doula.pronouns,
    ];
    const hasRequiredText = requiredText.every(
      (value) => typeof value === 'string' && value.trim().length > 0
    );
    const raceEthnicity = doula.race_ethnicity ?? [];
    const hasRaceEthnicity =
      raceEthnicity.length > 0 &&
      (!raceEthnicity.includes('another_race_ethnicity') ||
        Boolean(doula.race_ethnicity_other?.trim()));
    const hasLanguages =
      (doula.languages_other_than_english ?? []).some((language) =>
        language.trim()
      );
    const hasDocuments = documents.items.every(
      (item) => item.status === 'uploaded' || item.status === 'approved'
    );
    return hasRequiredText && hasRaceEthnicity && hasLanguages && hasDocuments;
  }

  private async notifyDoulaProfileSubmitted(doulaId: string): Promise<void> {
    try {
      const doula = await this.cloudSqlTeamService.getTeamMemberById(doulaId);
      if (!doula?.email) {
        logger.warn(
          { doulaId },
          'Profile is complete, but the doula email was not found'
        );
        return;
      }

      const doulaName = doula.fullName || `${doula.firstname} ${doula.lastname}`.trim();
      const adminUrl = new URL('/login', contractNotifications.frontendUrl);
      adminUrl.searchParams.set('next', '/team');
      const doulaUrl = new URL('/login', contractNotifications.frontendUrl);
      doulaUrl.searchParams.set('next', '/doula-dashboard/profile?step=review');
      const emailService = new NodemailerService();
      const messages = [
        {
          recipient: DOULA_DOCUMENT_REVIEW_NOTIFICATION_EMAIL,
          subject: `Doula profile ready for review: ${doulaName}`,
          text: `${doulaName} (${doula.email}) completed their profile and submitted all required documents. The profile is ready for review.\n\nOpen Team Members in Sokana:\n${adminUrl.toString()}`,
        },
        {
          recipient: doula.email,
          subject: 'Your Sokana profile is ready for review',
          text: `Hello ${doulaName},\n\nYour profile and required documents are complete and have been sent to Sokana for review. We’ll email you when the review is finished.\n\nSign in to review your submission:\n${doulaUrl.toString()}`,
        },
      ];
      const results = await Promise.allSettled(
        messages.map(({ recipient, subject, text }) =>
          emailService.sendEmail(recipient, subject, text)
        )
      );
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error(
            { err: result.reason, doulaId, recipientRole: index === 0 ? 'admin' : 'doula' },
            'Failed to send profile completion notification'
          );
        }
      });
    } catch (error) {
      logger.error(
        { err: error, doulaId },
        'Could not prepare profile completion notifications'
      );
    }
  }

  private async notifyAdminsOfDocumentReplacement(
    req: AuthRequest,
    document: { id: string; documentType: string; fileName: string },
    doulaId: string
  ): Promise<void> {
    const doulaName = [req.user?.firstname, req.user?.lastname]
      .filter((part) => typeof part === 'string' && part.trim())
      .join(' ') || 'A doula';
    const doulaEmail = req.user?.email || 'Unknown email';
    const documentName = document.documentType
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    const reviewUrl = new URL('/team', contractNotifications.frontendUrl).toString();
    const subject = `${documentName} replacement ready for review`;
    const text =
      `${doulaName} (${doulaEmail}) replaced a rejected ${documentName}. ` +
      `The new file is waiting in the review queue.\n\n` +
      `File: ${document.fileName}\n` +
      `Review the submission in Sokana: ${reviewUrl}`;

    const emailService = new NodemailerService();
    try {
      await emailService.sendEmail(
        DOULA_DOCUMENT_REVIEW_NOTIFICATION_EMAIL,
        subject,
        text
      );
    } catch (error) {
      logger.error(
        { err: error, doulaId, documentId: document.id },
        'Document replacement was saved, but the admin notification could not be sent'
      );
    }
  }

  private getFileExtension(fileName: string): string {
    const index = fileName.lastIndexOf('.');
    if (index <= 0 || index === fileName.length - 1) {
      return '';
    }
    return fileName.slice(index).toLowerCase();
  }

  private isMissingRelationError(error: any, relationName: string): boolean {
    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes(
        `relation "${relationName.toLowerCase()}" does not exist`
      ) || message.includes(`public.${relationName.toLowerCase()}`)
    );
  }

  private async enrichCreatorNames(
    dtos: ActivityDTO[]
  ): Promise<ActivityDTO[]> {
    const unresolvedIds = Array.from(
      new Set(
        dtos
          .filter(
            (d) =>
              d.created_by &&
              (!d.created_by_name || d.created_by_name === 'Staff member')
          )
          .map((d) => d.created_by as string)
      )
    );
    if (!unresolvedIds.length) return dtos;

    const identityUsers = new CloudSqlIdentityUserService();
    const resolved = new Map<string, { name: string; role?: string }>();

    await Promise.all(
      unresolvedIds.map(async (id) => {
        try {
          const staff = await identityUsers.findStaffByIdentifier(id);
          if (!staff) return;
          resolved.set(id, { name: staff.name, role: staff.role });
        } catch {
          // leave as Staff member on lookup failures
        }
      })
    );

    return dtos.map((d) => {
      if (!d.created_by) return d;
      const hit = resolved.get(d.created_by);
      if (!hit) return d;
      return {
        ...d,
        created_by_name: hit.name || d.created_by_name || 'Staff member',
        created_by_role: d.created_by_role || hit.role,
      };
    });
  }

  /**
   * Upload a document (background check, license, etc.)
   * POST /api/doulas/documents
   */
  async uploadDocument(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = await this.resolveDocumentDoulaId(req);
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

      const validTypes = ALL_DOULA_DOCUMENT_TYPES;
      if (!validTypes.includes(document_type)) {
        res.status(400).json({
          error: `Invalid document_type. Must be one of: ${validTypes.join(', ')}`,
        });
        return;
      }

      const [doulaBeforeUpload, documentsBeforeUpload] = await Promise.all([
        this.cloudSqlTeamService.getTeamMemberById(doulaId),
        this.completenessService.getCompleteness(doulaId),
      ]);
      const profileWasComplete = this.isDoulaProfileComplete(
        doulaBeforeUpload,
        documentsBeforeUpload
      );

      // Validate file size (backend enforcement - never trust client)
      if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
        res.status(400).json({
          error: `File size exceeds ${MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)}MB limit`,
        });
        return;
      }
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        res.status(400).json({
          error: `Invalid file type. Allowed: PDF, PNG, JPG, JPEG`,
        });
        return;
      }

      // Replace: if doula already has a document of this type, delete old one first
      const existingDoc =
        await this.documentRepository.getCurrentDocumentByType(
          doulaId,
          document_type
        );
      const replacingRejectedDocument = existingDoc?.status === 'rejected';
      if (existingDoc) {
        await this.uploadService.deleteDocument(existingDoc.filePath);
        await this.documentRepository.deleteDocument(existingDoc.id);
      }

      const uploadedDoc = await this.uploadService.uploadDocument(
        file,
        doulaId,
        document_type
      );

      // Save document record with the service-role client. Session auth is Firebase.
      const document = await this.documentRepository.createDocument({
        doulaId,
        documentType: document_type,
        fileName: uploadedDoc.fileName,
        filePath: uploadedDoc.filePath,
        fileSize: uploadedDoc.fileSize,
        mimeType: uploadedDoc.mimeType,
        expiresAt: expires_at ? new Date(expires_at) : undefined,
        notes: notes || undefined,
      });

      const [doulaAfterUpload, documentsAfterUpload] = await Promise.all([
        this.cloudSqlTeamService.getTeamMemberById(doulaId),
        this.completenessService.getCompleteness(doulaId),
      ]);
      const profileIsComplete = this.isDoulaProfileComplete(
        doulaAfterUpload,
        documentsAfterUpload
      );
      const profileJustCompleted = !profileWasComplete && profileIsComplete;

      if (
        profileJustCompleted &&
        doulaBeforeUpload?.profile_review_status !== 'rejected'
      ) {
        await this.cloudSqlTeamService.reviewDoulaProfile(
          doulaId,
          'pending'
        );
        await this.notifyDoulaProfileSubmitted(doulaId);
      }

      if (replacingRejectedDocument && !profileJustCompleted) {
        try {
          await this.notifyAdminsOfDocumentReplacement(req, document, doulaId);
        } catch (emailError) {
          logger.error(
            { err: emailError, doulaId, documentId: document.id },
            'Replacement document was saved, but admin notification failed'
          );
        }
      }

      // Generate signed URL for the response (valid for 1 hour)
      const signedUrl = await this.documentRepository.getSignedUrl(
        document.filePath,
        3600
      );

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
          status: document.status,
        },
      });
    } catch (error: any) {
      console.error('Error uploading document:', error);
      res.status(500).json({
        error: error.message || 'Failed to upload document',
      });
    }
  }

  /**
   * Get all documents and completeness for the authenticated doula
   * GET /api/doulas/documents
   */
  async getMyDocuments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = await this.resolveDocumentDoulaId(req);
      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const documents =
        await this.documentRepository.getDocumentsByDoulaId(doulaId);
      const completeness =
        await this.completenessService.getCompleteness(doulaId);

      // Generate signed URLs for each document (valid for 1 hour)
      const documentsWithUrls = await Promise.all(
        documents.map(async (doc) => {
          try {
            const signedUrl = await this.documentRepository.getSignedUrl(
              doc.filePath,
              3600
            );
            return {
              id: doc.id,
              documentType: doc.documentType,
              document_type: doc.documentType,
              fileName: doc.fileName,
              file_name: doc.fileName,
              fileUrl: signedUrl,
              fileSize: doc.fileSize,
              file_size: doc.fileSize,
              mimeType: doc.mimeType,
              mime_type: doc.mimeType,
              uploadedAt: doc.uploadedAt?.toISOString?.() ?? doc.uploadedAt,
              uploaded_at: doc.uploadedAt?.toISOString?.() ?? doc.uploadedAt,
              expiresAt: doc.expiresAt,
              status: doc.status,
              notes: doc.notes,
              rejectionReason: doc.rejectionReason,
              rejection_reason: doc.rejectionReason,
            };
          } catch (error: any) {
            console.error(
              `Error generating signed URL for document ${doc.id}:`,
              error
            );
            return {
              id: doc.id,
              documentType: doc.documentType,
              document_type: doc.documentType,
              fileName: doc.fileName,
              file_name: doc.fileName,
              fileUrl: null,
              fileSize: doc.fileSize,
              file_size: doc.fileSize,
              mimeType: doc.mimeType,
              uploadedAt: doc.uploadedAt?.toISOString?.(),
              status: doc.status,
              notes: doc.notes,
              rejectionReason: doc.rejectionReason,
            };
          }
        })
      );

      res.json({
        success: true,
        documents: documentsWithUrls,
        completeness: {
          total_required: completeness.totalRequired,
          total_complete: completeness.totalComplete,
          missing_types: completeness.missingTypes,
          has_all_required_documents: completeness.hasAllRequiredDocuments,
          can_be_active: completeness.canBeActive,
          items: completeness.items.map((i) => ({
            document_type: i.documentType,
            status: i.status,
            document_id: i.documentId,
            file_name: i.fileName,
            uploaded_at: i.uploadedAt,
            rejection_reason: i.rejectionReason,
          })),
        },
      });
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      const message = String(error?.message || '');
      const lowered = message.toLowerCase();
      const isMissingDocumentsTable =
        message.includes("Could not find the table 'public.doula_documents'") ||
        (lowered.includes('public.doula_documents') &&
          lowered.includes('schema')) ||
        (lowered.includes('doula_documents') &&
          (lowered.includes('does not exist') ||
            lowered.includes('schema cache') ||
            lowered.includes('could not find the table')));
      if (isMissingDocumentsTable) {
        res.json({
          success: true,
          documents: [],
          degraded: true,
          source: 'cloud_sql',
          reason: 'doula_documents_table_missing',
        });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to fetch documents',
      });
    }
  }

  /** Serve local-only doula files through the authenticated API. */
  async getLocalDocument(req: AuthRequest, res: Response): Promise<void> {
    const doulaId = req.user?.id;
    const objectName = req.params[0];
    const expectedPrefix = `${GCS_PREFIX.doulaDocuments}/${doulaId}/`;
    if (!doulaId || !objectName?.startsWith(expectedPrefix)) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    try {
      const data = await downloadObject(objectName);
      const extension = objectName.split('.').pop()?.toLowerCase();
      const mimeType = extension === 'pdf' ? 'application/pdf'
        : extension === 'png' ? 'image/png'
        : ['jpg', 'jpeg'].includes(extension ?? '') ? 'image/jpeg'
        : 'application/octet-stream';
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.type(mimeType).send(data);
    } catch {
      res.status(404).json({ error: 'Document not found' });
    }
  }

  /**
   * Get documents and completeness for a doula (admin only)
   * GET /api/admin/doulas/:doulaId/documents
   */
  async getDoulaDocumentsAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { doulaId } = req.params;
      if (!doulaId) {
        res.status(400).json({ error: 'Missing doula ID' });
        return;
      }

      let documents =
        await this.documentRepository.getDocumentsByDoulaId(doulaId);
      let effectiveDocDoulaId = doulaId;

      if (documents.length === 0) {
        const resolvedId =
          await this.documentIdResolver.getEffectiveDocumentDoulaId(doulaId);
        if (resolvedId !== doulaId) {
          documents =
            await this.documentRepository.getDocumentsByDoulaId(resolvedId);
          effectiveDocDoulaId = resolvedId;
        }
      }

      const completeness =
        await this.completenessService.getCompleteness(effectiveDocDoulaId);
      const doulaProfile = await this.cloudSqlTeamService.getTeamMemberById(
        doulaId
      );

      const documentsWithUrls = await Promise.all(
        documents.map(async (doc) => {
          try {
            const signedUrl = await this.documentRepository.getSignedUrl(
              doc.filePath,
              3600
            );
            return {
              id: doc.id,
              documentType: doc.documentType,
              document_type: doc.documentType,
              fileName: doc.fileName,
              file_name: doc.fileName,
              fileUrl: signedUrl,
              fileSize: doc.fileSize,
              file_size: doc.fileSize,
              mimeType: doc.mimeType,
              mime_type: doc.mimeType,
              uploadedAt: doc.uploadedAt?.toISOString?.() ?? doc.uploadedAt,
              uploaded_at: doc.uploadedAt?.toISOString?.() ?? doc.uploadedAt,
              status: doc.status,
              notes: doc.notes,
              rejectionReason: doc.rejectionReason,
              rejection_reason: doc.rejectionReason,
              reviewedAt: doc.reviewedAt?.toISOString?.() ?? doc.reviewedAt,
              reviewed_at: doc.reviewedAt?.toISOString?.() ?? doc.reviewedAt,
              reviewedBy: doc.reviewedBy,
              reviewed_by: doc.reviewedBy,
            };
          } catch {
            return {
              id: doc.id,
              documentType: doc.documentType,
              document_type: doc.documentType,
              fileName: doc.fileName,
              file_name: doc.fileName,
              fileUrl: null,
              fileSize: doc.fileSize,
              file_size: doc.fileSize,
              mimeType: doc.mimeType,
              mime_type: doc.mimeType,
              uploadedAt: doc.uploadedAt?.toISOString?.() ?? doc.uploadedAt,
              uploaded_at: doc.uploadedAt?.toISOString?.() ?? doc.uploadedAt,
              status: doc.status,
              notes: doc.notes,
              rejectionReason: doc.rejectionReason,
              rejection_reason: doc.rejectionReason,
              reviewedAt: doc.reviewedAt?.toISOString?.() ?? doc.reviewedAt,
              reviewed_at: doc.reviewedAt?.toISOString?.() ?? doc.reviewedAt,
              reviewedBy: doc.reviewedBy,
              reviewed_by: doc.reviewedBy,
            };
          }
        })
      );

      res.json({
        success: true,
        profileReview: {
          status: doulaProfile?.profile_review_status ?? 'draft',
          rejection_reason: doulaProfile?.profile_rejection_reason ?? null,
        },
        documents: documentsWithUrls,
        completeness: {
          total_required: completeness.totalRequired,
          total_complete: completeness.totalComplete,
          missing_types: completeness.missingTypes,
          has_all_required_documents: completeness.hasAllRequiredDocuments,
          can_be_active: completeness.canBeActive,
          items: completeness.items,
        },
      });
    } catch (error: any) {
      console.error('Error fetching doula documents (admin):', error);
      res
        .status(500)
        .json({ error: error.message || 'Failed to fetch documents' });
    }
  }

  private async notifyProfileAndDocumentsApproved(
    doulaId: string,
    adminId: string,
    adminEmail?: string
  ): Promise<void> {
    try {
      const doula = await this.cloudSqlTeamService.getTeamMemberById(doulaId);
      if (!doula?.email) {
        logger.warn(
          { doulaId },
          'All required doula documents were approved, but no doula email was found'
        );
        return;
      }

      const admin = adminEmail
        ? null
        : await this.cloudSqlTeamService.getTeamMemberById(adminId);
      const resolvedAdminEmail = (adminEmail || admin?.email || '').trim();
      const frontendUrl = contractNotifications.frontendUrl;
      const doulaLoginUrl = new URL('/login', frontendUrl);
      doulaLoginUrl.searchParams.set('next', '/doula-dashboard/profile');
      const adminLoginUrl = new URL('/login', frontendUrl);
      adminLoginUrl.searchParams.set('next', '/team');
      const doulaName = doula.fullName || `${doula.firstname} ${doula.lastname}`.trim();
      const emailService = new NodemailerService();
      const messages = [
        {
          recipient: doula.email,
          role: 'doula',
          subject: 'Your Sokana profile and documents are approved',
          text: `Hello ${doulaName},\n\nYour Sokana profile and all required documents have been approved. Sign in to view your profile:\n${doulaLoginUrl.toString()}`,
        },
        ...(resolvedAdminEmail
          ? [{
              recipient: resolvedAdminEmail,
              role: 'admin',
              subject: `Doula profile and documents approved: ${doulaName}`,
              text: `All required documents for ${doulaName} (${doula.email}) have been approved. The doula profile is approved.\n\nOpen Team Members in Sokana:\n${adminLoginUrl.toString()}`,
            }]
          : []),
      ];
      const results = await Promise.allSettled(
        messages.map((message) =>
          emailService.sendEmail(
            message.recipient,
            message.subject,
            message.text
          )
        )
      );
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error(
            { err: result.reason, doulaId, recipientRole: messages[index].role },
            'Failed to send doula profile approval email'
          );
        }
      });
    } catch (error) {
      logger.error(
        { err: error, doulaId },
        'Could not prepare doula profile approval emails'
      );
    }
  }

  /**
   * Review (approve/reject) a document (admin only)
   * PATCH /api/admin/doulas/:doulaId/documents/:documentId/review
   */
  async reviewDocument(req: AuthRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      const { doulaId, documentId } = req.params;
      const { status, rejection_reason } = req.body;

      if (!adminId || !doulaId || !documentId) {
        res.status(400).json({ error: 'Missing required parameters' });
        return;
      }
      if (!['approved', 'rejected'].includes(status)) {
        res
          .status(400)
          .json({ error: 'status must be "approved" or "rejected"' });
        return;
      }

      const document =
        await this.documentRepository.getDocumentById(documentId);
      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      const isOwned = await this.documentIdResolver.isDocumentOwnedByDoula(
        doulaId,
        document.doulaId
      );
      if (!isOwned) {
        res
          .status(403)
          .json({ error: 'Document does not belong to this doula' });
        return;
      }

      const completenessBefore =
        status === 'approved'
          ? await this.completenessService.getCompleteness(document.doulaId)
          : null;
      const updated = await this.documentRepository.updateDocumentStatus(
        documentId,
        status,
        adminId,
        status === 'rejected' ? rejection_reason : undefined
      );

      if (
        status === 'approved' &&
        completenessBefore &&
        !completenessBefore.canBeActive
      ) {
        const completenessAfter = await this.completenessService.getCompleteness(
          document.doulaId
        );
        const doula = await this.cloudSqlTeamService.getTeamMemberById(
          document.doulaId
        );
        if (completenessAfter.canBeActive && doula?.profile_review_status === 'approved') {
          await this.cloudSqlTeamService.updateTeamMember(
            document.doulaId,
            { account_status: 'active' }
          );
          await this.notifyProfileAndDocumentsApproved(
            document.doulaId,
            adminId,
            req.user?.email
          );
        }
      }

      if (status === 'rejected') {
        try {
          const doula = await this.cloudSqlTeamService.getTeamMemberById(
            document.doulaId
          );
          if (doula?.email) {
            const documentName = String(document.documentType || 'document')
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (letter) => letter.toUpperCase());
            const documentPath = `/doula-dashboard/documents?documentType=${encodeURIComponent(document.documentType)}#required-documents`;
            const loginUrl = new URL(
              '/login',
              contractNotifications.frontendUrl
            );
            loginUrl.searchParams.set('next', documentPath);
            const reason = String(
              updated.rejectionReason || rejection_reason || 'Please review the document and upload an updated version.'
            ).trim();
            await new NodemailerService().sendEmail(
              doula.email,
              `${documentName} needs an update`,
              `Your ${documentName} was not approved.\n\nReason: ${reason}\n\nSign in to Sokana to review the feedback and replace this document:\n${loginUrl.toString()}`
            );
          } else {
            logger.warn(
              { doulaId: document.doulaId, documentId },
              'Could not send document rejection email: doula email not found'
            );
          }
        } catch (emailError) {
          logger.error(
            { err: emailError, doulaId: document.doulaId, documentId },
            'Document was rejected, but the rejection email could not be sent'
          );
        }
      }

      res.json({
        success: true,
        document: {
          id: updated.id,
          documentType: updated.documentType,
          status: updated.status,
          rejectionReason: updated.rejectionReason,
        },
      });
    } catch (error: any) {
      console.error('Error reviewing document:', error);
      res
        .status(500)
        .json({ error: error.message || 'Failed to review document' });
    }
  }

  async reviewProfileInformation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { doulaId } = req.params;
      const adminId = req.user?.id;
      const adminEmail = req.user?.email;
      const { status, rejection_reason } = req.body ?? {};

      if (!doulaId || !adminId) {
        res.status(400).json({ error: 'Missing required parameters' });
        return;
      }
      if (!['approved', 'rejected'].includes(status)) {
        res.status(400).json({ error: 'status must be "approved" or "rejected"' });
        return;
      }
      if (status === 'rejected' && !String(rejection_reason ?? '').trim()) {
        res.status(400).json({ error: 'A rejection reason is required' });
        return;
      }

      const doula = await this.cloudSqlTeamService.reviewDoulaProfile(
        doulaId,
        status,
        adminId,
        status === 'rejected' ? String(rejection_reason).trim() : undefined
      );
      if (!doula) {
        res.status(404).json({ error: 'Doula profile not found' });
        return;
      }

      if (status === 'rejected' && doula.email) {
        const name = doula.fullName || `${doula.firstname} ${doula.lastname}`.trim();
        const loginUrl = new URL('/login', contractNotifications.frontendUrl);
        loginUrl.searchParams.set('next', '/doula-dashboard/profile');
        try {
          await new NodemailerService().sendEmail(
            doula.email,
            'Please update your Sokana profile information',
            `Hello ${name},\n\nSokana needs you to update your profile information before your profile can be approved.\n\nReason from the reviewer:\n${String(rejection_reason).trim()}\n\nSign in to update your profile:\n${loginUrl.toString()}`
          );
        } catch (emailError) {
          logger.error(
            { err: emailError, doulaId },
            'Profile information was rejected, but the doula email could not be sent'
          );
        }
      }

      let accountStatus = doula.account_status;
      if (status === 'approved') {
        const completeness = await this.completenessService.getCompleteness(doulaId);
        if (
          completeness.canBeActive &&
          this.isDoulaProfileComplete(doula, completeness)
        ) {
          const activated = await this.cloudSqlTeamService.updateTeamMember(
            doulaId,
            { account_status: 'active' }
          );
          accountStatus = activated?.account_status ?? accountStatus;
          await this.notifyProfileAndDocumentsApproved(doulaId, adminId, adminEmail);
        }
      }

      res.json({
        success: true,
        profileReview: {
          status,
          rejection_reason: status === 'rejected' ? String(rejection_reason).trim() : null,
          account_status: accountStatus,
        },
      });
    } catch (error: any) {
      logger.error({ err: error, doulaId: req.params.doulaId }, 'Failed to review doula profile information');
      res.status(500).json({ error: error.message || 'Failed to review profile information' });
    }
  }

  /**
   * Stream a doula document through the authorized admin API. This is used
   * for local document storage, where a signed URL points back to the
   * doula-only local file route.
   * GET /api/admin/doulas/:doulaId/documents/:documentId/content
   */
  async downloadAdminDoulaDocument(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { doulaId, documentId } = req.params;
      const document = await this.documentRepository.getDocumentById(documentId);
      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      const isOwned = await this.documentIdResolver.isDocumentOwnedByDoula(
        doulaId,
        document.doulaId
      );
      if (!isOwned) {
        res.status(403).json({ error: 'Document does not belong to this doula' });
        return;
      }

      const objectName = objectPath(
        GCS_PREFIX.doulaDocuments,
        document.filePath
      );
      const contents = await downloadObject(objectName);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
      res.send(contents);
    } catch (error) {
      console.error('Error downloading doula document:', error);
      res.status(500).json({ error: 'Failed to retrieve document' });
    }
  }

  /**
   * Get signed URL for a document (admin only)
   * GET /api/admin/doulas/:doulaId/documents/:documentId/url
   */
  async getDocumentUrl(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { doulaId, documentId } = req.params;

      const document =
        await this.documentRepository.getDocumentById(documentId);
      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      const isOwned = await this.documentIdResolver.isDocumentOwnedByDoula(
        doulaId,
        document.doulaId
      );
      if (!isOwned) {
        res
          .status(403)
          .json({ error: 'Document does not belong to this doula' });
        return;
      }

      const signedUrl = await this.documentRepository.getSignedUrl(
        document.filePath,
        3600
      );

      res.json({
        success: true,
        url: signedUrl,
        expiresIn: 3600,
      });
    } catch (error: any) {
      console.error('Error getting document URL:', error);
      res
        .status(500)
        .json({ error: error.message || 'Failed to get document URL' });
    }
  }

  /**
   * Update doula document metadata (display name and/or document type)
   * PATCH /api/doulas/documents/:documentId
   *
   * Policy: keep existing file extension. Request may omit extension; when omitted, existing extension is appended.
   */
  async renameDocument(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = await this.resolveDocumentDoulaId(req);
      const { documentId } = req.params;

      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!documentId) {
        res.status(400).json({ error: 'Missing document ID' });
        return;
      }

      const parsed = renameDoulaDocumentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Invalid request body',
        });
        return;
      }

      logger.info(
        {
          context: 'DoulaController.renameDocument',
          doulaId,
          documentId,
          requestedFileNameLength: parsed.data.file_name?.length,
          requestedDocumentType: parsed.data.document_type,
          outcome: 'attempt',
        },
        'Doula document rename requested'
      );

      const document =
        await this.documentRepository.getDocumentById(documentId);
      if (!document) {
        logger.warn(
          {
            context: 'DoulaController.renameDocument',
            doulaId,
            documentId,
            outcome: 'not_found',
          },
          'Doula document rename failed: document not found'
        );
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      if (document.doulaId !== doulaId) {
        logger.warn(
          {
            context: 'DoulaController.renameDocument',
            doulaId,
            documentId,
            outcome: 'forbidden',
          },
          'Doula document rename forbidden'
        );
        res.status(403).json({
          error: 'You do not have permission to rename this document',
        });
        return;
      }

      let normalizedFileName: string | undefined;
      if (typeof parsed.data.file_name === 'string') {
        const existingExtension = this.getFileExtension(document.fileName);
        const requestedExtension = this.getFileExtension(parsed.data.file_name);

        if (
          existingExtension &&
          requestedExtension &&
          existingExtension !== requestedExtension
        ) {
          res.status(400).json({
            error: `file_name extension must remain "${existingExtension}"`,
          });
          return;
        }

        normalizedFileName =
          existingExtension && !requestedExtension
            ? `${parsed.data.file_name}${existingExtension}`
            : parsed.data.file_name;
        if (normalizedFileName.length > MAX_DOULA_DOCUMENT_FILE_NAME_LENGTH) {
          res.status(400).json({
            error: `file_name must be ${MAX_DOULA_DOCUMENT_FILE_NAME_LENGTH} characters or fewer`,
          });
          return;
        }
      }

      const updated = await this.documentRepository.updateDocumentMetadata(
        documentId,
        {
          fileName: normalizedFileName,
          documentType: parsed.data.document_type,
        }
      );
      if (!updated) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      logger.info(
        {
          context: 'DoulaController.renameDocument',
          doulaId,
          documentId,
          outcome: 'success',
        },
        'Doula document renamed'
      );

      res.status(200).json({
        success: true,
        document: {
          id: updated.id,
          documentType: updated.documentType,
          document_type: updated.documentType,
          fileName: updated.fileName,
          file_name: updated.fileName,
          status: updated.status,
          uploadedAt: updated.uploadedAt?.toISOString?.() ?? updated.uploadedAt,
          uploaded_at:
            updated.uploadedAt?.toISOString?.() ?? updated.uploadedAt,
          updatedAt: updated.updatedAt?.toISOString?.() ?? updated.updatedAt,
          updated_at: updated.updatedAt?.toISOString?.() ?? updated.updatedAt,
        },
      });
    } catch (error: any) {
      logger.error(
        {
          context: 'DoulaController.renameDocument',
          errorMessage: error?.message,
          documentId: req.params?.documentId,
          doulaId: req.user?.id,
          outcome: 'error',
        },
        'Error renaming doula document'
      );
      res
        .status(500)
        .json({ error: error.message || 'Failed to rename document' });
    }
  }

  /**
   * Delete a document
   * DELETE /api/doulas/documents/:documentId
   */
  async deleteDocument(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = await this.resolveDocumentDoulaId(req);
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
      const isOwner = await this.documentRepository.isDocumentOwner(
        documentId,
        doulaId
      );
      if (!isOwner) {
        res.status(403).json({
          error: 'You do not have permission to delete this document',
        });
        return;
      }

      // Get document to get file path for deletion
      const document =
        await this.documentRepository.getDocumentById(documentId);
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
        message: 'Document deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting document:', error);
      res.status(500).json({
        error: error.message || 'Failed to delete document',
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
        clients: clients.map((client) => client.toJson()),
      });
    } catch (error: any) {
      console.error('Error fetching assigned clients:', error);
      if (this.isMissingRelationError(error, 'assignments')) {
        res.json({
          success: true,
          clients: [],
          degraded: true,
          source: 'cloud_sql',
          reason: 'assignments_table_missing',
        });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to fetch clients',
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
      const assignedClients = await this.clientUseCase.getClientsLite(
        doulaId,
        'doula'
      );
      const hasAssignment = assignedClients.some(
        (client) => client.id === clientId
      );
      if (!hasAssignment) {
        res.status(404).json({ error: 'Client not found' });
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
        client: client.toJson(),
      });
    } catch (error: any) {
      console.error('Error fetching client details:', error);
      res.status(500).json({
        error: error.message || 'Failed to fetch client details',
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
      const normalizedType = parseHourType(req.body?.type);

      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!normalizedType) {
        res.status(400).json({
          error: 'type is required and must be either prenatal or postpartum',
        });
        return;
      }

      if (!clientId || !startTime || !endTime) {
        res.status(400).json({
          error:
            'Missing required fields: client_id/clientId, start_time/startTime, end_time/endTime',
        });
        return;
      }

      // Verify client is assigned to doula using Cloud SQL-backed assignment join.
      const assignedClients = await this.clientUseCase.getClientsLite(
        doulaId,
        'doula'
      );
      const hasAssignment = assignedClients.some(
        (client) => client.id === clientId
      );
      if (!hasAssignment) {
        res.status(403).json({
          error: 'You can only log hours for clients assigned to you',
        });
        return;
      }

      // Log hours
      const workEntry = await this.userUseCase.addNewHours(
        doulaId,
        clientId,
        new Date(startTime),
        new Date(endTime),
        note || '',
        normalizedType
      );

      res.status(201).json({
        success: true,
        workEntry,
      });
    } catch (error: any) {
      console.error('Error logging hours:', error);
      res.status(500).json({
        error: error.message || 'Failed to log hours',
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
      const hourTypeFilter = parseHourFilter(req.query.type);
      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (req.query.type && !hourTypeFilter) {
        res.status(400).json({
          error:
            'Invalid hour type filter. Must be prenatal, postpartum, or unknown',
        });
        return;
      }

      // Get all hours for this doula
      const allHours = await this.userUseCase.getHoursById(doulaId);

      // Filter to only include hours for clients assigned in Cloud SQL.
      const assignedClients = await this.clientUseCase.getClientsLite(
        doulaId,
        'doula'
      );
      const assignedClientIds = new Set(
        assignedClients.map((client) => client.id)
      );
      const filteredHours = allHours.filter((entry: any) => {
        // Handle both possible client structures: entry.client?.id or entry.client?.user?.id
        const clientId = entry.client?.id || entry.client?.user?.id;
        const matchesType =
          !hourTypeFilter || (entry.type ?? 'unknown') === hourTypeFilter;
        return clientId && assignedClientIds.has(clientId) && matchesType;
      });

      // Avoid 304/no-body caching behavior for frequently changing dashboard data.
      res.set(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      );
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      res.json({
        success: true,
        hours: filteredHours,
        summary: buildHourSummary(filteredHours),
      });
    } catch (error: any) {
      console.error('Error fetching hours:', error);
      if (this.isMissingRelationError(error, 'hours')) {
        res.json({
          success: true,
          hours: [],
          degraded: true,
          source: 'cloud_sql',
          reason: 'hours_table_missing',
        });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to fetch hours',
      });
    }
  }

  /**
   * Update the type for a logged hour
   * PATCH /api/doulas/hours/:hourId
   */
  async updateHour(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      const hourId = req.params.hourId;
      const normalizedType = parseHourType(req.body?.type);

      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!hourId) {
        res.status(400).json({ error: 'Missing hourId' });
        return;
      }

      if (!normalizedType) {
        res.status(400).json({
          error: 'type is required and must be either prenatal or postpartum',
        });
        return;
      }

      const workEntry = await this.userUseCase.updateHourType(
        hourId,
        normalizedType,
        doulaId
      );

      res.json({
        success: true,
        workEntry,
      });
    } catch (error: any) {
      console.error('Error updating hour:', error);
      res.status(500).json({
        error: error.message || 'Failed to update hour',
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
      const {
        type,
        description,
        metadata,
        visibleToClient,
        visible_to_client,
      } = req.body;

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
          error: 'Missing required fields: type, description',
        });
        return;
      }

      // Verify client is assigned to doula using Cloud SQL-backed assignment join.
      const assignedClients = await this.clientUseCase.getClientsLite(
        doulaId,
        'doula'
      );
      const hasAssignment = assignedClients.some(
        (client) => client.id === clientId
      );
      if (!hasAssignment) {
        res.status(403).json({
          error: 'You can only add activities for clients assigned to you',
        });
        return;
      }

      const visible =
        visibleToClient === true ||
        visible_to_client === true ||
        visibleToClient === 'true' ||
        visible_to_client === 'true';
      const creatorName =
        `${req.user?.firstname || ''} ${req.user?.lastname || ''}`.trim() ||
        (req.user?.email || '').trim() ||
        'Staff member';
      const creatorRole = req.user?.role ? String(req.user.role) : 'staff';
      const baseMeta =
        metadata && typeof metadata === 'object' && !Array.isArray(metadata)
          ? { ...metadata }
          : {};
      const mergedMetadata = {
        ...baseMeta,
        visibleToClient: visible,
        createdByName: creatorName,
        createdByRole: creatorRole,
      };

      // Create activity
      const activity = await this.activityRepository.createActivity({
        clientId,
        type,
        description,
        metadata: mergedMetadata,
        timestamp: new Date(),
        createdBy: doulaId,
      });

      res.status(201).json({
        success: true,
        activity: ActivityMapper.fromCloudActivity(activity),
      });
    } catch (error: any) {
      console.error('Error adding activity:', error);
      if (this.isMissingRelationError(error, 'client_activities')) {
        res.status(503).json({
          error:
            'Activities feature not available - client_activities table pending migration',
          degraded: true,
          source: 'cloud_sql',
          reason: 'client_activities_table_missing',
        });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to add activity',
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
      const assignedClients = await this.clientUseCase.getClientsLite(
        doulaId,
        'doula'
      );
      const hasAssignment = assignedClients.some(
        (client) => client.id === clientId
      );
      if (!hasAssignment) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      // Get activities
      const activities =
        await this.activityRepository.getActivitiesByClientId(clientId);

      const dtos = activities.map((activity) =>
        ActivityMapper.fromCloudActivity(activity)
      );
      const enriched = await this.enrichCreatorNames(dtos);

      res.json({
        success: true,
        activities: enriched,
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
        error: error.message || 'Failed to fetch activities',
      });
    }
  }

  /**
   * Toggle whether an existing activity is visible on the client portal
   * PATCH /api/doulas/clients/:clientId/activities/:activityId
   */
  async patchClientActivity(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      const { clientId, activityId } = req.params;
      const { visibleToClient, visible_to_client } = req.body ?? {};

      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!clientId || !activityId) {
        res.status(400).json({ error: 'Missing client ID or activity ID' });
        return;
      }

      let nextVisible: boolean;
      if (typeof visibleToClient === 'boolean') {
        nextVisible = visibleToClient;
      } else if (typeof visible_to_client === 'boolean') {
        nextVisible = visible_to_client;
      } else if (visibleToClient === 'true' || visible_to_client === 'true') {
        nextVisible = true;
      } else if (visibleToClient === 'false' || visible_to_client === 'false') {
        nextVisible = false;
      } else {
        res.status(400).json({
          error:
            'Provide visibleToClient (boolean) to update portal visibility',
        });
        return;
      }

      const assignedClients = await this.clientUseCase.getClientsLite(
        doulaId,
        'doula'
      );
      const hasAssignment = assignedClients.some(
        (client) => client.id === clientId
      );
      if (!hasAssignment) {
        res.status(403).json({
          error: 'You do not have access to this client',
        });
        return;
      }

      const updated = await this.activityRepository.updateActivityMetadataMerge(
        activityId,
        clientId,
        {
          visibleToClient: nextVisible,
        }
      );

      if (!updated) {
        res.status(404).json({ error: 'Activity not found' });
        return;
      }

      res.json({
        success: true,
        activity: ActivityMapper.fromCloudActivity(updated),
      });
    } catch (error: any) {
      console.error('Error patching activity:', error);
      if (this.isMissingRelationError(error, 'client_activities')) {
        res.status(503).json({
          error:
            'Activities feature not available - client_activities table pending migration',
          degraded: true,
          source: 'cloud_sql',
          reason: 'client_activities_table_missing',
        });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to update activity',
      });
    }
  }

  /**
   * Upload doula's profile picture (headshot)
   * POST /api/doulas/profile/picture
   */
  async getProfilePicture(req: AuthRequest, res: Response): Promise<void> {
    const doulaId = req.user?.id;
    if (!doulaId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    try {
      const stored = await this.cloudSqlTeamService.getDoulaProfilePicturePath(doulaId);
      if (!stored || isHttpUrl(stored) || !stored.startsWith(`${doulaId}/`)) {
        res.status(404).json({ error: 'Profile photo not found' }); return;
      }
      const data = await downloadObject(profilePictureObjectPath(stored));
      const mime = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
        : data[0] === 255 && data[1] === 216 && data[2] === 255 ? 'image/jpeg'
        : data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp'
        : /^GIF8[79]a$/.test(data.toString('ascii', 0, 6)) ? 'image/gif' : null;
      if (!mime) { res.status(415).json({ error: 'Unsupported profile photo format' }); return; }
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
      res.type(mime).send(data);
    } catch {
      res.status(500).json({ error: 'Could not load profile photo' });
    }
  }

  private profilePictureReadUrl(req: AuthRequest): string {
    return `${req.protocol}://${req.get('host')}/api/doulas/profile/picture`;
  }

  async uploadProfilePicture(req: AuthRequest, res: Response): Promise<void> {
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
      const allowedMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
      ];
      if (!allowedMimes.includes(file.mimetype)) {
        res
          .status(400)
          .json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP' });
        return;
      }
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        res.status(400).json({ error: 'File size exceeds 5MB limit' });
        return;
      }
      const user = req.user!;
      const imageUrl = await this.userUseCase.uploadProfilePicture(user, file);
      const updated = await this.cloudSqlTeamService.updateDoulaProfilePicture(
        doulaId,
        imageUrl
      );
      if (!updated) {
        res.status(404).json({ error: 'Doula profile not found' });
        return;
      }
      const cloudSqlMember =
        await this.cloudSqlTeamService.getTeamMemberById(doulaId);
      const profile =
        cloudSqlMember && cloudSqlMember.role === 'doula'
          ? this.buildDoulaProfilePayload(cloudSqlMember, {
              profilePictureFallback:
                cloudSqlMember.profile_picture ?? this.profilePictureReadUrl(req),
            })
          : { profile_picture: this.profilePictureReadUrl(req) };
      res.json({ success: true, profile });
    } catch (error: any) {
      console.error('Error uploading doula profile picture:', error);
      res.status(500).json({
        error: error?.message || 'Failed to upload profile picture',
      });
    }
  }

  async getMyAvailability(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const records =
        await this.doulaAvailabilityService.listAvailabilityByDoulaId(doulaId);
      const currentStatus =
        await this.doulaAvailabilityService.getCurrentAvailabilityStatus(
          doulaId
        );

      res.json({
        success: true,
        availabilityStatus: currentStatus,
        records,
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Failed to fetch availability' });
    }
  }

  async createMyAvailability(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const record = await this.doulaAvailabilityService.createAvailability({
        doulaId,
        startAt: req.body?.startAt ?? req.body?.start_at,
        endAt: req.body?.endAt ?? req.body?.end_at,
        availabilityStatus:
          req.body?.availabilityStatus ?? req.body?.availability_status,
        reason: req.body?.reason,
      });

      res.status(201).json({
        success: true,
        record,
      });
    } catch (error: any) {
      const status = error?.status ?? 400;
      res.status(status).json({
        error: error.message || 'Failed to create availability record',
      });
    }
  }

  async updateMyAvailability(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      const availabilityId = req.params.availabilityId;
      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!availabilityId) {
        res.status(400).json({ error: 'availabilityId is required' });
        return;
      }

      const record = await this.doulaAvailabilityService.updateAvailability({
        availabilityId,
        doulaId,
        startAt: req.body?.startAt ?? req.body?.start_at,
        endAt: req.body?.endAt ?? req.body?.end_at,
        availabilityStatus:
          req.body?.availabilityStatus ?? req.body?.availability_status,
        reason: Object.prototype.hasOwnProperty.call(req.body || {}, 'reason')
          ? req.body?.reason
          : undefined,
      });

      res.json({
        success: true,
        record,
      });
    } catch (error: any) {
      const status = error?.status ?? 400;
      res.status(status).json({
        error: error.message || 'Failed to update availability record',
      });
    }
  }

  async deleteMyAvailability(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulaId = req.user?.id;
      const availabilityId = req.params.availabilityId;
      if (!doulaId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!availabilityId) {
        res.status(400).json({ error: 'availabilityId is required' });
        return;
      }

      const removed = await this.doulaAvailabilityService.deleteAvailability(
        availabilityId,
        doulaId
      );
      if (!removed) {
        res.status(404).json({ error: 'Availability record not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Availability record deleted',
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to delete availability record',
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
      const cloudSqlMember =
        await this.cloudSqlTeamService.getTeamMemberById(doulaId);
      if (cloudSqlMember && cloudSqlMember.role === 'doula') {
        const reqUserJson = req.user?.toJSON?.() as any;
        const currentAvailability =
          await this.doulaAvailabilityService.getCurrentAvailabilityStatus(
            doulaId
          );
        const profile = this.buildDoulaProfilePayload(cloudSqlMember, {
          reqUserJson,
          currentAvailability,
        });
        if (!isHttpUrl(String(profile.profile_picture ?? '')) && await this.cloudSqlTeamService.getDoulaProfilePicturePath(doulaId)) {
          profile.profile_picture = this.profilePictureReadUrl(req);
        }
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
        profile: user.toJSON(),
      });
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      res.status(500).json({
        error: error.message || 'Failed to fetch profile',
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
      // Autosave must accept incomplete draft values. Required-field validation
      // belongs to the explicit onboarding submission step.
      if (req.get('x-profile-autosave') !== 'true') {
        for (const [field, label] of [
          ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['zip_code', 'ZIP code'],
        ] as const) {
          if (Object.prototype.hasOwnProperty.call(req.body || {}, field) &&
              (typeof req.body[field] !== 'string' || !req.body[field].trim())) {
            res.status(400).json({ error: `${label} is required.` });
            return;
          }
        }
      }
      // Filter out undefined/null values but keep empty strings for explicit clearing.
      const fieldsToUpdate = Object.entries(req.body || {}).reduce(
        (acc, [key, value]) => {
          if (value !== undefined && value !== null) {
            (acc as any)[key] = value;
          }
          return acc;
        },
        {} as Record<string, any>
      );

      const [doulaBeforeUpdate, documentsBeforeUpdate] = await Promise.all([
        this.cloudSqlTeamService.getTeamMemberById(doulaId),
        this.completenessService.getCompleteness(doulaId),
      ]);
      const profileWasComplete = this.isDoulaProfileComplete(
        doulaBeforeUpdate,
        documentsBeforeUpdate
      );
      const wasProfileRejected =
        doulaBeforeUpdate?.profile_review_status === 'rejected';
      const profileInformationFields = [
        'firstname', 'lastname', 'phone', 'phone_number', 'address', 'city',
        'state', 'country', 'zip_code', 'bio', 'pronouns', 'race_ethnicity',
        'race_ethnicity_other', 'languages_other_than_english',
      ];
      const profileInformationTouched = profileInformationFields.some((field) =>
        Object.prototype.hasOwnProperty.call(fieldsToUpdate, field)
      );

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
        gender?: string | null;
        pronouns?: string | null;
        race_ethnicity?: string[] | null;
        languages_other_than_english?: string[] | null;
        race_ethnicity_other?: string | null;
        other_demographic_details?: string | null;
        scheduling_url?: string | null;
      } = {};

      const sanitizeStringArray = (input: unknown): string[] => {
        if (!Array.isArray(input)) return [];
        const seen = new Set<string>();
        const out: string[] = [];
        for (const item of input) {
          if (typeof item !== 'string') continue;
          const v = item.trim();
          if (!v) continue;
          const key = v.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(v);
        }
        return out;
      };

      if (fieldsToUpdate.firstname !== undefined)
        cloudSqlUpdateData.firstname = String(fieldsToUpdate.firstname);
      if (fieldsToUpdate.lastname !== undefined)
        cloudSqlUpdateData.lastname = String(fieldsToUpdate.lastname);
      if (fieldsToUpdate.fullName !== undefined)
        cloudSqlUpdateData.fullName = String(fieldsToUpdate.fullName);
      if (fieldsToUpdate.email !== undefined)
        cloudSqlUpdateData.email = String(fieldsToUpdate.email);
      if (fieldsToUpdate.phone !== undefined)
        cloudSqlUpdateData.phone = fieldsToUpdate.phone;
      if (fieldsToUpdate.phone_number !== undefined)
        cloudSqlUpdateData.phone_number = fieldsToUpdate.phone_number;
      if (fieldsToUpdate.address !== undefined)
        cloudSqlUpdateData.address = fieldsToUpdate.address;
      if (fieldsToUpdate.city !== undefined)
        cloudSqlUpdateData.city = fieldsToUpdate.city;
      if (fieldsToUpdate.state !== undefined)
        cloudSqlUpdateData.state = fieldsToUpdate.state;
      if (fieldsToUpdate.country !== undefined)
        cloudSqlUpdateData.country = fieldsToUpdate.country;
      if (fieldsToUpdate.zip_code !== undefined)
        cloudSqlUpdateData.zip_code = fieldsToUpdate.zip_code;
      if (fieldsToUpdate.account_status !== undefined)
        cloudSqlUpdateData.account_status = String(
          fieldsToUpdate.account_status
        );
      if (fieldsToUpdate.bio !== undefined)
        cloudSqlUpdateData.bio = fieldsToUpdate.bio;
      if (fieldsToUpdate.gender !== undefined) {
        const g = String(fieldsToUpdate.gender).trim();
        cloudSqlUpdateData.gender = g.length ? g : null;
      }
      if (fieldsToUpdate.pronouns !== undefined) {
        const p = String(fieldsToUpdate.pronouns).trim();
        cloudSqlUpdateData.pronouns = p.length ? p : null;
      }
      if (fieldsToUpdate.race_ethnicity !== undefined) {
        cloudSqlUpdateData.race_ethnicity = sanitizeDoulaRaceEthnicity(
          fieldsToUpdate.race_ethnicity
        );
      }
      const languagesRaw =
        fieldsToUpdate.languages_other_than_english ??
        fieldsToUpdate.languagesOtherThanEnglish ??
        fieldsToUpdate.languages_spoken ??
        fieldsToUpdate.languages_spoken_other_than_english;
      if (languagesRaw !== undefined) {
        const langs = sanitizeStringArray(languagesRaw);
        cloudSqlUpdateData.languages_other_than_english = langs.length
          ? langs
          : [];
      }
      if (fieldsToUpdate.race_ethnicity_other !== undefined) {
        const t = String(fieldsToUpdate.race_ethnicity_other).trim();
        cloudSqlUpdateData.race_ethnicity_other = t.length ? t : null;
      }
      if (fieldsToUpdate.other_demographic_details !== undefined) {
        const t = String(fieldsToUpdate.other_demographic_details).trim();
        cloudSqlUpdateData.other_demographic_details = t.length ? t : null;
      }
      if (
        fieldsToUpdate.scheduling_url !== undefined ||
        fieldsToUpdate.schedulingUrl !== undefined
      ) {
        const t = String(
          fieldsToUpdate.scheduling_url ?? fieldsToUpdate.schedulingUrl ?? ''
        ).trim();
        cloudSqlUpdateData.scheduling_url = t.length ? t : null;
      }

      let updatedMember = await this.cloudSqlTeamService.updateTeamMember(
        doulaId,
        cloudSqlUpdateData
      );
      if (!updatedMember || updatedMember.role !== 'doula') {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      if (wasProfileRejected && profileInformationTouched) {
        updatedMember =
          (await this.cloudSqlTeamService.reviewDoulaProfile(
            doulaId,
            'pending'
          )) ?? updatedMember;
      }

      const documentsAfterUpdate = await this.completenessService.getCompleteness(
        doulaId
      );
      const profileIsComplete = this.isDoulaProfileComplete(
        updatedMember,
        documentsAfterUpdate
      );
      if (
        profileIsComplete &&
        ((!profileWasComplete && !wasProfileRejected) ||
          (wasProfileRejected && profileInformationTouched))
      ) {
        if (updatedMember.profile_review_status !== 'pending') {
          updatedMember =
            (await this.cloudSqlTeamService.reviewDoulaProfile(
              doulaId,
              'pending'
            )) ?? updatedMember;
        }
        await this.notifyDoulaProfileSubmitted(doulaId);
      }

      const reqUserJson = req.user?.toJSON?.() as any;
      const currentAvailability =
        await this.doulaAvailabilityService.getCurrentAvailabilityStatus(
          doulaId
        );
      const profile = this.buildDoulaProfilePayload(updatedMember, {
        reqUserJson,
        currentAvailability,
      });

      res.json({
        success: true,
        profile,
      });
    } catch (error: any) {
      console.error(
        `Error updating profile for doula ${req.user?.id}:`,
        error?.message || error
      );
      res.status(500).json({
        error: error.message || 'Failed to update profile',
      });
    }
  }

  private buildDoulaProfilePayload(
    member: TeamMemberDto,
    opts: {
      reqUserJson?: Record<string, unknown>;
      profilePictureFallback?: string | null;
      currentAvailability?: {
        status: 'available' | 'unavailable';
        reason: string | null;
        startAt: string | null;
        endAt: string | null;
      };
    } = {}
  ) {
    const reqUserJson = opts.reqUserJson;
    const currentAvailability = opts.currentAvailability ?? {
      status: 'available' as const,
      reason: null,
      startAt: null,
      endAt: null,
    };
    const race = Array.isArray(member.race_ethnicity)
      ? member.race_ethnicity
      : [];
    const languages = Array.isArray(member.languages_other_than_english)
      ? member.languages_other_than_english
      : [];
    return {
      id: member.id,
      email: member.email,
      firstname: member.firstname,
      lastname: member.lastname,
      fullName: member.fullName,
      role: 'doula' as const,
      phone: member.phone_number,
      phone_number: member.phone_number,
      address: member.address ?? '',
      city: member.city ?? '',
      state: member.state ?? '',
      country: member.country ?? '',
      zip_code: member.zip_code ?? '',
      bio: member.bio ?? '',
      gender: member.gender ?? '',
      pronouns: member.pronouns ?? '',
      race_ethnicity: race,
      languages_other_than_english: languages,
      race_ethnicity_other: member.race_ethnicity_other ?? '',
      other_demographic_details: member.other_demographic_details ?? '',
      scheduling_url: member.scheduling_url ?? '',
      profile_review_status: member.profile_review_status ?? 'draft',
      profile_rejection_reason: member.profile_rejection_reason ?? null,
      availability_status: currentAvailability.status,
      availability_note: currentAvailability.reason,
      unavailable_from: currentAvailability.startAt,
      unavailable_until: currentAvailability.endAt,
      account_status: member.account_status,
      profile_picture:
        opts.profilePictureFallback ??
        member.profile_picture ??
        (reqUserJson?.profile_picture as string | null | undefined) ??
        null,
      created_at: member.created_at,
      updatedAt: member.updated_at,
    };
  }
}
