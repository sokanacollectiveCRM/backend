import { RequestForm } from '../../../entities/RequestForm';
import { HomeType, RequestFormResponse } from '../../../types';
import { normalizePublicIntakeSubmission } from '../domain/normalizePublicSubmission';
import { IntakeLeadRepository } from './ports';

export function mapIntakeResponseToRequestForm(
  response: RequestFormResponse
): RequestForm {
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
    (Array.isArray(response.home_type)
      ? response.home_type[0]
      : response.home_type) as HomeType | undefined,
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

  requestForm.id = response.id;
  requestForm.status = response.status;
  requestForm.user_id = response.user_id;
  requestForm.created_at = response.created_at
    ? new Date(response.created_at)
    : undefined;
  requestForm.updated_at = response.updated_at
    ? new Date(response.updated_at)
    : undefined;
  return requestForm;
}

/**
 * Application use case: validate/normalize public intake, persist lead, return entity for emails.
 */
export async function submitPublicRequestForm(
  rawBody: unknown,
  repository: IntakeLeadRepository
): Promise<RequestForm> {
  const normalized = normalizePublicIntakeSubmission(rawBody);
  const response = await repository.saveLead(normalized);
  return mapIntakeResponseToRequestForm(response);
}
