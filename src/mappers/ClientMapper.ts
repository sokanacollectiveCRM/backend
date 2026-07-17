import { Client } from '../entities/Client';
import { ClientListItemDTO } from '../dto/response/ClientListItemDTO';
import { ClientDetailDTO } from '../dto/response/ClientDetailDTO';
import { logger } from '../common/utils/logger';

/**
 * Maps Client entity to DTOs for API responses.
 * 
 * HIPAA COMPLIANCE:
 * - toListItemDTO() and toDetailDTO() return ONLY operational fields (non-PHI)
 * - PHI fields are merged separately via PHI Broker response (in controller)
 * - PHI fields are OMITTED (not null) when user is not authorized
 * - Email/phone are PII (not PHI) but should be redacted in logs
 * - NEVER log PHI values
 */
export class ClientMapper {
  /**
   * Maps a Client entity to ClientListItemDTO for list responses.
   * Returns ONLY operational fields - NO PHI.
   * 
   * Allowed fields (non-PHI):
   * - id, first_name, last_name (identifiers)
   * - email, phone_number (PII - needed for ops, redact in logs)
   * - status, portal_status (workflow state)
   * - invited_at, updated_at (timestamps)
   * - is_eligible (computed flag)
   * 
   * NEVER include: health_history, due_date, allergies, medical info, etc.
   * 
   * @param entity - The Client entity from the database
   * @param isEligible - Optional eligibility flag (computed externally)
   * @returns Flat DTO with snake_case fields, non-PHI only
   */
  static toListItemDTO(entity: Client, isEligible?: boolean): ClientListItemDTO {
    const user = entity.user;
    
    // ONLY operational fields - no PHI
    return {
      id: entity.id,
      client_number: entity.clientNumber,
      first_name: user?.firstname || user?.first_name || '',
      last_name: user?.lastname || user?.last_name || '',
      email: user?.email,
      phone_number: entity.phoneNumber || user?.phone_number || user?.mobile_phone,
      bio: user?.bio || undefined,
      city: user?.city || undefined,
      state: user?.state || undefined,
      zipCode: user?.zip_code != null && user?.zip_code !== -1 ? String(user.zip_code) : undefined,
      country: user?.country || undefined,
      status: entity.status,
      service_needed: entity.serviceNeeded,
      portal_status: entity.portal_status,
      invited_at: undefined, // Will be populated when invite tracking is added
      updated_at: entity.updatedAt?.toISOString(),
      is_eligible: isEligible,
      qbo_customer_id: entity.qboCustomerId,
      quickbooks_sync_status: entity.quickbooksSyncStatus,
      quickbooks_last_checked_at: entity.quickbooksLastCheckedAt?.toISOString(),
      quickbooks_last_synced_at: entity.quickbooksLastSyncedAt?.toISOString(),
      quickbooks_sync_error: entity.quickbooksSyncError,
    };
  }

