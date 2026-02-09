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
      first_name: user?.firstname || user?.first_name || '',
      last_name: user?.lastname || user?.last_name || '',
      email: user?.email,
      phone_number: entity.phoneNumber || user?.phone_number || user?.mobile_phone,
      status: entity.status,
      portal_status: entity.portal_status,
      invited_at: undefined, // Will be populated when invite tracking is added
      updated_at: entity.updatedAt?.toISOString(),
      is_eligible: isEligible,
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
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone_number: string | null;
      status: string | null;
      service_needed: string | null;
      portal_status: string | null;
      invited_at: string | null;
      last_invite_sent_at: string | null;
      invite_sent_count: number | null;
      requested_at: string | null;
      updated_at: string | null;
    },
    isEligible?: boolean
  ): ClientDetailDTO {
    // ONLY operational fields - no PHI
    // PHI fields are merged separately from PHI Broker response (in controller)
    const phone_number = row.phone_number ?? undefined;
    logger.info({ msg: '[ClientMapper] toDetailDTO', dto_phone_from_row: phone_number != null ? '(set)' : '(undefined)' });
    return {
      id: row.id,
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      email: row.email ?? undefined,
      phone_number,
      status: row.status || 'lead',
      service_needed: row.service_needed ?? undefined,
      portal_status: row.portal_status ?? undefined,
      invited_at: row.invited_at ?? undefined,
      last_invite_sent_at: row.last_invite_sent_at ?? undefined,
      invite_sent_count: row.invite_sent_count ?? undefined,
      requested_at: row.requested_at ?? undefined,
      updated_at: row.updated_at ?? undefined,
      is_eligible: isEligible,
    };
  }
}
