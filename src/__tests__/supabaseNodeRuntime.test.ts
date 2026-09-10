import { createBackendSupabaseClient } from '../services/createBackendSupabaseClient';

describe('Supabase backend runtime compatibility', () => {
  it('initializes the real SDK without a native WebSocket or network access', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
    Object.defineProperty(globalThis, 'WebSocket', {
      configurable: true,
      value: undefined,
    });
    try {
      const client = createBackendSupabaseClient(
        'https://example.supabase.co',
        'test-key',
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      expect(client.getChannels()).toEqual([]);
      expect(client.from('clients')).toBeDefined();
    } finally {
      if (original) Object.defineProperty(globalThis, 'WebSocket', original);
      else delete (globalThis as any).WebSocket;
    }
  });
});
