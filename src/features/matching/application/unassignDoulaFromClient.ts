export type UnassignDoulaError = 'MISSING_IDS' | 'NOT_FOUND';

export type UnassignDoulaResult =
  | { ok: true }
  | { ok: false; error: UnassignDoulaError };

export interface UnassignDoulaInput {
  clientId?: string;
  doulaId?: string;
}

export interface UnassignDoulaDeps {
  unassignDoula(clientId: string, doulaId: string): Promise<boolean>;
}

/**
 * Client route `DELETE /clients/:id/assign-doula/:doulaId`.
 * A missing assignments table stays an unexpected error. The list route is
 * the one that returns an empty success body for that case.
 */
export async function unassignDoulaFromClient(
  deps: UnassignDoulaDeps,
  input: UnassignDoulaInput
): Promise<UnassignDoulaResult> {
  if (!input.clientId || !input.doulaId) {
    return { ok: false, error: 'MISSING_IDS' };
  }

  const removed = await deps.unassignDoula(input.clientId, input.doulaId);
  if (!removed) {
    return { ok: false, error: 'NOT_FOUND' };
  }
  return { ok: true };
}
