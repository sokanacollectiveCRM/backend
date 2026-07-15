import { Response } from 'express';
import {
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ValidationError
} from '../domains/errors';
import { Client } from '../entities/Client';

import { AuthRequest } from '../types';
import { ClientUseCase } from '../usecase/clientUseCase';
import { ClientRepository } from '../repositories/interface/clientRepository';
import { SupabaseAssignmentRepository } from '../repositories/supabaseAssignmentRepository';
import {
  PortalEligibilityService,
  portalEligibilityService,
} from '../services/portalEligibilityService';
import { mergePortalEligibilityFields } from '../utils/portalEligibilityResponse';
import { PortalEligibilitySnapshot } from '../constants/portalEligibility';
import { ClientMapper } from '../mappers/ClientMapper';
import { ActivityMapper } from '../mappers/ActivityMapper';
import { ApiResponse } from '../utils/responseBuilder';
import { canAccessSensitive } from '../utils/sensitiveAccess';
import { updateClientPhi, fetchClientPhi } from '../services/phiBrokerService';
import { syncMatchedClientToQuickBooks } from '../services/customer/syncMatchedClientToQuickBooks';
import { normalizeClientPatch, splitClientPatch } from '../constants/phiFields';
import {
  CloudSqlDoulaAssignmentService,
  normalizeDoulaAssignmentRole,
} from '../services/cloudSqlDoulaAssignmentService';
import { ASSIGNMENT_SERVICE_CATALOG, normalizeAssignmentServices } from '../constants/assignmentServices';
import { logger } from '../common/utils/logger';
import { normalizeStaffReferralOperationalPatch } from '../constants/referralSource';
import {
  parseInsurancePolicyHolderDob,
  validatePrimaryInsuranceWhenRequired,
} from '../billing/expandedInsuranceBilling';
import { getSupabaseAdmin } from '../supabase';
import { ActivityDTO } from '../dto/response/ActivityDTO';
import { ClientDocumentRepository, ClientDocument } from '../repositories/clientDocumentRepository';
import { ClientDocumentUploadService } from '../services/clientDocumentUploadService';
import { File as MulterFile } from 'multer';
import {
  CLIENT_DOCUMENT_ALLOWED_EXTENSIONS,
  CLIENT_DOCUMENT_ALLOWED_MIME_TYPES,
  CLIENT_DOCUMENT_CATEGORY_BILLING,
  CLIENT_DOCUMENT_TYPE_INSURANCE_CARD,
  MAX_CLIENT_DOCUMENT_SIZE_BYTES,
} from '../constants/clientDocuments';
import { DoulaAvailabilityService } from '../services/doulaAvailabilityService';

export class ClientController {
  private static readonly BIRTH_OUTCOMES_DELIVERY_TYPES = new Set([
    'Vaginal (unmedicated)',
    'Vaginal with pain medication/epidural',
    'Assisted vaginal (vacuum/forceps)',
    'Emergency Cesarean',
    'Scheduled Cesarean',
  ]);

  private static readonly BIRTH_OUTCOMES_MEDICATIONS = new Set([
    'Pitocin',
    'Narcotic IV',
    'Epidural',
    'Nitrous Oxide',
    'Cytotec',
  ]);
  private static readonly BILLING_PAYMENT_METHODS = new Set([
    'Self-Pay',
    'Commercial Insurance',
    'Private Insurance',
    'Medicaid',
  ]);

  private static readonly BILLING_FIELDS = new Set([
    'payment_method',
    'insurance',
    'insurance_provider',
    'insurance_member_id',
    'insurance_policy_holder_name',
    'insurance_policy_holder_dob',
    'insurance_policy_holder_relationship',
    'insurance_plan_type',
    'policy_number',
    'insurance_phone_number',
    'has_secondary_insurance',
    'secondary_insurance_provider',
    'secondary_insurance_member_id',
    'secondary_policy_number',
    'self_pay_card_info',
  ]);

  /** Accept camelCase billing keys from older clients; normalized before validation. */
  private static readonly BILLING_CAMEL_TO_SNAKE: Record<string, string> = {
    insurancePolicyHolderName: 'insurance_policy_holder_name',
    insurancePolicyHolderDob: 'insurance_policy_holder_dob',
    insurancePolicyHolderRelationship: 'insurance_policy_holder_relationship',
    insurancePlanType: 'insurance_plan_type',
  };

  private static readonly ZIP_CODE_REGEX = /^(?:\d{5})(?:-\d{4})?$/;

  private setNoStore(res: Response): void {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }

  private async getPortalEligibilitySnapshot(clientId: string): Promise<PortalEligibilitySnapshot | null> {
    try {
      return await this.eligibilityService.getPortalEligibility(clientId);
    } catch {
      return null;
    }
  }

  private mergeEligibility<T extends object>(
    payload: T,
    snapshot: PortalEligibilitySnapshot | null | undefined
  ): T & Partial<PortalEligibilitySnapshot> {
    return mergePortalEligibilityFields(payload as Record<string, unknown>, snapshot ?? undefined) as T &
      Partial<PortalEligibilitySnapshot>;
  }

  private clientUseCase: ClientUseCase;
  private assignmentRepository: SupabaseAssignmentRepository;
  private clientRepository: ClientRepository;
  private eligibilityService: PortalEligibilityService;
  private cloudSqlAssignmentService: CloudSqlDoulaAssignmentService;
  private doulaAvailabilityService: DoulaAvailabilityService;
  private clientDocumentRepository?: ClientDocumentRepository;
  private clientDocumentUploadService?: ClientDocumentUploadService;

  constructor (
    clientUseCase: ClientUseCase,
    assignmentRepository: SupabaseAssignmentRepository,
    clientRepository: ClientRepository,
    clientDocumentRepository?: ClientDocumentRepository,
    clientDocumentUploadService?: ClientDocumentUploadService
  ) {
    this.clientUseCase = clientUseCase;
    this.assignmentRepository = assignmentRepository;
    this.clientRepository = clientRepository;
    this.eligibilityService = portalEligibilityService;
    this.cloudSqlAssignmentService = new CloudSqlDoulaAssignmentService();
    this.doulaAvailabilityService = new DoulaAvailabilityService();
    this.clientDocumentRepository = clientDocumentRepository;
    this.clientDocumentUploadService = clientDocumentUploadService;
  }

  private static readonly PROFILE_FIELD_RULES: Record<string, number> = {
    bio: 2000,
    city: 120,
    state: 60,
    zip_code: 20,
    country: 80,
  };

  private sanitizeProfilePatchFields(
    input: Record<string, any>,
    options: { requireZipCode?: boolean } = {}
  ): { ok: true; value: Record<string, any> } | { ok: false; message: string } {
    const normalized = { ...input };
    for (const [field, maxLen] of Object.entries(ClientController.PROFILE_FIELD_RULES)) {
      if (!(field in normalized)) continue;
      const raw = normalized[field];
      if (raw === null) {
        normalized[field] = null;
        continue;
      }
      const stringValue =
        field === 'zip_code' && typeof raw === 'number' && Number.isFinite(raw)
          ? String(raw)
          : raw;
      if (typeof stringValue !== 'string') {
        return { ok: false, message: `${field} must be a string` };
      }
      const trimmed = stringValue.trim();
      if (trimmed.length === 0) {
        normalized[field] = null;
        continue;
      }
      if (trimmed.length > maxLen) {
        return { ok: false, message: `${field} exceeds max length ${maxLen}` };
      }
      if (field === 'zip_code') {
        if (trimmed.length === 0) {
          if (options.requireZipCode) {
            return { ok: false, message: 'zip_code is required when updating address information' };
          }
          normalized[field] = null;
          continue;
        }
        if (!ClientController.ZIP_CODE_REGEX.test(trimmed)) {
          return { ok: false, message: 'zip_code must be a valid ZIP code' };
        }
      }
      normalized[field] = trimmed;
    }
    return { ok: true, value: normalized };
  }

  private expandBillingInputKeys(input: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = { ...input };
    for (const [camel, snake] of Object.entries(ClientController.BILLING_CAMEL_TO_SNAKE)) {
      if (
        Object.prototype.hasOwnProperty.call(input, camel) &&
        !Object.prototype.hasOwnProperty.call(input, snake)
      ) {
        out[snake] = input[camel];
      }
    }
    return out;
  }

  private extractBillingPatch(input: Record<string, any>): Record<string, any> {
    const normalizedInput = this.expandBillingInputKeys(input || {});
    const billing: Record<string, any> = {};
    for (const [key, value] of Object.entries(normalizedInput)) {
      if (ClientController.BILLING_FIELDS.has(key)) {
        billing[key] = value;
      }
    }
    return billing;
  }

