import { ValidationError } from "../domains/errors";
import {
  parseIntakeReferral,
} from '../constants/referralSource';
import {
  parseIntakeClientAgeYears,
  parseIntakePaymentMethod,
  parseIntakeProviderType,
  validateIntakeBirthPlace,
} from '../intake/requestSubmissionDto';
import {
  parseInsurancePolicyHolderDob,
  validatePrimaryInsuranceWhenRequired,
} from "../billing/expandedInsuranceBilling";
import { RequestForm } from '../entities/RequestForm';
import { RequestFormRepository } from "../repositories/requestFormRepository";
import {
    RequestFormData,
    RequestFormResponse,
    RequestStatus
} from "../types";

export class RequestFormService {
  private repository: RequestFormRepository;

  constructor(requestFormRepository: RequestFormRepository) {
    this.repository = requestFormRepository;
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

  async createRequest(formData: RequestFormData): Promise<RequestFormResponse> {
    // Validate required fields
    if (!formData.firstname || !formData.lastname) {
      throw new ValidationError("Missing required fields: first name and last name");
    }

    if (!formData.service_needed) {
      throw new ValidationError("Missing required field: service_needed");
    }

    if (!formData.email || !formData.email.includes('@')) {
      throw new ValidationError("Valid email is required");
    }

    if (!formData.phone_number) {
      throw new ValidationError("Phone number is required");
    }

    if (!formData.address || !formData.city || !formData.state || !formData.zip_code) {
      throw new ValidationError("Complete address is required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      throw new ValidationError("Invalid email format");
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(formData.phone_number.replace(/[\s\-\(\)]/g, ''))) {
      throw new ValidationError("Invalid phone number format");
    }

    // Validate zip code format
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (!zipRegex.test(formData.zip_code)) {
      throw new ValidationError("Invalid zip code format");
    }

    const referralTouched = ['referral_source', 'referral_name', 'referral_email', 'referral_source_other'].some(
      (k) => (formData as unknown as Record<string, unknown>)[k] !== undefined
    );
    if (referralTouched) {
      const r = parseIntakeReferral(formData as unknown as Record<string, unknown>);
      (formData as RequestFormData).referral_source = r.referral_source;
      (formData as RequestFormData).referral_name = r.referral_name ?? undefined;
      (formData as RequestFormData).referral_email = r.referral_email ?? undefined;
      (formData as RequestFormData).referral_source_other = r.referral_source_other ?? undefined;
    }

    // Save to repository (no userId)
    return await this.repository.saveData(formData);
  }

  async getUserRequests(userId: string): Promise<RequestFormResponse[]> {
    return await this.repository.getUserRequests(userId);
  }

  async getRequestById(requestId: string, userId: string): Promise<RequestFormResponse | null> {
    return await this.repository.getRequestById(requestId, userId);
  }

  async getAllRequests(): Promise<RequestFormResponse[]> {
    return await this.repository.getAllRequests();
  }

  async getRequestByIdAdmin(requestId: string): Promise<RequestFormResponse | null> {
    return await this.repository.getRequestByIdAdmin(requestId);
  }

  async updateRequestStatus(requestId: string, status: RequestStatus): Promise<RequestFormResponse> {
    // Validate status
    const validStatuses = Object.values(RequestStatus);
    if (!validStatuses.includes(status)) {
      throw new ValidationError("Invalid status value");
    }

    return await this.repository.updateRequestStatus(requestId, status);
  }

  // Updated method to handle all 10-step form fields
  async newForm(formData: any): Promise<RequestForm> {
    try {
      // Validate required fields
      if (!formData.firstname || !formData.lastname) {
        throw new ValidationError("Missing required fields: first name and last name");
      }

      if (!formData.service_needed) {
        throw new ValidationError("Missing required field: service_needed");
      }

      if (!formData.email || !formData.email.includes('@')) {
        throw new ValidationError("Valid email is required");
      }

      if (!formData.phone_number) {
        throw new ValidationError("Phone number is required");
      }

      if (!formData.address || !formData.city || !formData.state || !formData.zip_code) {
        throw new ValidationError("Complete address is required");
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new ValidationError("Invalid email format");
      }

      // Validate phone number format (basic validation)
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(formData.phone_number.replace(/[\s\-\(\)]/g, ''))) {
        throw new ValidationError("Invalid phone number format");
      }

      // Validate zip code format
      const zipRegex = /^\d{5}(-\d{4})?$/;
      if (!zipRegex.test(formData.zip_code)) {
        throw new ValidationError("Invalid zip code format");
      }

      const referral = parseIntakeReferral(formData as unknown as Record<string, unknown>);

      const ageResult = parseIntakeClientAgeYears(formData.age);
      if (ageResult.ok === false) {
        throw new ValidationError(ageResult.message);
      }

      const providerResult = parseIntakeProviderType(formData.provider_type);
      if (providerResult.ok === false) {
        throw new ValidationError(providerResult.message);
      }

      const birthPlace = validateIntakeBirthPlace(formData.birth_location, formData.birth_hospital);
      if (birthPlace.ok === false) {
        throw new ValidationError(birthPlace.message);
      }

      const paymentResult = parseIntakePaymentMethod(formData.payment_method);
      if (paymentResult.ok === false) {
        throw new ValidationError(paymentResult.message);
      }
      const paymentMethod = paymentResult.value;
      const requiresInsurance = paymentResult.requiresInsurance;

      const insuranceProvider = this.trimNullableString(formData.insurance_provider);
      const insuranceMemberId = this.trimNullableString(formData.insurance_member_id);
      const policyNumber = this.trimNullableString(formData.policy_number);
      const insurancePhoneNumber = this.trimNullableString(formData.insurance_phone_number);
      const hasSecondaryInsurance = this.normalizeOptionalBoolean(formData.has_secondary_insurance);
      const secondaryInsuranceProvider = this.trimNullableString(formData.secondary_insurance_provider);
      const secondaryInsuranceMemberId = this.trimNullableString(formData.secondary_insurance_member_id);
      const secondaryPolicyNumber = this.trimNullableString(formData.secondary_policy_number);
      const selfPayCardInfo = this.trimNullableString(formData.self_pay_card_info);
      const insurancePolicyHolderName = this.trimNullableString(formData.insurance_policy_holder_name);
      const parsedHolderDob = parseInsurancePolicyHolderDob(formData.insurance_policy_holder_dob);
      if (parsedHolderDob.ok === false) {
        throw new ValidationError(parsedHolderDob.message);
      }
      const insurancePolicyHolderDob = parsedHolderDob.value;
      const insurancePolicyHolderRelationship = this.trimNullableString(
        formData.insurance_policy_holder_relationship
      );
      const insurancePlanType = this.trimNullableString(formData.insurance_plan_type);

      if (requiresInsurance) {
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
          throw new ValidationError(primaryCheck.message);
        }
      }

      // Convert to RequestFormData format
      const newFormData: RequestFormData = {
        // Step 1: Client Details
        firstname: formData.firstname,
        lastname: formData.lastname,
        email: formData.email,
        phone_number: formData.phone_number,
        preferred_contact_method: formData.preferred_contact_method,  // Add this field
        preferred_name: formData.preferred_name,                       // Add this field
        pronouns: formData.pronouns,
        pronouns_other: formData.pronouns_other,
        intake_age_years: ageResult.value,

        // Step 2: Home Details
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,
        home_phone: formData.home_phone,
        home_type: formData.home_type,
        home_access: formData.home_access,
        pets: formData.pets,

        // Step 3: Family Members
        relationship_status: formData.relationship_status,
        first_name: formData.first_name,
        last_name: formData.last_name,
        middle_name: formData.middle_name,
        mobile_phone: formData.mobile_phone,
        work_phone: formData.work_phone,

        // Step 4: Referral
        referral_source: referral.referral_source,
        referral_name: referral.referral_name ?? undefined,
        referral_email: referral.referral_email ?? undefined,
        referral_source_other: referral.referral_source_other ?? undefined,

        // Step 5: Health History
        health_history: formData.health_history,
        allergies: formData.allergies,
        health_notes: formData.health_notes,

        // Step 6: Payment Info
        payment_method: paymentMethod,
        insurance_provider: requiresInsurance ? insuranceProvider ?? null : null,
        insurance_member_id: requiresInsurance ? insuranceMemberId ?? null : null,
        insurance_policy_holder_name: requiresInsurance ? insurancePolicyHolderName ?? null : null,
        insurance_policy_holder_dob: requiresInsurance ? insurancePolicyHolderDob ?? null : null,
        insurance_policy_holder_relationship: requiresInsurance
          ? insurancePolicyHolderRelationship ?? null
          : null,
        insurance_plan_type: requiresInsurance ? insurancePlanType ?? null : null,
        policy_number: requiresInsurance ? policyNumber ?? null : null,
        insurance_phone_number: requiresInsurance ? insurancePhoneNumber ?? null : null,
        has_secondary_insurance: requiresInsurance ? (hasSecondaryInsurance ?? null) : false,
        secondary_insurance_provider:
          requiresInsurance && hasSecondaryInsurance === true ? secondaryInsuranceProvider ?? null : null,
        secondary_insurance_member_id:
          requiresInsurance && hasSecondaryInsurance === true ? secondaryInsuranceMemberId ?? null : null,
        secondary_policy_number:
          requiresInsurance && hasSecondaryInsurance === true ? secondaryPolicyNumber ?? null : null,
        self_pay_card_info: !requiresInsurance ? selfPayCardInfo ?? null : null,
        annual_income: formData.annual_income,
        service_needed: formData.service_needed,
        service_specifics: formData.service_specifics,

        // Step 7: Pregnancy/Baby
        due_date: formData.due_date,
        birth_location: birthPlace.birth_location,
        birth_hospital: birthPlace.birth_hospital,
        number_of_babies: formData.number_of_babies,
        baby_name: formData.baby_name,
        provider_type: providerResult.value,
        pregnancy_number: formData.pregnancy_number,

        // Step 8: Past Pregnancies
        had_previous_pregnancies: formData.had_previous_pregnancies,
        previous_pregnancies_count: formData.previous_pregnancies_count,
        living_children_count: formData.living_children_count,
        past_pregnancy_experience: formData.past_pregnancy_experience,

        // Step 9: Services Interested
        services_interested: formData.services_interested,
        service_support_details: formData.service_support_details,

        // Step 10: Client Demographics
        race_ethnicity: formData.race_ethnicity,
        primary_language: formData.primary_language,
        client_age_range: formData.client_age_range,
        insurance: requiresInsurance ? formData.insurance ?? null : null,
        demographics_multi: formData.demographics_multi
      };

      // Save to repository (no userId)
      const response = await this.repository.saveData(newFormData);

      // Return the complete RequestForm with all fields
      const requestForm = new RequestForm(
        response.firstname,
        response.lastname,
        response.email,
        response.phone_number,
        response.service_needed,
        response.address,
        response.city,
        response.state,
        response.zip_code,
        response.pronouns,
        response.pronouns_other,
        response.children_expected,
        response.home_phone,
        response.home_type,
        response.home_access,
        response.pets,
        response.relationship_status,
        response.first_name,
        response.last_name,
        response.middle_name,
        response.mobile_phone,
        response.work_phone,
        response.referral_source,
        response.referral_name,
        response.referral_email,
        response.referral_source_other,
        response.health_history,
        response.allergies,
        response.health_notes,
        response.annual_income,
        response.service_specifics,
        response.due_date ? new Date(response.due_date) : undefined,
        response.birth_location,
        response.birth_hospital,
        response.number_of_babies,
        response.baby_name,
        response.provider_type,
        response.pregnancy_number,
        response.hospital,
        response.baby_sex,
        response.had_previous_pregnancies,
        response.previous_pregnancies_count,
        response.living_children_count,
        response.past_pregnancy_experience,
        response.services_interested,
        response.service_support_details,
        response.race_ethnicity,
        response.primary_language,
        response.client_age_range,
        response.insurance,
        response.payment_method,
        response.insurance_provider,
        response.insurance_member_id,
        response.policy_number,
        response.insurance_phone_number,
        response.has_secondary_insurance,
        response.secondary_insurance_provider,
        response.secondary_insurance_member_id,
        response.secondary_policy_number,
        response.self_pay_card_info,
        response.demographics_multi
      );

      requestForm.id = response.id; // Added: persist Supabase record id
      requestForm.status = response.status;
      requestForm.user_id = response.user_id;
      requestForm.created_at = response.created_at ? new Date(response.created_at) : undefined;
      requestForm.updated_at = response.updated_at ? new Date(response.updated_at) : undefined;

      return requestForm;
    } catch (error) {
      console.error("Error in newForm:", error);
      throw error;
    }
  }
}
