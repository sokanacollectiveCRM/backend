import {
  clientOnboardingReadinessRepository,
  mapReadinessRow,
} from '../../../repositories/cloudSqlClientOnboardingReadinessRepository';
import {
  PortalReadinessStore,
  ReadinessEvent,
  SaveReadinessInput,
  StoredReadiness,
} from '../application/ports';
import { PortalEligibilitySnapshot } from '../domain/eligibility';

export class CloudSqlPortalReadinessStore implements PortalReadinessStore {
  async getStored(clientId: string): Promise<StoredReadiness | null> {
    const row =
      await clientOnboardingReadinessRepository.getByClientId(clientId);
    if (!row) return null;
    return {
      is_eligible: row.is_eligible,
      verification_invoice_id: row.verification_invoice_id,
      verification_invoice_sent_at: row.verification_invoice_sent_at,
      verification_invoice_paid_at: row.verification_invoice_paid_at,
    };
  }

  async getSnapshots(
    clientIds: string[]
  ): Promise<Map<string, PortalEligibilitySnapshot>> {
    const rows =
      await clientOnboardingReadinessRepository.getByClientIds(clientIds);
    const map = new Map<string, PortalEligibilitySnapshot>();
    for (const [clientId, row] of rows) {
      map.set(clientId, mapReadinessRow(row));
    }
    return map;
  }

  async save(input: SaveReadinessInput): Promise<PortalEligibilitySnapshot> {
    const row = await clientOnboardingReadinessRepository.upsert(input);
    return mapReadinessRow(row);
  }

  async recordEvent(event: ReadinessEvent): Promise<void> {
    await clientOnboardingReadinessRepository.recordEvent(event);
  }
}