  private stripBillingPatch(input: Record<string, any>): Record<string, any> {
    const profile: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (!ClientController.BILLING_FIELDS.has(key)) {
        profile[key] = value;
      }
    }
    return profile;
  }

  private hasProfileAddressFields(input: Record<string, any>): boolean {
    return ['address_line1', 'address', 'city', 'state', 'country'].some((field) =>
      Object.prototype.hasOwnProperty.call(input, field)
    );
  }

  private trimNullableString(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeOptionalBoolean(value: unknown): boolean | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    }
    return undefined;
  }

  private normalizeBillingRow(row: Record<string, any> | null | undefined): Record<string, any> | null {
    if (!row) return null;
    const holderDobRaw = row.insurance_policy_holder_dob;
    const holderDob =
      holderDobRaw instanceof Date
        ? holderDobRaw.toISOString().slice(0, 10)
        : holderDobRaw ?? null;
    const normalized: Record<string, any> = {
      payment_method: row.payment_method ?? null,
      insurance: row.insurance ?? null,
      insurance_provider: row.insurance_provider ?? null,
      insurance_member_id: row.insurance_member_id ?? null,
      insurance_policy_holder_name: row.insurance_policy_holder_name ?? null,
      insurance_policy_holder_dob: holderDob,
      insurance_policy_holder_relationship: row.insurance_policy_holder_relationship ?? null,
      insurance_plan_type: row.insurance_plan_type ?? null,
      policy_number: row.policy_number ?? null,
      insurance_phone_number: row.insurance_phone_number ?? null,
      has_secondary_insurance: row.has_secondary_insurance ?? null,
      secondary_insurance_provider: row.secondary_insurance_provider ?? null,
      secondary_insurance_member_id: row.secondary_insurance_member_id ?? null,
      secondary_policy_number: row.secondary_policy_number ?? null,
      self_pay_card_info: row.self_pay_card_info ?? null,
      updated_at: row.updated_at ?? null,
    };
    normalized.insurancePolicyHolderName = normalized.insurance_policy_holder_name;
    normalized.insurancePolicyHolderDob = normalized.insurance_policy_holder_dob;
    normalized.insurancePolicyHolderRelationship = normalized.insurance_policy_holder_relationship;
    normalized.insurancePlanType = normalized.insurance_plan_type;
    return normalized;
  }

  private validateBillingPayload(input: Record<string, any>): { value?: Record<string, any>; message?: string } {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return { message: 'Invalid request body' };
    }

    const paymentMethodRaw = this.trimNullableString(input.payment_method);
    if (!paymentMethodRaw) {
      return { message: 'payment_method is required' };
    }
    if (!ClientController.BILLING_PAYMENT_METHODS.has(paymentMethodRaw)) {
      return { message: 'payment_method must be one of: Self-Pay, Commercial Insurance, Private Insurance, Medicaid' };
    }

    const insuranceProvider = this.trimNullableString(input.insurance_provider);
    const insuranceMemberId = this.trimNullableString(input.insurance_member_id);
    const policyNumber = this.trimNullableString(input.policy_number);
    const insurancePhoneNumber = this.trimNullableString(input.insurance_phone_number);
    const hasSecondaryInsurance = this.normalizeOptionalBoolean(input.has_secondary_insurance);
    if (input.has_secondary_insurance !== undefined && hasSecondaryInsurance === undefined) {
      return { message: 'has_secondary_insurance must be a boolean' };
    }
    const secondaryInsuranceProvider = this.trimNullableString(input.secondary_insurance_provider);
    const secondaryInsuranceMemberId = this.trimNullableString(input.secondary_insurance_member_id);
    const secondaryPolicyNumber = this.trimNullableString(input.secondary_policy_number);
    const selfPayCardInfo = this.trimNullableString(input.self_pay_card_info);
    const insurance = this.trimNullableString(input.insurance);
    const insurancePolicyHolderName = this.trimNullableString(input.insurance_policy_holder_name);
    const parsedHolderDob = parseInsurancePolicyHolderDob(input.insurance_policy_holder_dob);
    if (parsedHolderDob.ok === false) {
      return { message: parsedHolderDob.message };
    }
    const insurancePolicyHolderDob = parsedHolderDob.value;
    const insurancePolicyHolderRelationship = this.trimNullableString(input.insurance_policy_holder_relationship);
    const insurancePlanType = this.trimNullableString(input.insurance_plan_type);

    const billingValue: Record<string, any> = {
      payment_method: paymentMethodRaw,
      insurance: null,
      insurance_provider: null,
      insurance_member_id: null,
      insurance_policy_holder_name: null,
      insurance_policy_holder_dob: null,
      insurance_policy_holder_relationship: null,
      insurance_plan_type: null,
      policy_number: null,
      insurance_phone_number: insurancePhoneNumber ?? null,
      has_secondary_insurance: false,
      secondary_insurance_provider: null,
      secondary_insurance_member_id: null,
      secondary_policy_number: null,
      self_pay_card_info: null,
    };

    if (paymentMethodRaw === 'Self-Pay') {
      return {
        value: {
          ...billingValue,
          insurance: null,
          insurance_phone_number: null,
          has_secondary_insurance: false,
          secondary_insurance_provider: null,
          secondary_insurance_member_id: null,
          secondary_policy_number: null,
          self_pay_card_info: selfPayCardInfo ?? null,
        },
      };
    }

    const primaryCheck = validatePrimaryInsuranceWhenRequired({
      insuranceProvider,
      insuranceMemberId,
      insurancePolicyHolderName,
      insurancePolicyHolderDob,
      insurancePolicyHolderRelationship,
      insurancePlanType,
      hasSecondaryInsurance,
      secondaryInsuranceProvider,
      secondaryInsuranceMemberId,
      secondaryPolicyNumber,
    });
    if (primaryCheck.ok === false) {
      return { message: primaryCheck.message };
    }

    return {
      value: {
        ...billingValue,
        insurance: insurance ?? null,
        insurance_provider: insuranceProvider,
        insurance_member_id: insuranceMemberId,
        insurance_policy_holder_name: insurancePolicyHolderName,
        insurance_policy_holder_dob: insurancePolicyHolderDob,
        insurance_policy_holder_relationship: insurancePolicyHolderRelationship,
        insurance_plan_type: insurancePlanType,
        policy_number: policyNumber ?? null,
        has_secondary_insurance: hasSecondaryInsurance ?? false,
        secondary_insurance_provider: hasSecondaryInsurance === true ? secondaryInsuranceProvider : null,
        secondary_insurance_member_id: hasSecondaryInsurance === true ? secondaryInsuranceMemberId : null,
        secondary_policy_number: hasSecondaryInsurance === true ? secondaryPolicyNumber : null,
      },
    };
  }

  private async resolveBillingTargetClientId(req: AuthRequest, idParam?: string): Promise<{ clientId?: string; status?: number; body?: ReturnType<typeof ApiResponse.error> }> {
    if (req.user?.role === 'client') {
      const ownClientId = await this.cloudSqlAssignmentService.getClientIdByAuthUserId(req.user.id);
      if (!ownClientId) {
        return { status: 404, body: ApiResponse.error('Client profile not found', 'NOT_FOUND') };
      }

      if (idParam) {
        const sentAuthUserId = idParam === req.user.id;
        if (!sentAuthUserId && idParam !== ownClientId) {
          return { status: 403, body: ApiResponse.error('Forbidden: cannot access another client billing profile', 'FORBIDDEN') };
        }
      }

      return { clientId: ownClientId };
    }

    if (!idParam) {
      return { status: 400, body: ApiResponse.error('Missing client ID', 'VALIDATION_ERROR') };
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(idParam)) {
      return { status: 400, body: ApiResponse.error(`Invalid client ID format: ${idParam}`, 'VALIDATION_ERROR') };
    }

    return { clientId: idParam };
  }

  private async ensureBillingAccess(req: AuthRequest, clientId: string): Promise<{ status?: number; body?: ReturnType<typeof ApiResponse.error> }> {
    if (req.user?.role === 'client') {
      return {};
    }

    const { canAccess } = await canAccessSensitive(req.user, clientId);
    if (!canAccess) {
      return { status: 403, body: ApiResponse.error('Forbidden', 'FORBIDDEN') };
    }

    return {};
  }

  private static isTransientCloudSqlError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const code = String((error as { code?: string }).code || '').toUpperCase();
    const message = String((error as { message?: string }).message || '').toLowerCase();

    return (
      code === 'ECONNRESET' ||
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT' ||
      code === 'EPIPE' ||
      message.includes('econnreset') ||
      message.includes('connection reset') ||
      message.includes('connection terminated unexpectedly')
    );
  }

  private getClientDocumentRepository(): ClientDocumentRepository {
    if (!this.clientDocumentRepository) {
      throw new Error('Client document repository is not configured');
    }
    return this.clientDocumentRepository;
  }

  private getClientDocumentUploadService(): ClientDocumentUploadService {
    if (!this.clientDocumentUploadService) {
      throw new Error('Client document upload service is not configured');
    }
    return this.clientDocumentUploadService;
  }

  private getFileExtension(fileName: string): string {
    const index = fileName.lastIndexOf('.');
    if (index <= 0 || index === fileName.length - 1) {
      return '';
    }
    return fileName.slice(index).toLowerCase();
  }

  private mapClientDocument(document: ClientDocument) {
    return {
      id: document.id,
      document_type: document.documentType,
      file_name: document.fileName,
      uploaded_at: document.uploadedAt.toISOString(),
      status: document.status,
      content_type: document.mimeType ?? null,
    };
  }

  private async resolveOwnClientId(authUserId: string): Promise<string | null> {
    return this.cloudSqlAssignmentService.getClientIdByAuthUserId(authUserId);
  }

  private async authorizeStaffClientDocumentAccess(req: AuthRequest, res: Response, clientId: string): Promise<boolean> {
    if (!req.user?.id || !req.user.role) {
      res.status(401).json({ error: 'Unauthorized staff access' });
      return false;
    }

    if (req.user.role === 'admin') {
      return true;
    }

    const { canAccess } = await canAccessSensitive(req.user, clientId);
    if (!canAccess) {
      res.status(403).json({ error: 'Unauthorized staff access' });
      return false;
    }

    return true;
  }

  private static isClientDocumentsTableMissing(error: unknown): boolean {
    return ClientController.isTableMissing(error, 'client_documents');
  }

  private static isBirthOutcomesColumnMissing(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const code = String((error as { code?: string }).code || '');
    const message = String((error as { message?: string }).message || '').toLowerCase();
    return (
      code === '42703' &&
      (message.includes('birth_outcomes_induction') ||
        message.includes('birth_outcomes_delivery_type') ||
        message.includes('birth_outcomes_medications_used'))
    );
  }

  private async hasInsuranceCardDocument(clientId: string): Promise<boolean> {
    const documents = await this.getClientDocumentRepository().getDocumentsByClientId(clientId);
    return documents.some(
      (document) => document.documentType === CLIENT_DOCUMENT_TYPE_INSURANCE_CARD
    );
  }

  private async requireInsuranceCardForBilling(clientId: string, res: Response): Promise<boolean> {
    try {
      const hasInsuranceCard = await this.hasInsuranceCardDocument(clientId);
      if (!hasInsuranceCard) {
        res.status(400).json(
          ApiResponse.error(
            'An insurance card upload is required before saving insurance billing',
            'VALIDATION_ERROR'
          )
        );
        return false;
      }
      return true;
    } catch (error) {
      if (ClientController.isClientDocumentsTableMissing(error)) {
        res.status(503).json(
          ApiResponse.error(
            'Client documents feature not available until client_documents migration is applied',
            'SERVICE_UNAVAILABLE'
          )
        );
        return false;
      }
      throw error;
    }
  }

  async uploadMyDocument(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthenticated client' });
        return;
      }

      const clientId = await this.resolveOwnClientId(req.user.id);
      if (!clientId) {
        res.status(404).json({ error: 'Client profile not found' });
        return;
      }

      const file = req.file as MulterFile | undefined;
      if (!file) {
        res.status(400).json({ error: 'Missing file' });
        return;
      }

      const documentType = String(req.body.documentType || req.body.document_type || '').trim();
      if (documentType !== CLIENT_DOCUMENT_TYPE_INSURANCE_CARD) {
        res.status(400).json({ error: 'Unsupported document type' });
        return;
      }

      const category = typeof req.body.category === 'string' ? req.body.category.trim() : '';
      if (category && category !== CLIENT_DOCUMENT_CATEGORY_BILLING) {
        res.status(400).json({ error: 'category must be billing' });
        return;
      }

      if (file.size > MAX_CLIENT_DOCUMENT_SIZE_BYTES) {
        res.status(400).json({ error: 'File size exceeds 10 MB limit' });
        return;
      }

      const fileExtension = this.getFileExtension(file.originalname);
      const hasAllowedExtension = CLIENT_DOCUMENT_ALLOWED_EXTENSIONS.includes(fileExtension as typeof CLIENT_DOCUMENT_ALLOWED_EXTENSIONS[number]);
      const hasAllowedMimeType = CLIENT_DOCUMENT_ALLOWED_MIME_TYPES.includes(file.mimetype as typeof CLIENT_DOCUMENT_ALLOWED_MIME_TYPES[number]);
      if (!hasAllowedExtension || !hasAllowedMimeType) {
        res.status(400).json({
          error:
            'Unsupported file type. Allowed: JPEG/PNG/WebP/HEIC/PDF (.jpg, .jpeg, .png, .webp, .heic, .heif, .pdf)',
        });
        return;
      }

      const uploaded = await this.getClientDocumentUploadService().uploadDocument(
        file,
        clientId,
        CLIENT_DOCUMENT_TYPE_INSURANCE_CARD
      );

      const document = await this.getClientDocumentRepository().createDocument({
        clientId,
        documentType: CLIENT_DOCUMENT_TYPE_INSURANCE_CARD,
        category: CLIENT_DOCUMENT_CATEGORY_BILLING,
        fileName: uploaded.fileName,
        filePath: uploaded.filePath,
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType,
      });

      res.status(201).json({
        success: true,
        data: this.mapClientDocument(document),
      });
    } catch (error) {
      if (ClientController.isClientDocumentsTableMissing(error)) {
        res.status(503).json({ error: 'Client documents feature not available until client_documents migration is applied' });
        return;
      }

      const err = this.handleError(error as Error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  async getMyDocuments(req: AuthRequest, res: Response): Promise<void> {
    try {
      this.setNoStore(res);
      if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthenticated client' });
        return;
      }

      const clientId = await this.resolveOwnClientId(req.user.id);
      if (!clientId) {
        res.status(404).json({ error: 'Client profile not found' });
        return;
      }

      const documents = await this.getClientDocumentRepository().getDocumentsByClientId(clientId);
      res.json({
        success: true,
        documents: documents.map((document) => this.mapClientDocument(document)),
      });
    } catch (error) {
      if (ClientController.isClientDocumentsTableMissing(error)) {
        res.json({ success: true, documents: [] });
        return;
      }

      const err = this.handleError(error as Error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  async getMyDocumentUrl(req: AuthRequest, res: Response): Promise<void> {
    try {
      this.setNoStore(res);
      if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthenticated client' });
        return;
      }

      const clientId = await this.resolveOwnClientId(req.user.id);
      if (!clientId) {
        res.status(404).json({ error: 'Client profile not found' });
        return;
      }

      const document = await this.getClientDocumentRepository().getDocumentById(req.params.documentId);
      if (!document || document.clientId !== clientId) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      const url = await this.getClientDocumentRepository().getSignedUrl(document.filePath);
      res.json({ success: true, url });
    } catch (error) {
      const err = this.handleError(error as Error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  async deleteMyDocument(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthenticated client' });
        return;
      }

      const clientId = await this.resolveOwnClientId(req.user.id);
      if (!clientId) {
        res.status(404).json({ error: 'Client profile not found' });
        return;
      }

      const { documentId } = req.params;
      if (!documentId) {
        res.status(400).json({ error: 'Missing document ID' });
        return;
      }

      const document = await this.getClientDocumentRepository().getDocumentById(documentId);
      if (!document || document.clientId !== clientId) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      await this.getClientDocumentUploadService().deleteDocument(document.filePath);
      await this.getClientDocumentRepository().deleteDocument(documentId);

      res.json({
        success: true,
        message: 'Document deleted successfully',
      });
    } catch (error) {
      const err = this.handleError(error as Error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  async getClientDocuments(req: AuthRequest, res: Response): Promise<void> {
    try {
      this.setNoStore(res);
      const { clientId } = req.params;
      if (!clientId) {
        res.status(400).json({ error: 'Missing clientId' });
        return;
      }

      const authorized = await this.authorizeStaffClientDocumentAccess(req, res, clientId);
      if (!authorized) {
        return;
      }

      const documents = await this.getClientDocumentRepository().getDocumentsByClientId(clientId);
      res.json({
        success: true,
        documents: documents.map((document) => this.mapClientDocument(document)),
      });
    } catch (error) {
      if (ClientController.isClientDocumentsTableMissing(error)) {
        res.json({ success: true, documents: [] });
        return;
      }

      const err = this.handleError(error as Error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  async getClientDocumentUrl(req: AuthRequest, res: Response): Promise<void> {
    try {
      this.setNoStore(res);
      const { clientId, documentId } = req.params;
      if (!clientId || !documentId) {
        res.status(400).json({ error: 'Missing clientId or documentId' });
        return;
      }

      const authorized = await this.authorizeStaffClientDocumentAccess(req, res, clientId);
      if (!authorized) {
        return;
      }

      const document = await this.getClientDocumentRepository().getDocumentById(documentId);
      if (!document || document.clientId !== clientId) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      const url = await this.getClientDocumentRepository().getSignedUrl(document.filePath);
      res.json({ success: true, url });
    } catch (error) {
      const err = this.handleError(error as Error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  private async enrichCreatorNames(dtos: ActivityDTO[]): Promise<ActivityDTO[]> {
    const unresolvedIds = Array.from(
      new Set(
        dtos
          .filter((d) => d.created_by && (!d.created_by_name || d.created_by_name === 'Staff member'))
          .map((d) => d.created_by as string)
      )
    );
    if (!unresolvedIds.length) return dtos;

    const supabase = getSupabaseAdmin();
    const resolved = new Map<string, { name: string; role?: string }>();

    await Promise.all(
      unresolvedIds.map(async (id) => {
        try {
          const { data, error } = await supabase.auth.admin.getUserById(id);
          if (error || !data?.user) return;
          const meta = (data.user.user_metadata as Record<string, unknown> | undefined) || {};
          const appMeta = (data.user.app_metadata as Record<string, unknown> | undefined) || {};
          const first = String(meta.first_name ?? meta.firstname ?? '').trim();
          const last = String(meta.last_name ?? meta.lastname ?? '').trim();
          const full = `${first} ${last}`.trim();
          const email = String(data.user.email || '').trim();
          const role = String(meta.role ?? appMeta.role ?? '').trim() || undefined;
          const name = full || email || 'Staff member';
          resolved.set(id, { name, role });
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

  //
  // getClients()
  //
  // Grabs all clients (lite or detailed) based on role or query param
  //
  // returns:
  //    Clients[]
  //
  async getClients(req: AuthRequest, res: Response): Promise<void> {
    try {
      this.setNoStore(res);
      const { id, role } = req.user;
      const { detailed, limit: limitParam } = req.query;
      const clients = detailed === 'true'
        ? await this.clientUseCase.getClientsDetailed(id, role)
        : await this.clientUseCase.getClientsLite(id, role);

      const limit = limitParam != null ? Math.min(Math.max(0, parseInt(String(limitParam), 10) || 0), 1000) : undefined;
      const sliced = limit != null && limit > 0 ? clients.slice(0, limit) : clients;

      const eligibilityByClientId = await this.eligibilityService.getPortalEligibilityBatch(
        sliced.map((client) => client.id)
      );

      const dtos = sliced.map((client) =>
        this.mergeEligibility(
          ClientMapper.toListItemDTO(
            client,
            eligibilityByClientId.get(client.id)?.is_eligible
          ),
          eligibilityByClientId.get(client.id)
        )
      );
      logger.info({ source: 'cloud_sql', count: dtos.length }, '[Client] list response');
      res.json(ApiResponse.list(dtos, dtos.length));
    } catch (getError) {
      if (ClientController.isTransientCloudSqlError(getError)) {
        logger.warn('[Client] transient Cloud SQL error while listing clients; returning empty list');
        res.setHeader('x-data-degraded', 'cloud-sql-transient');
        res.json(
          ApiResponse.list([], 0, {
            degraded: true,
            source: 'cloud_sql',
            reason: 'transient_connection_error',
          })
        );
        return;
      }

      const msg = (getError instanceof Error ? getError.message : String(getError)) || '';
      if (msg.includes('does not exist') && msg.toLowerCase().includes('column')) {
        if (!res.headersSent) {
          res.status(503).json({
            error: 'phi_clients is missing columns required by the backend. Run migrations/alter_phi_clients_backend_columns.sql on your Cloud SQL database (sokana_private).',
            code: 'CLOUD_SQL_SCHEMA',
          });
        }
        return;
      }
      const error = this.handleError(getError, res);
      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message });
      }
    }
  }
//
  // getCSVClients()
  //
  // Grabs all client data in CSV form
  //
  // returns:
  //    CSV of users
  //
  async exportCSV(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    try {
      const {role} = req.user;
      const clientsCSV = await this.clientUseCase.exportCSV(role);
      res.header("Content-Type", "text/csv");
      res.attachment("clients.csv");

      res.send(clientsCSV);
    }
    catch (getError) {
      const error = this.handleError(getError, res);

      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message})
      }
    }
  }

  //
  // getClientById()
  //
  // Grab a specific client from Cloud SQL (phi_clients).
  // Operational fields always; PHI fields only when user is authorized (admin or assigned doula).
  //
  async getClientById(req: AuthRequest, res: Response): Promise<void> {
  try {
    this.setNoStore(res);
    const { id } = req.params;
    let targetClientId = id;
    if (!targetClientId) {
      res.status(400).json(ApiResponse.error('Missing client ID', 'VALIDATION_ERROR'));
      return;
    }

    // Clients may send either client_id or auth_user_id in :id.
    if (req.user?.role === 'client') {
      const ownClientId = await this.cloudSqlAssignmentService.getClientIdByAuthUserId(req.user.id);
      if (!ownClientId) {
        res.status(404).json(ApiResponse.error('Client profile not found', 'NOT_FOUND'));
        return;
      }
      const sentAuthUserId = targetClientId === req.user.id;
      if (!sentAuthUserId && targetClientId !== ownClientId) {
        res.status(403).json(ApiResponse.error('Forbidden: cannot access another client profile', 'FORBIDDEN'));
        return;
      }
      targetClientId = ownClientId;
    }

    const clientRow = await this.clientRepository.getClientById?.(targetClientId) ?? null;
    if (!clientRow) {
      res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
      return;
    }

    const eligibility = await this.getPortalEligibilitySnapshot(targetClientId);
    const dto = this.mergeEligibility(
      ClientMapper.toDetailDTO(clientRow, eligibility?.is_eligible),
      eligibility
    );

    const { canAccess } = await canAccessSensitive(req.user, targetClientId);
    const canAccessForResponse = canAccess || req.user?.role === 'client';
    if (!canAccessForResponse) {
      logger.info({ clientId: targetClientId, source: 'cloud_sql', phi: 'skipped (unauthorized)' }, '[Client] detail response');
      res.json(ApiResponse.success(dto));
      return;
    }

    try {
      const fullClient = await this.clientRepository.findClientDetailedById(targetClientId);
      const u = fullClient.user;
      const merged: Record<string, unknown> = { ...dto };
      if (fullClient.health_history != null) merged.health_history = fullClient.health_history;
      if (fullClient.allergies != null) merged.allergies = fullClient.allergies;
      if (fullClient.due_date != null) merged.due_date = fullClient.due_date instanceof Date ? fullClient.due_date.toISOString().slice(0, 10) : fullClient.due_date;
      if (fullClient.annual_income != null) merged.annual_income = fullClient.annual_income;
      if (fullClient.baby_sex != null) merged.baby_sex = fullClient.baby_sex;
      if (u?.health_notes != null) merged.health_notes = u.health_notes;
      if ((u as any)?.birth_outcomes != null) merged.birth_outcomes = (u as any).birth_outcomes;
      if ((u as any)?.birth_outcomes_induction != null) merged.birth_outcomes_induction = (u as any).birth_outcomes_induction;
      if ((u as any)?.birth_outcomes_delivery_type != null) merged.birth_outcomes_delivery_type = (u as any).birth_outcomes_delivery_type;
      if ((u as any)?.birth_outcomes_medications_used != null) merged.birth_outcomes_medications_used = (u as any).birth_outcomes_medications_used;
      if (u?.baby_name != null) merged.baby_name = u.baby_name;
      if (u?.number_of_babies != null) merged.number_of_babies = u.number_of_babies;
      if (u?.race_ethnicity != null) merged.race_ethnicity = u.race_ethnicity;
      if (u?.client_age_range != null) merged.client_age_range = u.client_age_range;
      merged.insurance = u?.insurance ?? null;
      merged.payment_method = u?.payment_method ?? null;
      merged.insurance_provider = u?.insurance_provider ?? null;
      merged.insurance_member_id = u?.insurance_member_id ?? null;
      merged.insurance_policy_holder_name = u?.insurance_policy_holder_name ?? null;
      const uDob = (u as any)?.insurance_policy_holder_dob;
      merged.insurance_policy_holder_dob =
        uDob instanceof Date ? uDob.toISOString().slice(0, 10) : uDob ?? null;
      merged.insurance_policy_holder_relationship = u?.insurance_policy_holder_relationship ?? null;
      merged.insurance_plan_type = u?.insurance_plan_type ?? null;
      merged.policy_number = u?.policy_number ?? null;
      merged.insurance_phone_number = u?.insurance_phone_number ?? null;
      merged.has_secondary_insurance = u?.has_secondary_insurance ?? null;
      merged.secondary_insurance_provider = u?.secondary_insurance_provider ?? null;
      merged.secondary_insurance_member_id = u?.secondary_insurance_member_id ?? null;
      merged.secondary_policy_number = u?.secondary_policy_number ?? null;
      merged.self_pay_card_info = u?.self_pay_card_info ?? null;
      merged.referral_source = u?.referral_source ?? null;
      merged.referral_name = u?.referral_name ?? null;
      merged.referral_email = u?.referral_email ?? null;
      merged.referral_source_other = u?.referral_source_other ?? null;
      if (u?.pregnancy_number != null) merged.pregnancy_number = u.pregnancy_number;
      if (u?.had_previous_pregnancies != null) merged.had_previous_pregnancies = u.had_previous_pregnancies;
      if (u?.previous_pregnancies_count != null) merged.previous_pregnancies_count = u.previous_pregnancies_count;
      if (u?.living_children_count != null) merged.living_children_count = u.living_children_count;
      if (u?.past_pregnancy_experience != null) merged.past_pregnancy_experience = u.past_pregnancy_experience;
      if ((u as any)?.medications != null) merged.medications = (u as any).medications;
      if ((u as any)?.date_of_birth != null) merged.date_of_birth = typeof (u as any).date_of_birth === 'string' ? (u as any).date_of_birth : ((u as any).date_of_birth as Date)?.toISOString?.()?.slice(0, 10);
      if ((u as any)?.address_line1 != null) merged.address_line1 = (u as any).address_line1;
      if ((u as any)?.address_line1 != null) merged.address = (u as any).address_line1;
      if ((u as any)?.city != null) merged.city = (u as any).city;
      if ((u as any)?.state != null) merged.state = (u as any).state;
      if ((u as any)?.zip_code != null) merged.zipCode = (u as any).zip_code;
      if ((u as any)?.country != null) merged.country = (u as any).country;
      if ((u as any)?.bio != null) merged.bio = (u as any).bio;
      logger.info({ clientId: targetClientId, source: 'cloud_sql', phi: 'included' }, '[Client] detail response');
      res.json(ApiResponse.success(merged));
    } catch {
      res.json(ApiResponse.success(dto));
    }
  } catch (error) {
    const err = this.handleError(error, res);
    if (!res.headersSent) {
      res.status(err.status).json(ApiResponse.error(err.message));
    }
  }
}

  async deleteClient(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.body;
    console.log('DELETE /clients/delete called with id:', id);
    if (!id) {
      console.log('No client ID provided');
      res.status(400).json({ error: 'Missing client ID' });
      return;
    }
    try {
      await this.clientUseCase.deleteClient(id);
      console.log('Client deleted successfully:', id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting client:', error);
      const err = this.handleError(error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  //
  // updateClientStatus
  //
  // Updates client status in client_info table by grabbing the client to update in the request body
  //
  // returns:
  //    Client with updatedAt timestamp (or ClientDetailDTO in canonical mode)
  //
  async updateClientStatus(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    const { clientId, status } = req.body;
    const readMode = process.env.SPLIT_DB_READ_MODE;

    // Require PRIMARY mode - shadow mode disabled
    if (readMode !== 'primary') {
      res.status(501).json(ApiResponse.error('Shadow disabled', 'SHADOW_DISABLED'));
      return;
    }

    // Validate request body
    if (!clientId || typeof clientId !== 'string') {
      res.status(400).json(ApiResponse.error('Invalid request: clientId is required and must be a string', 'VALIDATION_ERROR'));
      return;
    }

    if (!status || typeof status !== 'string' || status.trim() === '') {
      res.status(400).json(ApiResponse.error('Invalid request: status is required and must be a non-empty string', 'VALIDATION_ERROR'));
      return;
    }

    try {
      // Use repository with explicit SELECT columns (no select('*'), no PHI)
      const updatedRow = await this.clientRepository.updateClientStatusCanonical?.(clientId, status.trim()) ?? null;

      if (!updatedRow) {
        res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
        return;
      }

      // Compute eligibility (optional, swallow errors)
      const eligibility = await this.getPortalEligibilitySnapshot(clientId);
      const isEligible = eligibility?.is_eligible ?? false;

      // When transitioning to 'matched', fire QB customer sync (non-blocking).
      // QB may not be connected in all environments; failures are logged only.
      const isMatchedConversion = status.trim() === 'matched' || status.trim() === 'customer';
      if (isMatchedConversion) {
        syncMatchedClientToQuickBooks({
          clientId,
          firstName: updatedRow.first_name || '',
          lastName: updatedRow.last_name || '',
          email: updatedRow.email || '',
          existingQboCustomerId: updatedRow.qbo_customer_id,
        })
          .then((result) => {
            logger.info(
              { clientId, qboCustomerId: result.qboCustomerId, alreadyExisted: result.alreadyExisted },
              result.alreadyExisted
                ? '[Client] QB customer already existed; linked to CRM record'
                : '[Client] QB customer created and linked to CRM record'
            );
          })
          .catch((err) => {
            logger.warn({ clientId, error: (err as Error)?.message }, '[Client] QB customer sync failed (non-blocking)');
          });
      }

      // Map to DTO and return canonical response
      const dto = this.mergeEligibility(ClientMapper.toDetailDTO(updatedRow, isEligible), eligibility);
      res.json(ApiResponse.success(dto));
    }
    catch (statusError) {
      const error = this.handleError(statusError, res);
      res.status(error.status).json(ApiResponse.error(error.message));
    }
  }

  //
  // updateClient
  //
  // Split-write update: routes PHI fields to sokana-private (via PHI Broker)
  // and operational fields to Supabase. Returns merged fresh read.
  //
  // PHI fields (sokana-private): first_name, last_name, email, phone_number,
  //   date_of_birth, address/address_line1, due_date, health_history, allergies, etc.
  // Operational fields (Supabase): status, service_needed, portal_status, and all others.
  //
  // returns:
  //    Canonical: { success: true, data: ClientDetailDTO (merged operational + PHI) }
  //
  async updateClient(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    const { id } = req.params;
    let targetClientId = id;
    const updateData = req.body;
    const readMode = process.env.SPLIT_DB_READ_MODE;

    // Require PRIMARY mode
    if (readMode !== 'primary') {
      res.status(501).json(ApiResponse.error('Shadow disabled', 'SHADOW_DISABLED'));
      return;
    }

    // Validate client ID
    if (!targetClientId) {
      res.status(400).json(ApiResponse.error('Missing client ID', 'VALIDATION_ERROR'));
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetClientId)) {
      res.status(400).json(ApiResponse.error(`Invalid client ID format: ${targetClientId}`, 'VALIDATION_ERROR'));
      return;
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json(ApiResponse.error('No fields to update', 'VALIDATION_ERROR'));
      return;
    }

    // Clients can only update their own record.
    if (req.user?.role === 'client') {
      const ownClientId = await this.cloudSqlAssignmentService.getClientIdByAuthUserId(req.user.id);
      if (!ownClientId) {
        res.status(404).json(ApiResponse.error('Client profile not found', 'NOT_FOUND'));
        return;
      }
      // Frontend may send auth user id in :id; accept both auth id and resolved client id.
      const sentAuthUserId = targetClientId === req.user.id;
      if (!sentAuthUserId && ownClientId !== targetClientId) {
        res.status(403).json(ApiResponse.error('Forbidden: cannot update another client profile', 'FORBIDDEN'));
        return;
      }
      targetClientId = ownClientId;
    }

    try {
      // ── Step 0: Normalize + validate profile/address field lengths ──
      const normalizedRaw = normalizeClientPatch(updateData);
      const billingPatch = this.extractBillingPatch(normalizedRaw);
      const profilePatch = this.stripBillingPatch(normalizedRaw);
      const billingFieldsPresent = Object.keys(billingPatch).length > 0;

      const profilePatchForValidation = { ...profilePatch };
      if (billingFieldsPresent && !this.hasProfileAddressFields(profilePatchForValidation)) {
        delete profilePatchForValidation.zip_code;
      }

      const sanitized = this.sanitizeProfilePatchFields(profilePatchForValidation, {
        requireZipCode: this.hasProfileAddressFields(profilePatchForValidation),
      });
      if (!sanitized.ok) {
        res.status(400).json(ApiResponse.error((sanitized as { ok: false; message: string }).message, 'VALIDATION_ERROR'));
        return;
      }
      const normalized = sanitized.value;

      // ── Step 1: Split payload into operational (Supabase) vs PHI (broker) ──
      let { operational, phi } = splitClientPatch(normalized);

      // Cloud SQL is now canonical for client profile data; for self-service client
      // updates, route all fields to Cloud SQL and skip PHI broker split/gating.
      if (req.user?.role === 'client') {
        operational = { ...operational, ...phi };
        phi = {};
      }

      logger.info({
        clientId: id,
        operationalKeys: Object.keys(operational),
        phiKeyCount: Object.keys(phi).length, // don't log PHI field names in prod
      }, '[Client] update payload split');

      const referralPatchKeys = ['referral_source', 'referral_source_other', 'referral_name', 'referral_email'];
      if (referralPatchKeys.some((k) => Object.prototype.hasOwnProperty.call(operational, k))) {
        const fullClient = await this.clientRepository.findClientDetailedById(targetClientId);
        const u = fullClient.user;
        const current = {
          referral_source: u?.referral_source ?? null,
          referral_name: u?.referral_name ?? null,
          referral_email: u?.referral_email ?? null,
          referral_source_other: u?.referral_source_other ?? null,
        };
        const ref = normalizeStaffReferralOperationalPatch(operational as Record<string, unknown>, current);
        if (ref.ok === false) {
          res.status(400).json(ApiResponse.error(ref.message, 'VALIDATION_ERROR'));
          return;
        }
        Object.assign(operational as Record<string, unknown>, ref.operational);
      }

      // ── Step 2: Authorization check (one call, reuse result) ──
      const { canAccess, assignedClientIds } = await canAccessSensitive(req.user, targetClientId);
      const requester = {
        role: req.user?.role || '',
        userId: req.user?.id || '',
        assignedClientIds,
      };

      // If PHI fields are present but user is not authorized → reject
      if (Object.keys(phi).length > 0 && !canAccess) {
        logger.warn({ clientId: id, role: req.user?.role }, '[Client] unauthorized PHI update attempt');
        res.status(403).json(ApiResponse.error('Not authorized to update PHI fields', 'FORBIDDEN'));
        return;
      }

      // Billing updates are handled independently from profile/PHI writes so
      // stray profile fields do not block a valid billing-only change.
      let billingWriteResult: Record<string, any> | null = null;
      if (billingFieldsPresent) {
        const validatedBilling = this.validateBillingPayload(billingPatch);
        if (!validatedBilling.value) {
          res.status(400).json(ApiResponse.error(validatedBilling.message || 'Invalid request body', 'VALIDATION_ERROR'));
          return;
        }

        const billingAccess = await this.ensureBillingAccess(req, targetClientId);
        if (billingAccess.status) {
          res.status(billingAccess.status).json(billingAccess.body);
          return;
        }

        if (validatedBilling.value.payment_method !== 'Self-Pay') {
          const hasInsuranceCard = await this.requireInsuranceCardForBilling(targetClientId, res);
          if (!hasInsuranceCard) {
            return;
          }
        }

        billingWriteResult = await this.clientRepository.updateClientBilling?.(targetClientId, validatedBilling.value)
          ?? await this.clientRepository.updateClientOperational?.(targetClientId, validatedBilling.value)
          ?? null;

        if (!billingWriteResult) {
          res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
          return;
        }
      }

      // ── Step 3a: Write operational fields (Supabase or Cloud SQL) ──
      let operationalResult = null;
      if (Object.keys(operational).length > 0 && this.clientRepository.updateClientOperational) {
        operationalResult = await this.clientRepository.updateClientOperational(targetClientId, operational);
        if (!operationalResult) {
          res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
          return;
        }
      }

      // ── Step 3b: Write PHI fields to sokana-private (via broker) ──
      let phiWriteResult = null;
      if (Object.keys(phi).length > 0) {
        phiWriteResult = await updateClientPhi(targetClientId, requester, phi);

        // DEBT: Write-through cache — keep Supabase identity fields in sync so list
        // endpoint shows current names. Broker stays authoritative.
        // TODO: Remove when list endpoint uses display_name/client_code instead of names.
        if (phi.first_name || phi.last_name || phi.email || phi.phone_number) {
          try {
            await this.clientRepository.updateIdentityCache?.(targetClientId, {
              first_name: phi.first_name,
              last_name: phi.last_name,
              email: phi.email,
              phone_number: phi.phone_number,
            });
          } catch {
            logger.warn({ clientId: id }, '[Client] identity cache write failed (non-blocking)');
          }
        }
      }

      // ── Step 4: Fresh read — get authoritative data from both sources ──
      const freshOperational = operationalResult ?? await this.clientRepository.getClientById?.(targetClientId) ?? null;
      if (!freshOperational) {
        res.status(404).json(ApiResponse.error('Client not found after update', 'NOT_FOUND'));
        return;
      }

      // Compute eligibility
      const eligibility = await this.getPortalEligibilitySnapshot(targetClientId);
      const isEligible = eligibility?.is_eligible ?? false;

      // Map operational to canonical DTO
      const dto = this.mergeEligibility(
        ClientMapper.toDetailDTO(freshOperational, isEligible),
        eligibility
      );

      // Merge PHI for the response (if authorized / self client view)
      let response: Record<string, any> = { ...dto };
      if (billingWriteResult) {
        response = { ...response, ...this.normalizeBillingRow(billingWriteResult) };
      }
      if (req.user?.role === 'client') {
        try {
          const fullClient = await this.clientRepository.findClientDetailedById(targetClientId);
          const u = fullClient.user as any;
          if (fullClient.health_history != null) response.health_history = fullClient.health_history;
          if (fullClient.allergies != null) response.allergies = fullClient.allergies;
          if (fullClient.due_date != null) response.due_date = fullClient.due_date instanceof Date ? fullClient.due_date.toISOString().slice(0, 10) : fullClient.due_date;
          if (fullClient.annual_income != null) response.annual_income = fullClient.annual_income;
          if (fullClient.baby_sex != null) response.baby_sex = fullClient.baby_sex;
          if (u?.health_notes != null) response.health_notes = u.health_notes;
          if ((u as any)?.birth_outcomes != null) response.birth_outcomes = (u as any).birth_outcomes;
          if ((u as any)?.birth_outcomes_induction != null) response.birth_outcomes_induction = (u as any).birth_outcomes_induction;
          if ((u as any)?.birth_outcomes_delivery_type != null) response.birth_outcomes_delivery_type = (u as any).birth_outcomes_delivery_type;
          if ((u as any)?.birth_outcomes_medications_used != null) response.birth_outcomes_medications_used = (u as any).birth_outcomes_medications_used;
          if (u?.baby_name != null) response.baby_name = u.baby_name;
          if (u?.number_of_babies != null) response.number_of_babies = u.number_of_babies;
          if (u?.race_ethnicity != null) response.race_ethnicity = u.race_ethnicity;
          if (u?.client_age_range != null) response.client_age_range = u.client_age_range;
          response.insurance = u?.insurance ?? null;
          response.payment_method = u?.payment_method ?? null;
          response.insurance_provider = u?.insurance_provider ?? null;
          response.insurance_member_id = u?.insurance_member_id ?? null;
          response.insurance_policy_holder_name = u?.insurance_policy_holder_name ?? null;
          const respHolderDob = u?.insurance_policy_holder_dob;
          response.insurance_policy_holder_dob =
            respHolderDob instanceof Date ? respHolderDob.toISOString().slice(0, 10) : respHolderDob ?? null;
          response.insurance_policy_holder_relationship = u?.insurance_policy_holder_relationship ?? null;
          response.insurance_plan_type = u?.insurance_plan_type ?? null;
          response.policy_number = u?.policy_number ?? null;
          response.insurance_phone_number = u?.insurance_phone_number ?? null;
          response.has_secondary_insurance = u?.has_secondary_insurance ?? null;
          response.secondary_insurance_provider = u?.secondary_insurance_provider ?? null;
          response.secondary_insurance_member_id = u?.secondary_insurance_member_id ?? null;
          response.secondary_policy_number = u?.secondary_policy_number ?? null;
          response.self_pay_card_info = u?.self_pay_card_info ?? null;
          response.referral_source = u?.referral_source ?? null;
          response.referral_name = u?.referral_name ?? null;
          response.referral_email = u?.referral_email ?? null;
          response.referral_source_other = u?.referral_source_other ?? null;
          if (u?.pregnancy_number != null) response.pregnancy_number = u.pregnancy_number;
          if (u?.had_previous_pregnancies != null) response.had_previous_pregnancies = u.had_previous_pregnancies;
          if (u?.previous_pregnancies_count != null) response.previous_pregnancies_count = u.previous_pregnancies_count;
          if (u?.living_children_count != null) response.living_children_count = u.living_children_count;
          if (u?.past_pregnancy_experience != null) response.past_pregnancy_experience = u.past_pregnancy_experience;
          if (u?.medications != null) response.medications = u.medications;
          if (u?.date_of_birth != null) response.date_of_birth = typeof u.date_of_birth === 'string' ? u.date_of_birth : (u.date_of_birth as Date)?.toISOString?.()?.slice(0, 10);
          if (u?.address_line1 != null) response.address_line1 = u.address_line1;
          if (u?.address_line1 != null) response.address = u.address_line1;
          if (u?.city != null) response.city = u.city;
          if (u?.state != null) response.state = u.state;
          if (u?.zip_code != null) response.zipCode = u.zip_code;
          if (u?.country != null) response.country = u.country;
          if (u?.bio != null) response.bio = u.bio;
        } catch {
          logger.warn({ clientId: targetClientId }, '[Client] self profile merge failed after update');
        }
      } else if (canAccess) {
        try {
          // Use broker write result if we just wrote, otherwise fresh read
          const freshPhi = phiWriteResult ?? await fetchClientPhi(targetClientId, requester);
          response = { ...dto, ...freshPhi };
        } catch {
          // PHI fetch failed — return operational only, don't block update response
          logger.warn({ clientId: id }, '[Client] PHI fetch failed after update, returning operational only');
        }
      }

      // ── Step 5: Source-of-truth instrumentation ──
      logger.info({
        clientId: targetClientId,
        sources: {
          operational: Object.keys(operational).length > 0 ? 'cloud_sql' : 'none',
          sensitive: Object.keys(phi).length > 0 ? 'phiBroker' : 'none',
        },
        keys: {
          operational: Object.keys(freshOperational),
          sensitive: Object.keys(phiWriteResult ?? {}),
          mergedSample: Object.keys(response).slice(0, 20),
        },
      }, '[Client] update response composition');

      res.json(ApiResponse.success(response));
    } catch (error) {
      logger.error({ errorMessage: (error as Error)?.message }, '[Client] update error');
      const err = this.handleError(error as Error, res);
      if (!res.headersSent) {
        res.status(err.status).json(ApiResponse.error(err.message));
      }
    }
  }

  /**
   * Update structured Birth Outcomes fields on phi_clients (Cloud SQL).
   * These fields are reportable and intentionally NOT free-text.
   *
   * Required:
   * - birth_outcomes_induction: boolean
   * - birth_outcomes_delivery_type: one of allowed options
   * - birth_outcomes_medications_used: string[] with allowed options (min 1)
   *
   * Authorization: admin or assigned doula (enforced by route + middleware).
   */
  async updateClientBirthOutcomes(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const readMode = process.env.SPLIT_DB_READ_MODE;

    if (readMode !== 'primary') {
      res.status(501).json(ApiResponse.error('Shadow disabled', 'SHADOW_DISABLED'));
      return;
    }

    if (!id) {
      res.status(400).json(ApiResponse.error('Missing client ID', 'VALIDATION_ERROR'));
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json(ApiResponse.error(`Invalid client ID format: ${id}`, 'VALIDATION_ERROR'));
      return;
    }

    const body = req.body as Record<string, unknown>;
    const induction = body.birth_outcomes_induction;
    const deliveryTypeRaw = body.birth_outcomes_delivery_type;
    const medsRaw = body.birth_outcomes_medications_used;

    if (typeof induction !== 'boolean') {
      res.status(400).json(ApiResponse.error('birth_outcomes_induction is required and must be a boolean', 'VALIDATION_ERROR'));
      return;
    }

    const deliveryType = typeof deliveryTypeRaw === 'string' ? deliveryTypeRaw.trim() : '';
    if (!deliveryType) {
      res.status(400).json(ApiResponse.error('birth_outcomes_delivery_type is required', 'VALIDATION_ERROR'));
      return;
    }
    if (!ClientController.BIRTH_OUTCOMES_DELIVERY_TYPES.has(deliveryType)) {
      res.status(400).json(ApiResponse.error('birth_outcomes_delivery_type must be one of the allowed options', 'VALIDATION_ERROR'));
      return;
    }

    if (!Array.isArray(medsRaw)) {
      res.status(400).json(ApiResponse.error('birth_outcomes_medications_used is required and must be an array', 'VALIDATION_ERROR'));
      return;
    }
    const meds = medsRaw
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter((v) => v.length > 0);
    if (meds.length === 0) {
      res.status(400).json(ApiResponse.error('birth_outcomes_medications_used must include at least one item', 'VALIDATION_ERROR'));
      return;
    }
    const invalidMeds = meds.filter((m) => !ClientController.BIRTH_OUTCOMES_MEDICATIONS.has(m));
    if (invalidMeds.length > 0) {
      res.status(400).json(ApiResponse.error('birth_outcomes_medications_used contains invalid option(s)', 'VALIDATION_ERROR'));
      return;
    }

    try {
      const clientExists = await this.clientRepository.getClientById?.(id) ?? null;
      if (!clientExists) {
        res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
        return;
      }

      const updated = await this.clientRepository.updateClientOperational?.(id, {
        birth_outcomes_induction: induction,
        birth_outcomes_delivery_type: deliveryType,
        birth_outcomes_medications_used: meds,
      }) ?? null;

      if (!updated) {
        res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
        return;
      }

      res.json(
        ApiResponse.success({
          birth_outcomes_induction: induction,
          birth_outcomes_delivery_type: deliveryType,
          birth_outcomes_medications_used: meds,
        })
      );
    } catch (error) {
      if (ClientController.isBirthOutcomesColumnMissing(error)) {
        if (!res.headersSent) {
          res.status(503).json(ApiResponse.error(
            'Birth outcomes columns are missing. Run migration: src/db/migrations/add_phi_clients_birth_outcomes_structured.sql',
            'SERVICE_UNAVAILABLE'
          ));
        }
        return;
      }
      const err = this.handleError(error as Error, res);
      if (!res.headersSent) {
        res.status(err.status).json(ApiResponse.error(err.message));
      }
    }
  }

  //
  // updateClientPhi()
  //
  // PHI-only update: routes ONLY PHI fields to sokana-private (via PHI Broker).
  // Rejects any non-PHI fields in the request body.
  //
  // Authorization: admin or assigned doula only
  //
  // PHI fields: first_name, last_name, email, phone_number, date_of_birth, due_date,
  //   address_line1, address, city, state, zip_code, country,
  //   health_history, health_notes, allergies, medications
  //
  // returns:
  //    Canonical: { success: true, message?: string }
  //
  async updateClientPhi(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    const { id } = req.params;
    const updateData = req.body;
    const readMode = process.env.SPLIT_DB_READ_MODE;

    // Require PRIMARY mode
    if (readMode !== 'primary') {
      res.status(501).json(ApiResponse.error('Shadow disabled', 'SHADOW_DISABLED'));
      return;
    }

    // Validate client ID
    if (!id) {
      res.status(400).json(ApiResponse.error('Missing client ID', 'VALIDATION_ERROR'));
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json(ApiResponse.error(`Invalid client ID format: ${id}`, 'VALIDATION_ERROR'));
      return;
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json(ApiResponse.error('No fields to update', 'VALIDATION_ERROR'));
      return;
    }

    try {
      // ── Step 0: Normalize + validate profile/address field lengths ──
      const normalizedRaw = normalizeClientPatch(updateData);
      const sanitized = this.sanitizeProfilePatchFields(normalizedRaw);
      if (!sanitized.ok) {
        res.status(400).json(ApiResponse.error((sanitized as { ok: false; message: string }).message, 'VALIDATION_ERROR'));
        return;
      }
      const normalized = sanitized.value;

      // ── Step 1: Split payload and validate that ONLY PHI fields are present ──
      const { operational, phi } = splitClientPatch(normalized);

      // Reject if any operational (non-PHI) fields are present
      if (Object.keys(operational).length > 0) {
        logger.warn({
          clientId: id,
          rejectedKeys: Object.keys(operational),
        }, '[Client] PHI endpoint received non-PHI fields');
        res.status(400).json(ApiResponse.error(
          `This endpoint only accepts PHI fields. Non-PHI fields not allowed: ${Object.keys(operational).join(', ')}`,
          'VALIDATION_ERROR'
        ));
        return;
      }

      // Ensure we have PHI fields to update
      if (Object.keys(phi).length === 0) {
        res.status(400).json(ApiResponse.error('No PHI fields to update', 'VALIDATION_ERROR'));
        return;
      }

      logger.info({
        clientId: id,
        phiKeyCount: Object.keys(phi).length,
      }, '[Client] PHI-only update payload validated');

      // ── Step 2: Authorization check ──
      const { canAccess, assignedClientIds } = await canAccessSensitive(req.user, id);
      const requester = {
        role: req.user?.role || '',
        userId: req.user?.id || '',
        assignedClientIds,
      };

      if (!canAccess) {
        logger.warn({ clientId: id, role: req.user?.role }, '[Client] unauthorized PHI update attempt');
        res.status(403).json(ApiResponse.error('Not authorized to update PHI fields', 'FORBIDDEN'));
        return;
      }

      // ── Step 3: Verify client exists ──
      const clientExists = await this.clientRepository.getClientById?.(id) ?? null;
      if (!clientExists) {
        res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
        return;
      }

      // ── Step 4: Write PHI fields to sokana-private (via broker) ──
      const phiWriteResult = await updateClientPhi(id, requester, phi);

      // ── Step 5: Write-through cache — keep identity fields in sync ──
      if (phi.first_name || phi.last_name || phi.email || phi.phone_number) {
        try {
          await this.clientRepository.updateIdentityCache?.(id, {
            first_name: phi.first_name,
            last_name: phi.last_name,
            email: phi.email,
            phone_number: phi.phone_number,
          });
        } catch {
          logger.warn({ clientId: id }, '[Client] identity cache write failed (non-blocking)');
        }
      }

      // ── Step 6: Source-of-truth instrumentation ──
      logger.info({
        clientId: id,
        sources: { sensitive: 'phiBroker' },
        keys: { sensitive: Object.keys(phiWriteResult ?? {}) },
      }, '[Client] PHI-only update response composition');

      res.json(ApiResponse.success({ message: 'PHI fields updated successfully' }));
    } catch (error) {
      logger.error({ errorMessage: (error as Error)?.message }, '[Client] PHI update error');
      const err = this.handleError(error as Error, res);
      if (!res.headersSent) {
        res.status(err.status).json(ApiResponse.error(err.message));
      }
    }
  }

  async getClientBilling(req: AuthRequest, res: Response): Promise<void> {
    const readMode = process.env.SPLIT_DB_READ_MODE;
    if (readMode !== 'primary') {
      res.status(501).json(ApiResponse.error('Shadow disabled', 'SHADOW_DISABLED'));
      return;
    }

    try {
      const resolved = await this.resolveBillingTargetClientId(req, req.params.id);
      if (!resolved.clientId) {
        res.status(resolved.status || 400).json(resolved.body || ApiResponse.error('Missing client ID', 'VALIDATION_ERROR'));
        return;
      }

      const access = await this.ensureBillingAccess(req, resolved.clientId);
      if (access.status) {
        res.status(access.status).json(access.body);
        return;
      }

      const billingRow = await this.clientRepository.getClientBilling?.(resolved.clientId)
        ?? await this.clientRepository.getClientById?.(resolved.clientId)
        ?? null;

      if (!billingRow) {
        res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
        return;
      }

      res.json(ApiResponse.success(this.normalizeBillingRow(billingRow)));
    } catch (error) {
      const err = this.handleError(error as Error, res);
      if (!res.headersSent) {
        res.status(err.status).json(ApiResponse.error(err.message));
      }
    }
  }

  async updateClientBilling(req: AuthRequest, res: Response): Promise<void> {
    const readMode = process.env.SPLIT_DB_READ_MODE;
    if (readMode !== 'primary') {
      res.status(501).json(ApiResponse.error('Shadow disabled', 'SHADOW_DISABLED'));
      return;
    }

    try {
      const resolved = await this.resolveBillingTargetClientId(req, req.params.id);
      if (!resolved.clientId) {
        res.status(resolved.status || 400).json(resolved.body || ApiResponse.error('Missing client ID', 'VALIDATION_ERROR'));
        return;
      }

      const access = await this.ensureBillingAccess(req, resolved.clientId);
      if (access.status) {
        res.status(access.status).json(access.body);
        return;
      }

      const billingPatch = this.extractBillingPatch(req.body || {});
      const validated = this.validateBillingPayload(billingPatch);
      if (!validated.value) {
        res.status(400).json(ApiResponse.error(validated.message || 'Invalid request body', 'VALIDATION_ERROR'));
        return;
      }

      if (validated.value.payment_method !== 'Self-Pay') {
        try {
          const hasInsuranceCard = await this.hasInsuranceCardDocument(resolved.clientId);
          if (!hasInsuranceCard) {
            res.status(400).json(
              ApiResponse.error(
                'An insurance card upload is required before saving insurance billing',
                'VALIDATION_ERROR'
              )
            );
            return;
          }
        } catch (error) {
          if (ClientController.isClientDocumentsTableMissing(error)) {
            res.status(503).json(
              ApiResponse.error(
                'Client documents feature not available until client_documents migration is applied',
                'SERVICE_UNAVAILABLE'
              )
            );
            return;
          }
          throw error;
        }
      }

      const updated = await this.clientRepository.updateClientBilling?.(resolved.clientId, validated.value)
        ?? await this.clientRepository.updateClientOperational?.(resolved.clientId, validated.value)
        ?? null;

      if (!updated) {
        res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
        return;
      }

      res.json(ApiResponse.success(this.normalizeBillingRow(updated)));
    } catch (error) {
      const err = this.handleError(error as Error, res);
      if (!res.headersSent) {
        res.status(err.status).json(ApiResponse.error(err.message));
      }
    }
  }

  //
  // createActivity()
  //
  // Creates a custom activity entry for a client
  //
  // returns:
  //    Canonical: { success: true, data: ActivityDTO }
  //
  async createActivity(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const readMode = process.env.SPLIT_DB_READ_MODE;

    // Require PRIMARY mode - shadow mode disabled
    if (readMode !== 'primary') {
      res.status(501).json(ApiResponse.error('Shadow disabled', 'SHADOW_DISABLED'));
      return;
    }

    if (!id) {
      res.status(400).json(ApiResponse.error('Missing client ID', 'VALIDATION_ERROR'));
      return;
    }

    // Canonical field names: activity_type, content; optional visible_to_client / visibleToClient and metadata
    const {
      activity_type,
      content,
      metadata,
      visible_to_client: visibleSnake,
      visibleToClient
    } = req.body;

    // Validate request body
    if (!activity_type || typeof activity_type !== 'string' || activity_type.trim() === '') {
      res.status(400).json(ApiResponse.error('Invalid request: activity_type is required and must be a non-empty string', 'VALIDATION_ERROR'));
      return;
    }

    if (!content || typeof content !== 'string' || content.trim() === '') {
      res.status(400).json(ApiResponse.error('Invalid request: content is required and must be a non-empty string', 'VALIDATION_ERROR'));
      return;
    }

    try {
      // Verify client exists (optional but preferred)
      const clientExists = await this.clientRepository.getClientById?.(id) ?? null;
      if (!clientExists) {
        res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
        return;
      }

      const userId = req.user?.id ?? '';
      const visible =
        visibleToClient === true ||
        visibleSnake === true ||
        visibleToClient === 'true' ||
        visibleSnake === 'true';
      const creatorName = `${req.user?.firstname || ''} ${req.user?.lastname || ''}`.trim() ||
        (req.user?.email || '').trim() ||
        'Staff member';
      const creatorRole = req.user?.role ? String(req.user.role) : 'staff';
      const incomingMetadata =
        metadata && typeof metadata === 'object' && !Array.isArray(metadata)
          ? { ...metadata }
          : {};

      const activity = await this.clientUseCase.createActivity(
        id,
        activity_type.trim(),
        content.trim(),
        {
          ...incomingMetadata,
          visibleToClient: visible,
          createdByName: creatorName,
          createdByRole: creatorRole,
        },
        userId
      );

      const dto = ActivityMapper.fromCloudActivity(activity);
      res.json(ApiResponse.success(dto));
    } catch (error) {
      // Graceful fallback: if client_activities table is missing, return 503 (not 500)
      const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
      const isTableMissing =
        message.includes('client_activities') &&
        (message.includes('could not find') || message.includes('schema cache') ||
         message.includes('does not exist'));
      if (isTableMissing) {
        logger.warn('[Client] client_activities table missing — cannot create activity');
        res.status(503).json(ApiResponse.error('Activities feature not available — table pending migration', 'SERVICE_UNAVAILABLE'));
        return;
      }
      const err = this.handleError(error as Error, res);
      res.status(err.status).json(ApiResponse.error(err.message));
    }
  }

  //
  // getClientActivities()
  //
  // Retrieves all activities/notes for a specific client
  //
  // returns:
  //    Canonical: { success: true, data: ActivityDTO[], meta: { count } }
  //
  async getClientActivities(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const readMode = process.env.SPLIT_DB_READ_MODE;
    this.setNoStore(res);

    // Require PRIMARY mode - shadow mode disabled
    if (readMode !== 'primary') {
      res.status(501).json(ApiResponse.error('Shadow disabled', 'SHADOW_DISABLED'));
      return;
    }

    if (!id) {
      res.status(400).json(ApiResponse.error('Missing client ID', 'VALIDATION_ERROR'));
      return;
    }

    let targetClientId = id;
    if (req.user?.role === 'client') {
      const ownClientId = await this.cloudSqlAssignmentService.getClientIdByAuthUserId(req.user.id);
      if (!ownClientId) {
        res.status(404).json(ApiResponse.error('Client profile not found', 'NOT_FOUND'));
        return;
      }
      const sentAuthUserId = targetClientId === req.user.id;
      if (!sentAuthUserId && targetClientId !== ownClientId) {
        res.status(403).json(ApiResponse.error('Forbidden: cannot access another client profile', 'FORBIDDEN'));
        return;
      }
      targetClientId = ownClientId;
    }

    try {
      const clientExists = await this.clientRepository.getClientById?.(targetClientId) ?? null;
      if (!clientExists) {
        res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
        return;
      }

      const activities = await this.clientUseCase.getClientActivities(targetClientId);
      const forViewer =
        req.user?.role === 'client'
          ? activities.filter((a) =>
              ActivityMapper.isVisibleToClientMetadata(
                a.metadata as Record<string, unknown> | undefined
              )
            )
          : activities;

      const dtos = forViewer.map((a) => ActivityMapper.fromCloudActivity(a));
      const enriched = await this.enrichCreatorNames(dtos);

      res.json(ApiResponse.list(enriched, enriched.length));
    } catch (error) {
      // Graceful fallback: if client_activities table is missing in schema, return empty list (no 500)
      const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
      const isTableMissing =
        (message.includes('client_activities') || message.includes('failed to fetch activities')) &&
        (message.includes('could not find the table') ||
          message.includes('schema cache') ||
          message.includes("relation") ||
          message.includes('does not exist'));
      if (isTableMissing) {
        console.error('Error: Failed to fetch activities (table may be missing). Returning empty list.');
        res.json(ApiResponse.list([], 0));
        return;
      }
      const err = this.handleError(error, res);
      res.status(err.status).json(ApiResponse.error(err.message));
    }
  }

  //
  // assignDoula()
  //
  // Assign a doula to a client
  //
  // returns:
  //    Assignment object
  //
  async assignDoula(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: clientId } = req.params;
      const { doulaId, role, services } = req.body;
      const assignmentStart = req.body?.assignmentStart ?? req.body?.assignment_start ?? req.body?.requestedStart ?? req.body?.requested_start;
      const assignmentEnd = req.body?.assignmentEnd ?? req.body?.assignment_end ?? req.body?.requestedEnd ?? req.body?.requested_end;

      // #region agent log
      fetch('http://127.0.0.1:7707/ingest/a673d138-3b5f-48fc-88e2-e0e1aadca9bb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0cc71c'},body:JSON.stringify({sessionId:'0cc71c',location:'clientController.ts:assignDoula',message:'assignDoula request body',data:{clientId,doulaId,role,servicesReceived:services,servicesType:typeof services,servicesIsArray:Array.isArray(services)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion

      if (!clientId || !doulaId) {
        res.status(400).json({ error: 'Missing clientId or doulaId' });
        return;
      }

      const normalizedServices = normalizeAssignmentServices(services);
      if (!normalizedServices) {
        // #region agent log
        fetch('http://127.0.0.1:7707/ingest/a673d138-3b5f-48fc-88e2-e0e1aadca9bb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0cc71c'},body:JSON.stringify({sessionId:'0cc71c',location:'clientController.ts:assignDoula',message:'services validation failed',data:{services,normalizedServices},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        res.status(400).json({
          error: `services is required and must contain one or more valid values: ${ASSIGNMENT_SERVICE_CATALOG.join(', ')}`,
        });
        return;
      }

      const normalizedRole = role === undefined ? undefined : normalizeDoulaAssignmentRole(role);
      if (role !== undefined && !normalizedRole) {
        res.status(400).json({ error: "Invalid role. Allowed values are 'primary' or 'backup'" });
        return;
      }

      const alreadyAssigned = await this.cloudSqlAssignmentService.assignmentExists(clientId, doulaId);
      if (alreadyAssigned) {
        res.status(409).json({ error: 'This doula is already assigned to this client' });
        return;
      }

      const currentAvailability = await this.doulaAvailabilityService.getCurrentAvailabilityStatus(doulaId);
      if (currentAvailability.status === 'unavailable') {
        const reason = currentAvailability.reason ? ` (${currentAvailability.reason})` : '';
        res.status(409).json({
          error: `Doula is currently unavailable${reason}. Unavailable from ${currentAvailability.startAt} to ${currentAvailability.endAt}.`,
        });
        return;
      }

      if ((assignmentStart && !assignmentEnd) || (!assignmentStart && assignmentEnd)) {
        res.status(400).json({ error: 'assignmentStart and assignmentEnd must be provided together' });
        return;
      }

      if (assignmentStart && assignmentEnd) {
        await this.doulaAvailabilityService.assertDoulaAvailableForPeriod(
          doulaId,
          new Date(assignmentStart),
          new Date(assignmentEnd)
        );
      }

      const assignment = await this.cloudSqlAssignmentService.assignDoula(
        clientId,
        doulaId,
        req.user?.id,
        undefined,
        normalizedRole,
        normalizedServices
      );

      res.json({
        success: true,
        assignment: {
          id: assignment.id,
          doulaId: assignment.doulaId,
          clientId: assignment.clientId,
          services: assignment.services,
          assignedAt: assignment.assignedAt,
          role: assignment.role,
          status: assignment.status
        }
      });
    } catch (error) {
      const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
      if (msg.includes('doula_assignments') && msg.includes('services') && msg.includes('does not exist')) {
        res.status(503).json({
          error:
            'Doula assignment services are not available yet. Run migration src/db/migrations/add_services_to_doula_assignments.sql',
          code: 'CLOUD_SQL_SCHEMA',
        });
        return;
      }
      if (error instanceof ConflictError || error instanceof ValidationError) {
        const status = error instanceof ConflictError ? 409 : 400;
        res.status(status).json({ error: error.message });
        return;
      }
      if (ClientController.isTableMissing(error, 'assignments')) {
        res.status(503).json({ error: 'Assignments feature not available — table pending migration' });
        return;
      }
      const err = this.handleError(error as Error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  //
  // unassignDoula()
  //
  // Unassign a doula from a client
  //
  // returns:
  //    Success message
  //
  async unassignDoula(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: clientId, doulaId } = req.params;

      if (!clientId || !doulaId) {
        res.status(400).json({ error: 'Missing clientId or doulaId' });
        return;
      }

      const removed = await this.cloudSqlAssignmentService.unassignDoula(clientId, doulaId);
      if (!removed) {
        res.status(404).json({ error: 'Assignment not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Doula unassigned successfully'
      });
    } catch (error) {
      const err = this.handleError(error as Error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  //
  // getAssignedDoulas()
  //
  // Get all doulas assigned to a specific client
  //
  // returns:
  //    Array of assigned doulas with their info
  //
  async getAssignedDoulas(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      let targetClientId = id;

      if (!targetClientId) {
        res.status(400).json({ error: 'Missing clientId' });
        return;
      }

      // Clients can only read their own assigned doulas.
      if (req.user?.role === 'client') {
        const ownClientId = await this.cloudSqlAssignmentService.getClientIdByAuthUserId(req.user.id);
        if (!ownClientId) {
          res.status(404).json({ error: 'Client profile not found' });
          return;
        }
        const sentAuthUserId = targetClientId === req.user.id;
        if (!sentAuthUserId && ownClientId !== targetClientId) {
          res.status(403).json({ error: 'Forbidden: cannot access other client assignments' });
          return;
        }
        targetClientId = ownClientId;
      }

      const doulas = await this.cloudSqlAssignmentService.getAssignedDoulas(targetClientId);
      const availabilityByDoulaId = await this.doulaAvailabilityService.getAvailabilityStatusForDoulas(
        doulas.map((doula) => doula.doulaId)
      );
      const includeSchedulingLink =
        req.user?.role === 'admin' ||
        (req.user?.role === 'client' && await this.doulaAvailabilityService.isClientInContractStage(targetClientId));
      const enrichedDoulas = doulas.map((assignment) => {
        const availability = availabilityByDoulaId.get(assignment.doulaId) ?? {
          status: 'available' as const,
          reason: null,
          startAt: null,
          endAt: null,
        };
        return {
          ...assignment,
          availabilityStatus: availability,
          doula: {
            ...assignment.doula,
            scheduling_url: includeSchedulingLink ? (assignment.doula.scheduling_url ?? null) : null,
          },
        };
      });

      res.json({
        success: true,
        doulas: enrichedDoulas
      });
    } catch (error) {
      if (ClientController.isTableMissing(error, 'assignments')) {
        res.json({ success: true, doulas: [] });
        return;
      }
      const err = this.handleError(error as Error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  async createDoulaBookingRequest(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id, doulaId } = req.params;
      let targetClientId = id;

      if (!targetClientId || !doulaId) {
        res.status(400).json({ error: 'Missing clientId or doulaId' });
        return;
      }

      if (req.user?.role === 'client') {
        const ownClientId = await this.cloudSqlAssignmentService.getClientIdByAuthUserId(req.user.id);
        if (!ownClientId) {
          res.status(404).json({ error: 'Client profile not found' });
          return;
        }
        const sentAuthUserId = targetClientId === req.user.id;
        if (!sentAuthUserId && ownClientId !== targetClientId) {
          res.status(403).json({ error: 'Forbidden: cannot create booking requests for another client' });
          return;
        }
        targetClientId = ownClientId;
      }

      const isAssigned = await this.cloudSqlAssignmentService.assignmentExists(targetClientId, doulaId);
      if (!isAssigned) {
        res.status(404).json({ error: 'Assigned doula not found for this client' });
        return;
      }

      const isInContractStage = await this.doulaAvailabilityService.isClientInContractStage(targetClientId);
      if (!isInContractStage) {
        res.status(403).json({ error: 'Booking is only available once the client is in the contract stage' });
        return;
      }

      const bookingRequest = await this.doulaAvailabilityService.createBookingRequest({
        clientId: targetClientId,
        doulaId,
        requestedBy: req.user?.id ?? null,
        startAt: req.body?.startAt ?? req.body?.start_at,
        endAt: req.body?.endAt ?? req.body?.end_at,
        notes: req.body?.notes ?? req.body?.note,
      });

      res.status(201).json({
        success: true,
        bookingRequest,
      });
    } catch (error) {
      if (error instanceof ConflictError || error instanceof ValidationError) {
        const status = error instanceof ConflictError ? 409 : 400;
        res.status(status).json({ error: error.message });
        return;
      }
      const err = this.handleError(error as Error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  /**
   * Detect if an error is due to a missing table (schema cache / relation does not exist).
   * Used for graceful degradation when tables haven't been migrated yet.
   */
  private static isTableMissing(error: unknown, tableName: string): boolean {
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
    return msg.includes(tableName) &&
      (msg.includes('could not find') || msg.includes('schema cache') ||
       msg.includes('does not exist') || msg.includes('relation'));
  }

  // Helper method to handle errors
  private handleError(
    error: Error,
    res: Response
  ): { status: number, message: string } {
    console.error('Error:', error.message);

    if (error instanceof ValidationError) {
      return { status: 400, message: error.message};
    } else if (error instanceof ConflictError) {
      return { status: 409, message: error.message};
    } else if (error instanceof AuthenticationError) {
      return { status: 401, message: error.message};
    } else if (error instanceof NotFoundError) {
      return { status: 404, message: error.message};
    } else if (error instanceof AuthorizationError) {
      return { status: 403, message: error.message};
    } else {
      return { status: 500, message: error.message};
    }
  }

  // Helper for returning basic summary of a client
  private mapToClientSummary(client: Client) {
    return {
      id: client.user.id.toString(),
      firstname: client.user.firstname,
      lastname: client.user.lastname,
      serviceNeeded: client.serviceNeeded,
      requestedAt: client.requestedAt,
      updatedAt: client.updatedAt,
      status: client.status,
    };
  }
}
