import { AsyncLocalStorage } from 'async_hooks';

export interface TenantRequestState {
  tenantId: string | null;
  bypass: boolean;
}

const storage = new AsyncLocalStorage<TenantRequestState>();

export function readTenantRequestState(): TenantRequestState {
  return storage.getStore() ?? { tenantId: null, bypass: false };
}

export function runWithTenantState<T>(
  state: TenantRequestState,
  fn: () => T
): T {
  return storage.run(state, fn);
}

/** Identity lookup must see staff and client rows before a tenant is chosen. */
export function runWithTenancyBypass<T>(fn: () => T): T {
  const current = readTenantRequestState();
  return storage.run({ tenantId: current.tenantId, bypass: true }, fn);
}

export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return storage.run({ tenantId, bypass: false }, fn);
}
