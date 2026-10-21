import { DEFAULT_VISIT_DURATION_MINUTES } from '../domain/types';
import type { SchedulingConfig } from './ports';

/**
 * Contract-stage gate. Default is on (`true`). Set
 * BOOKING_REQUIRE_CONTRACT_STAGE=false on **dev** for the Oct 12 pilot if
 * fixture/pilot clients do not have a phi_contracts row.
 *
 * Kept out of src/config/env.ts so this PR does not collide with open PRs
 * that edit that file.
 */
export function bookingRequiresContractStage(): boolean {
  const raw = (process.env.BOOKING_REQUIRE_CONTRACT_STAGE ?? 'true')
    .trim()
    .toLowerCase();
  return raw !== 'false' && raw !== '0';
}

export function schedulingFrontendUrl(): string {
  const raw = process.env.FRONTEND_URL?.trim();
  return raw && raw.length ? raw.replace(/\/+$/, '') : 'http://localhost:3001';
}

export const schedulingConfig: SchedulingConfig = {
  requireContractStage: bookingRequiresContractStage,
  frontendUrl: schedulingFrontendUrl,
  visitDurationMinutes: () => DEFAULT_VISIT_DURATION_MINUTES,
};
