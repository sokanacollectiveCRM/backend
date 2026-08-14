import { RequestFormRepository } from '../../../repositories/requestFormRepository';
import { RequestFormData, RequestFormResponse } from '../../../types';
import { IntakeLeadRepository } from '../application/ports';

/** Adapter: existing Cloud SQL request-form repository implements the intake port. */
export class LegacyRequestFormRepositoryAdapter implements IntakeLeadRepository {
  constructor(private readonly repository: RequestFormRepository) {}

  saveLead(data: RequestFormData): Promise<RequestFormResponse> {
    return this.repository.saveData(data);
  }
}