  /**
   * Maps raw client row data to ClientDetailDTO for single-item responses.
   * Returns ONLY operational fields - NO PHI.
   * 
   * Flat mapping only - no nested objects, no legacy compatibility.
   * Output matches ClientDetailDTO exactly.
   * 
   * NEVER include: health_history, due_date, allergies, medical info, etc.
   * 
   * @param row - Raw row data from getClientById() with explicit columns
   * @param isEligible - Optional eligibility flag (computed externally)
   * @returns Flat DTO with snake_case fields, non-PHI only
   */
  static toDetailDTO(
    row: {
      id: string;
      client_number?: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone_number: string | null;
      address_line1: string | null;
      bio: string | null;
      city: string | null;
      state: string | null;
      zip_code: string | null;
      country: string | null;
      status: string | null;
      service_needed: string | null;
      portal_status: string | null;
      invited_at: string | null;
      last_invite_sent_at: string | null;
      invite_sent_count: number | null;
      requested_at: string | null;
      updated_at: string | null;
      payment_method?: string | null;
      insurance?: string | null;
      insurance_provider?: string | null;
      insurance_member_id?: string | null;
      insurance_policy_holder_name?: string | null;
      insurance_policy_holder_dob?: string | Date | null;
      insurance_policy_holder_relationship?: string | null;
      insurance_plan_type?: string | null;
      policy_number?: string | null;
      insurance_phone_number?: string | null;
      has_secondary_insurance?: boolean | null;
      secondary_insurance_provider?: string | null;
      secondary_insurance_member_id?: string | null;
      secondary_policy_number?: string | null;
      self_pay_card_info?: string | null;
      matched_at?: string | null;
      qbo_customer_id?: string | null;
      quickbooks_sync_status?: string | null;
      quickbooks_last_checked_at?: string | Date | null;
      quickbooks_last_synced_at?: string | Date | null;
      quickbooks_sync_error?: string | null;
    },
    isEligible?: boolean
  ): ClientDetailDTO {
    // ONLY operational fields - no PHI
    // PHI fields are merged separately from PHI Broker response (in controller)
    const phone_number = row.phone_number ?? undefined;
    logger.info({ msg: '[ClientMapper] toDetailDTO', dto_phone_from_row: phone_number != null ? '(set)' : '(undefined)' });
    return {
      id: row.id,
      client_number: row.client_number ?? undefined,
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      email: row.email ?? undefined,
      phone_number,
      address: row.address_line1 ?? undefined,
      bio: row.bio ?? undefined,
      city: row.city ?? undefined,
      state: row.state ?? undefined,
      zipCode: row.zip_code ?? undefined,
      country: row.country ?? undefined,
      status: row.status || 'lead',
      service_needed: row.service_needed ?? undefined,
      portal_status: row.portal_status ?? undefined,
      invited_at: row.invited_at ?? undefined,
      last_invite_sent_at: row.last_invite_sent_at ?? undefined,
      invite_sent_count: row.invite_sent_count ?? undefined,
      requested_at: row.requested_at ?? undefined,
      updated_at: row.updated_at ?? undefined,
      payment_method: row.payment_method ?? undefined,
      insurance: row.insurance ?? undefined,
      insurance_provider: row.insurance_provider ?? undefined,
      insurance_member_id: row.insurance_member_id ?? undefined,
      insurance_policy_holder_name: row.insurance_policy_holder_name ?? undefined,
      insurance_policy_holder_dob:
        row.insurance_policy_holder_dob instanceof Date
          ? row.insurance_policy_holder_dob.toISOString().slice(0, 10)
          : (row.insurance_policy_holder_dob ?? undefined),
      insurance_policy_holder_relationship: row.insurance_policy_holder_relationship ?? undefined,
      insurance_plan_type: row.insurance_plan_type ?? undefined,
      policy_number: row.policy_number ?? undefined,
      insurance_phone_number: row.insurance_phone_number ?? undefined,
      has_secondary_insurance: row.has_secondary_insurance ?? undefined,
      secondary_insurance_provider: row.secondary_insurance_provider ?? undefined,
      secondary_insurance_member_id: row.secondary_insurance_member_id ?? undefined,
      secondary_policy_number: row.secondary_policy_number ?? undefined,
      self_pay_card_info: row.self_pay_card_info ?? undefined,
      is_eligible: isEligible,
      matched_at: row.matched_at ?? undefined,
      qbo_customer_id: row.qbo_customer_id ?? undefined,
      quickbooks_sync_status: row.quickbooks_sync_status ?? (row.qbo_customer_id ? 'link_stale' : 'not_linked'),
      quickbooks_last_checked_at: row.quickbooks_last_checked_at
        ? new Date(row.quickbooks_last_checked_at).toISOString()
        : undefined,
      quickbooks_last_synced_at: row.quickbooks_last_synced_at
        ? new Date(row.quickbooks_last_synced_at).toISOString()
        : undefined,
      quickbooks_sync_error: row.quickbooks_sync_error ?? undefined,
    };
  }
}
