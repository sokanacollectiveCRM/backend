import { RequestFormData, RequestFormResponse } from '../../../types';

/** Persistence port for public intake lead creation. */
export interface IntakeLeadRepository {
  saveLead(data: RequestFormData): Promise<RequestFormResponse>;
}
