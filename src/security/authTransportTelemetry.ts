/**
 * Auth transport telemetry (PR 6).
 * Counts only — never logs token values.
 */
import { logger } from '../common/utils/logger';

export type AuthTransportCounter =
  | 'token_source.cookie'
  | 'token_source.header'
  | 'token_source.bearer'
  | 'token_source.legacy_session_cookie'
  | 'legacy.login_json_token_returned'
  | 'legacy.body_access_token'
  | 'legacy.query_access_token'
  | 'legacy.session_cookie_seen';

const counters = new Map<AuthTransportCounter, number>();

export function recordAuthTransport(
  event: AuthTransportCounter,
  context?: Record<string, unknown>
): void {
  const next = (counters.get(event) ?? 0) + 1;
  counters.set(event, next);
  logger.info(
    {
      service: 'auth-transport',
      event,
      count: next,
      ...(context || {}),
    },
    'Auth transport telemetry'
  );
}

export function getAuthTransportCounters(): Record<string, number> {
  return Object.fromEntries(counters.entries());
}

export function resetAuthTransportCountersForTests(): void {
  counters.clear();
}
