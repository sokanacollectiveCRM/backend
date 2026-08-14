import { logger } from '../common/utils/logger';
import { parseIntakeReferral } from '../constants/referralSource';
import { ValidationError } from '../domains/errors';
import { RequestForm } from '../entities/RequestForm';
import {
  LegacyRequestFormRepositoryAdapter,
  diffIntakeShadowSlices,
  mapIntakeResponseToRequestForm,
  normalizePublicIntakeSubmission,
  pickIntakeShadowCompareSlice,
  submitPublicRequestForm,
} from '../features/intake';
import { RequestFormRepository } from '../repositories/requestFormRepository';
import { RequestFormData, RequestFormResponse, RequestStatus } from '../types';

function intakeUseFeaturePackage(): boolean {
  const raw = process.env.INTAKE_USE_FEATURE_PACKAGE;
  return raw === 'true' || raw === '1';
}

function intakeShadowCompare(): boolean {
  const raw = process.env.INTAKE_SHADOW_COMPARE;
  return raw === 'true' || raw === '1';
}

export class RequestFormService {
  private repository: RequestFormRepository;
  private intakeAdapter: LegacyRequestFormRepositoryAdapter;

  constructor(requestFormRepository: RequestFormRepository) {
    this.repository = requestFormRepository;
    this.intakeAdapter = new LegacyRequestFormRepositoryAdapter(
      requestFormRepository
    );
  }

