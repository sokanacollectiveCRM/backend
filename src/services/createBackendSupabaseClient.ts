import WebSocket from 'ws';

import { createClient } from '@supabase/supabase-js';

type RealtimeOptions = NonNullable<
  NonNullable<Parameters<typeof createClient>[2]>['realtime']
>;

/** Node 20 has no native WebSocket; all backend clients need a transport. */
export function createBackendSupabaseClient(
  url: string,
  key: string,
  options?: Parameters<typeof createClient>[2]
) {
  return createClient(url, key, {
    ...options,
    realtime: {
      ...options?.realtime,
      // ws implements the transport API, but declares Node-specific event types.
      transport: WebSocket as unknown as RealtimeOptions['transport'],
    },
  });
}
