/**
 * Cross-instance webhook event claim ledger (idempotency / replay prevention).
 * Unique (provider, event_key). First insert wins; duplicates are no-ops.
 */
import { getPool } from '../db/cloudSqlPool';

export type WebhookClaimResult = 'claimed' | 'duplicate';

export interface WebhookEventStore {
  claim(provider: string, eventKey: string): Promise<WebhookClaimResult>;
}

export class MemoryWebhookEventStore implements WebhookEventStore {
  private readonly keys = new Set<string>();

  async claim(provider: string, eventKey: string): Promise<WebhookClaimResult> {
    const key = `${provider}::${eventKey}`;
    if (this.keys.has(key)) return 'duplicate';
    this.keys.add(key);
    return 'claimed';
  }

  clear(): void {
    this.keys.clear();
  }
}

export class DbWebhookEventStore implements WebhookEventStore {
  async claim(provider: string, eventKey: string): Promise<WebhookClaimResult> {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO public.webhook_events (provider, event_key)
       VALUES ($1, $2)
       ON CONFLICT (provider, event_key) DO NOTHING
       RETURNING id`,
      [provider, eventKey]
    );
    return result.rowCount && result.rowCount > 0 ? 'claimed' : 'duplicate';
  }
}

const useMemory =
  process.env.WEBHOOK_EVENT_STORE === 'memory' ||
  (process.env.NODE_ENV === 'test' && process.env.WEBHOOK_EVENT_STORE !== 'db');

let store: WebhookEventStore = useMemory
  ? new MemoryWebhookEventStore()
  : new DbWebhookEventStore();

export function getWebhookEventStore(): WebhookEventStore {
  return store;
}

/** Test helper — swap store and reset memory. */
export function setWebhookEventStoreForTests(next: WebhookEventStore): void {
  store = next;
}

export function resetWebhookEventStoreForTests(): void {
  store = useMemory ? new MemoryWebhookEventStore() : new DbWebhookEventStore();
}

export async function claimWebhookEvent(
  provider: string,
  eventKey: string
): Promise<WebhookClaimResult> {
  return getWebhookEventStore().claim(provider, eventKey);
}
