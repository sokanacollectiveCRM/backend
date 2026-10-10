import { randomUUID } from 'crypto';

import { SupabaseClient } from '@supabase/supabase-js';

import { getPool } from '../db/cloudSqlPool';
import {
  legacyHomeTypeVarchar,
  normalizeIntakeHomeTypes,
} from '../intake/requestSubmissionDto';
import { RequestFormData, RequestFormResponse, RequestStatus } from '../types';

function intakeAgeYearsFromForm(formData: RequestFormData): number | null {
  if (
    typeof formData.intake_age_years === 'number' &&
    Number.isFinite(formData.intake_age_years)
  ) {
    const n = Math.trunc(formData.intake_age_years);
    return n >= 1 && n <= 120 ? n : null;
  }
  const raw = (formData as unknown as Record<string, unknown>).age;
  if (typeof raw === 'number' && Number.isInteger(raw)) {
    return raw >= 1 && raw <= 120 ? raw : null;
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (/^\d+$/.test(t)) {
      const n = parseInt(t, 10);
      return n >= 1 && n <= 120 ? n : null;
    }
  }
  return null;
}

function stringifyEnumish(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export class RequestFormRepository {
  private supabaseClient: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabaseClient = supabaseClient;
  }

  private normalizeBillingFields(
    formData: RequestFormData
  ): Pick<
    RequestFormData,
    | 'insurance'
    | 'payment_method'
    | 'insurance_provider'
    | 'insurance_member_id'
    | 'insurance_policy_holder_name'
    | 'insurance_policy_holder_dob'
    | 'insurance_policy_holder_relationship'
    | 'insurance_plan_type'
    | 'policy_number'
    | 'insurance_phone_number'
    | 'has_secondary_insurance'
    | 'secondary_insurance_provider'
    | 'secondary_insurance_member_id'
    | 'secondary_policy_number'
    | 'self_pay_card_info'
  > {
    const paymentMethod =
      typeof formData.payment_method === 'string'
        ? formData.payment_method.trim()
        : (formData.payment_method ?? null);
    const isSelfPay =
      paymentMethod === 'Self-Pay' ||
      paymentMethod === 'Self-Pay, Sliding Scale Available';
    const skipsInsurance =
      isSelfPay ||
      paymentMethod === 'I am unable to pay / Full Support Option' ||
      paymentMethod === 'Not sure / Need help figuring this out';
    const hasSecondaryInsurance =
      !skipsInsurance && formData.has_secondary_insurance === true;

    return {
      payment_method: paymentMethod ?? null,
      insurance: skipsInsurance ? null : (formData.insurance ?? null),
      insurance_provider: skipsInsurance
        ? null
        : (formData.insurance_provider ?? null),
      insurance_member_id: skipsInsurance
        ? null
        : (formData.insurance_member_id ?? null),
      insurance_policy_holder_name: skipsInsurance
        ? null
        : (formData.insurance_policy_holder_name ?? null),
      insurance_policy_holder_dob: skipsInsurance
        ? null
        : (formData.insurance_policy_holder_dob ?? null),
      insurance_policy_holder_relationship: skipsInsurance
        ? null
        : (formData.insurance_policy_holder_relationship ?? null),
      insurance_plan_type: skipsInsurance
        ? null
        : (formData.insurance_plan_type ?? null),
      policy_number: skipsInsurance ? null : (formData.policy_number ?? null),
      insurance_phone_number: skipsInsurance
        ? null
        : (formData.insurance_phone_number ?? null),
      has_secondary_insurance: skipsInsurance
        ? false
        : (formData.has_secondary_insurance ?? null),
      secondary_insurance_provider:
        skipsInsurance || !hasSecondaryInsurance
          ? null
          : (formData.secondary_insurance_provider ?? null),
      secondary_insurance_member_id:
        skipsInsurance || !hasSecondaryInsurance
          ? null
          : (formData.secondary_insurance_member_id ?? null),
      secondary_policy_number:
        skipsInsurance || !hasSecondaryInsurance
          ? null
          : (formData.secondary_policy_number ?? null),
      self_pay_card_info: null,
    };
  }

  async saveData(
    formData: RequestFormData,
    extras?: {
      intakeFormVersion?: number | null;
      customAnswers?: Record<string, unknown> | null;
      isTest?: boolean;
    }
  ): Promise<RequestFormResponse> {
    try {
      const id = randomUUID();
      const now = new Date().toISOString();
      const dueDate = formData.due_date
        ? new Date(formData.due_date).toISOString().slice(0, 10)
        : null;
      const billingFields = this.normalizeBillingFields(formData);

      const referralName =
        typeof formData.referral_name === 'string' &&
        formData.referral_name.trim().length > 0
          ? formData.referral_name.trim()
          : null;
      const referralEmail =
        typeof formData.referral_email === 'string' &&
        formData.referral_email.trim().length > 0
          ? formData.referral_email.trim()
          : null;
      const referralOther =
        typeof formData.referral_source_other === 'string' &&
        formData.referral_source_other.trim().length > 0
          ? formData.referral_source_other.trim()
          : null;

      const insertSql = `
                INSERT INTO phi_clients (
                    id,
                    client_number,
                    first_name,
                    last_name,
                    email,
                    phone,
                    address_line1,
                    city,
                    state,
                    zip_code,
                    birth_location,
                    birth_hospital,
                    provider_type,
                    pronouns,
                    pronouns_other,
                    preferred_contact_method,
                    preferred_name,
                    pets,
                    home_access,
                    home_types,
                    home_type_other,
                    home_adults_count,
                    home_youth_count,
                    service_support_details,
                    services_interested,
                    intake_age_years,
                    primary_language,
                    children_expected,
                    due_date,
                    health_history,
                    allergies,
                    health_notes,
                    annual_income,
                    pregnancy_number,
                    had_previous_pregnancies,
                    previous_pregnancies_count,
                    living_children_count,
                    past_pregnancy_experience,
                    baby_sex,
                    baby_name,
                    number_of_babies,
                    race_ethnicity,
                    client_age_range,
                    referral_source,
                    referral_name,
                    referral_email,
                    referral_source_other,
                    insurance,
                    payment_method,
                    insurance_provider,
                    insurance_member_id,
                    insurance_policy_holder_name,
                    insurance_policy_holder_dob,
                    insurance_policy_holder_relationship,
                    insurance_plan_type,
                    policy_number,
                    insurance_phone_number,
                    has_secondary_insurance,
                    secondary_insurance_provider,
                    secondary_insurance_member_id,
                    secondary_policy_number,
                    self_pay_card_info,
                    status,
                    service_needed,
                    portal_status,
                    requested_at,
                    intake_form_version,
                    custom_answers,
                    is_test
                ) VALUES (
                    $1,
                    'CL-' || LPAD(nextval('phi_clients_client_number_seq')::text, 5, '0'),
                    $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                    $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
                    $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46,
                    $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63, $64, $65,
                    $66, $67::jsonb, $68
                )
                RETURNING client_number
            `;

      const servicesInterested =
        Array.isArray(formData.services_interested) &&
        formData.services_interested.length > 0
          ? formData.services_interested.map((s) => String(s))
          : null;

      const homeTypes =
        formData.home_types ??
        normalizeIntakeHomeTypes(
          (formData as unknown as Record<string, unknown>).home_type
        );
      const homeTypeLegacy = legacyHomeTypeVarchar(homeTypes);

      const result = await getPool().query<{ client_number: string }>(
        insertSql,
        [
          id,
          formData.firstname,
          formData.lastname,
          formData.email,
          formData.phone_number,
          formData.address,
          formData.city ?? null,
          formData.state ?? null,
          formData.zip_code ?? null,
          formData.birth_location ?? null,
          formData.birth_hospital ?? null,
          stringifyEnumish(formData.provider_type),
          stringifyEnumish(formData.pronouns),
          formData.pronouns_other?.trim() || null,
          formData.preferred_contact_method?.trim() || null,
          formData.preferred_name?.trim() || null,
          formData.pets?.trim() || null,
          formData.home_access?.trim() || null,
          homeTypes,
          formData.home_type_other?.trim() || null,
          formData.home_adults_count?.trim() || null,
          formData.home_youth_count?.trim() || null,
          formData.service_support_details?.trim() || null,
          servicesInterested,
          intakeAgeYearsFromForm(formData),
          formData.primary_language?.trim() || null,
          formData.children_expected?.trim() || null,
          dueDate,
          formData.health_history || null,
          formData.allergies || null,
          formData.health_notes || null,
          formData.annual_income || null,
          formData.pregnancy_number ?? null,
          formData.had_previous_pregnancies ?? null,
          formData.previous_pregnancies_count ?? null,
          formData.living_children_count ?? null,
          formData.past_pregnancy_experience || null,
          formData.baby_sex || null,
          formData.baby_name || null,
          formData.number_of_babies ?? null,
          formData.race_ethnicity || null,
          formData.client_age_range || null,
          formData.referral_source ?? null,
          referralName,
          referralEmail,
          referralOther,
          billingFields.insurance,
          billingFields.payment_method,
          billingFields.insurance_provider,
          billingFields.insurance_member_id,
          billingFields.insurance_policy_holder_name,
          billingFields.insurance_policy_holder_dob,
          billingFields.insurance_policy_holder_relationship,
          billingFields.insurance_plan_type,
          billingFields.policy_number,
          billingFields.insurance_phone_number,
          billingFields.has_secondary_insurance,
          billingFields.secondary_insurance_provider,
          billingFields.secondary_insurance_member_id,
          billingFields.secondary_policy_number,
          billingFields.self_pay_card_info,
          'lead',
          formData.service_needed,
          'not_invited',
          now,
          extras?.intakeFormVersion ?? null,
          extras?.customAnswers ? JSON.stringify(extras.customAnswers) : null,
          extras?.isTest === true,
        ]
      );
      const clientNumber = result.rows[0]?.client_number ?? null;

      const response: RequestFormResponse = {
        id,
        client_number: clientNumber ?? undefined,
        status: 'pending' as RequestStatus,
        requested: now,
        created_at: now,
        updated_at: now,
        user_id: '',
        firstname: formData.firstname,
        lastname: formData.lastname,
        email: formData.email,
        phone_number: formData.phone_number,
        pronouns: formData.pronouns,
        pronouns_other: formData.pronouns_other,
        preferred_contact_method: formData.preferred_contact_method,
        preferred_name: formData.preferred_name,
        children_expected: formData.children_expected,
        intake_age_years: intakeAgeYearsFromForm(formData) ?? undefined,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,
        home_phone: formData.home_phone,
        home_type: homeTypeLegacy ?? formData.home_type,
        home_types: homeTypes ?? undefined,
        home_type_other: formData.home_type_other,
        home_access: formData.home_access,
        home_adults_count: formData.home_adults_count,
        home_youth_count: formData.home_youth_count,
        pets: formData.pets,
        relationship_status: formData.relationship_status,
        first_name: formData.first_name,
        last_name: formData.last_name,
        middle_name: formData.middle_name,
        mobile_phone: formData.mobile_phone,
        work_phone: formData.work_phone,
        referral_source: formData.referral_source,
        referral_name: referralName ?? undefined,
        referral_email: referralEmail ?? undefined,
        referral_source_other: referralOther ?? undefined,
        health_history: formData.health_history,
        allergies: formData.allergies,
        health_notes: formData.health_notes,
        annual_income: formData.annual_income,
        service_needed: formData.service_needed,
        service_specifics: formData.service_specifics,
        due_date: dueDate || undefined,
        birth_location: formData.birth_location,
        birth_hospital: formData.birth_hospital,
        number_of_babies: formData.number_of_babies,
        baby_name: formData.baby_name,
        provider_type: formData.provider_type,
        pregnancy_number: formData.pregnancy_number,
        hospital: formData.hospital,
        baby_sex: formData.baby_sex,
        had_previous_pregnancies: formData.had_previous_pregnancies,
        previous_pregnancies_count: formData.previous_pregnancies_count,
        living_children_count: formData.living_children_count,
        past_pregnancy_experience: formData.past_pregnancy_experience,
        services_interested: formData.services_interested,
        service_support_details: formData.service_support_details,
        race_ethnicity: formData.race_ethnicity,
        primary_language: formData.primary_language,
        client_age_range: formData.client_age_range,
        insurance: billingFields.insurance,
        payment_method: billingFields.payment_method,
        insurance_provider: billingFields.insurance_provider,
        insurance_member_id: billingFields.insurance_member_id,
        insurance_policy_holder_name:
          billingFields.insurance_policy_holder_name,
        insurance_policy_holder_dob: billingFields.insurance_policy_holder_dob,
        insurance_policy_holder_relationship:
          billingFields.insurance_policy_holder_relationship,
        insurance_plan_type: billingFields.insurance_plan_type,
        policy_number: billingFields.policy_number,
        insurance_phone_number: billingFields.insurance_phone_number,
        has_secondary_insurance: billingFields.has_secondary_insurance,
        secondary_insurance_provider:
          billingFields.secondary_insurance_provider,
        secondary_insurance_member_id:
          billingFields.secondary_insurance_member_id,
        secondary_policy_number: billingFields.secondary_policy_number,
        self_pay_card_info: billingFields.self_pay_card_info,
        demographics_multi: formData.demographics_multi,
      };

      console.log('Request form saved successfully (Cloud SQL):', { id });
      return response;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  private mapRequestRow(row: {
    id: string;
    status: string | null;
    request_status: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    service_needed: string | null;
    user_id: string | null;
    requested_at: Date | string | null;
    created_at: Date | string | null;
    updated_at: Date | string | null;
    client_number: string | null;
  }): RequestFormResponse {
    const created = row.created_at
      ? new Date(row.created_at).toISOString()
      : new Date().toISOString();
    const workflow =
      row.request_status ||
      (row.status === 'lead' ? 'pending' : row.status) ||
      'pending';
    return {
      id: row.id,
      client_number: row.client_number ?? undefined,
      status: workflow as RequestStatus,
      requested: row.requested_at
        ? new Date(row.requested_at).toISOString()
        : created,
      created_at: created,
      updated_at: row.updated_at
        ? new Date(row.updated_at).toISOString()
        : created,
      user_id: row.user_id ?? '',
      firstname: row.first_name ?? '',
      lastname: row.last_name ?? '',
      email: row.email ?? '',
      phone_number: row.phone ?? '',
      address: row.address_line1 ?? '',
      city: (row.city ?? '') as RequestFormResponse['city'],
      state: (row.state ?? '') as RequestFormResponse['state'],
      zip_code: row.zip_code ?? '',
      service_needed: (row.service_needed ??
        '') as RequestFormResponse['service_needed'],
    };
  }

  private readonly requestSelect = `
    id, status, request_status, first_name, last_name, email, phone,
    address_line1, city, state, zip_code, service_needed, user_id,
    requested_at, created_at, updated_at, client_number
  `;

  async getUserRequests(userId: string): Promise<RequestFormResponse[]> {
    const { rows } = await getPool().query(
      `SELECT ${this.requestSelect}
       FROM public.phi_clients
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map((row) => this.mapRequestRow(row));
  }

  async getRequestById(
    requestId: string,
    userId: string
  ): Promise<RequestFormResponse | null> {
    const { rows } = await getPool().query(
      `SELECT ${this.requestSelect}
       FROM public.phi_clients
       WHERE id = $1::uuid AND user_id = $2
       LIMIT 1`,
      [requestId, userId]
    );
    return rows[0] ? this.mapRequestRow(rows[0]) : null;
  }

  async getAllRequests(): Promise<RequestFormResponse[]> {
    const { rows } = await getPool().query(
      `SELECT ${this.requestSelect}
       FROM public.phi_clients
       ORDER BY created_at DESC`
    );
    return rows.map((row) => this.mapRequestRow(row));
  }

  async getRequestByIdAdmin(
    requestId: string
  ): Promise<RequestFormResponse | null> {
    const { rows } = await getPool().query(
      `SELECT ${this.requestSelect}
       FROM public.phi_clients
       WHERE id = $1::uuid
       LIMIT 1`,
      [requestId]
    );
    return rows[0] ? this.mapRequestRow(rows[0]) : null;
  }

  async updateRequestStatus(
    requestId: string,
    status: RequestStatus
  ): Promise<RequestFormResponse> {
    const { rows } = await getPool().query(
      `UPDATE public.phi_clients
       SET request_status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid
       RETURNING ${this.requestSelect}`,
      [requestId, status]
    );
    if (!rows[0]) {
      throw new Error('Database update failed: request not found');
    }
    return this.mapRequestRow(rows[0]);
  }
}