  async createRequest(formData: RequestFormData): Promise<RequestFormResponse> {
    // Validate required fields
    if (!formData.firstname || !formData.lastname) {
      throw new ValidationError(
        'Missing required fields: first name and last name'
      );
    }

    if (!formData.service_needed) {
      throw new ValidationError('Missing required field: service_needed');
    }

    if (!formData.email || !formData.email.includes('@')) {
      throw new ValidationError('Valid email is required');
    }

    if (!formData.phone_number) {
      throw new ValidationError('Phone number is required');
    }

    if (
      !formData.address ||
      !formData.city ||
      !formData.state ||
      !formData.zip_code
    ) {
      throw new ValidationError('Complete address is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      throw new ValidationError('Invalid email format');
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(formData.phone_number.replace(/[\s\-\(\)]/g, ''))) {
      throw new ValidationError('Invalid phone number format');
    }

    // Validate zip code format
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (!zipRegex.test(formData.zip_code)) {
      throw new ValidationError('Invalid zip code format');
    }

    const referralTouched = [
      'referral_source',
      'referral_name',
      'referral_email',
      'referral_source_other',
    ].some(
      (k) => (formData as unknown as Record<string, unknown>)[k] !== undefined
    );
    if (referralTouched) {
      const r = parseIntakeReferral(
        formData as unknown as Record<string, unknown>
      );
      (formData as RequestFormData).referral_source = r.referral_source;
      (formData as RequestFormData).referral_name =
        r.referral_name ?? undefined;
      (formData as RequestFormData).referral_email =
        r.referral_email ?? undefined;
      (formData as RequestFormData).referral_source_other =
        r.referral_source_other ?? undefined;
    }

    // Save to repository (no userId)
    return await this.repository.saveData(formData);
  }

  async getUserRequests(userId: string): Promise<RequestFormResponse[]> {
    return await this.repository.getUserRequests(userId);
  }

  async getRequestById(
    requestId: string,
    userId: string
  ): Promise<RequestFormResponse | null> {
    return await this.repository.getRequestById(requestId, userId);
  }

  async getAllRequests(): Promise<RequestFormResponse[]> {
    return await this.repository.getAllRequests();
  }

  async getRequestByIdAdmin(
    requestId: string
  ): Promise<RequestFormResponse | null> {
    return await this.repository.getRequestByIdAdmin(requestId);
  }

  async updateRequestStatus(
    requestId: string,
    status: RequestStatus
  ): Promise<RequestFormResponse> {
    // Validate status
    const validStatuses = Object.values(RequestStatus);
    if (!validStatuses.includes(status)) {
      throw new ValidationError('Invalid status value');
    }

    return await this.repository.updateRequestStatus(requestId, status);
  }

  /**
   * Public CRM intake path.
   * - Default: domain normalize + legacy repository write (façade parity).
   * - `INTAKE_USE_FEATURE_PACKAGE=true`: application use case write path.
   * - `INTAKE_SHADOW_COMPARE=true`: compare normalize slices (no PHI dump) while serving active write path.
   */
  async newForm(formData: any): Promise<RequestForm> {
    try {
      const normalized = normalizePublicIntakeSubmission(formData);

      if (intakeShadowCompare()) {
        try {
          const stubResponse = {
            id: 'shadow-compare',
            firstname: normalized.firstname,
            lastname: normalized.lastname,
            email: normalized.email,
            phone_number: normalized.phone_number,
            service_needed: normalized.service_needed,
            address: normalized.address,
            city: normalized.city,
            state: normalized.state,
            zip_code: normalized.zip_code,
            payment_method: normalized.payment_method,
            birth_location: normalized.birth_location,
            birth_hospital: normalized.birth_hospital,
            provider_type: normalized.provider_type,
            referral_source: normalized.referral_source,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any;

          const viaLegacyMap = mapIntakeResponseToRequestForm(stubResponse);
          const viaUseCase = await submitPublicRequestForm(formData, {
            saveLead: async () => stubResponse,
          });

          const diffs = diffIntakeShadowSlices(
            pickIntakeShadowCompareSlice({
              ...normalized,
              firstname: viaLegacyMap.firstname,
              lastname: viaLegacyMap.lastname,
              email: viaLegacyMap.email,
              payment_method: viaLegacyMap.payment_method,
              birth_location: viaLegacyMap.birth_location,
              birth_hospital: viaLegacyMap.birth_hospital,
              provider_type: viaLegacyMap.provider_type,
              referral_source: viaLegacyMap.referral_source,
              intake_age_years: normalized.intake_age_years,
              home_adults_count: normalized.home_adults_count,
              home_youth_count: normalized.home_youth_count,
              has_secondary_insurance: normalized.has_secondary_insurance,
              service_needed: viaLegacyMap.service_needed,
            } as any),
            pickIntakeShadowCompareSlice({
              ...normalized,
              firstname: viaUseCase.firstname,
              lastname: viaUseCase.lastname,
              email: viaUseCase.email,
              payment_method: viaUseCase.payment_method,
              birth_location: viaUseCase.birth_location,
              birth_hospital: viaUseCase.birth_hospital,
              provider_type: viaUseCase.provider_type,
              referral_source: viaUseCase.referral_source,
              intake_age_years: normalized.intake_age_years,
              home_adults_count: normalized.home_adults_count,
              home_youth_count: normalized.home_youth_count,
              has_secondary_insurance: normalized.has_secondary_insurance,
              service_needed: viaUseCase.service_needed,
            } as any)
          );

          logger.info(
            {
              service: 'intake',
              operation: 'shadow_compare',
              diffCount: diffs.length,
              diffKeys: diffs,
              useFeaturePackage: intakeUseFeaturePackage(),
            },
            'Intake shadow compare completed'
          );
        } catch (shadowError) {
          logger.warn(
            {
              service: 'intake',
              operation: 'shadow_compare',
              errorCode:
                shadowError instanceof Error
                  ? shadowError.name
                  : 'SHADOW_FAILURE',
            },
            'Intake shadow compare failed'
          );
        }
      }

      if (intakeUseFeaturePackage()) {
        return submitPublicRequestForm(formData, this.intakeAdapter);
      }

      const response = await this.repository.saveData(normalized);
      return mapIntakeResponseToRequestForm(response);
    } catch (error) {
      console.error('Error in newForm:', error);
      throw error;
    }
  }
}
