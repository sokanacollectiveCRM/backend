import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { requireEnv, optionalEnv } from './utils/env';

let supabaseClient: SupabaseClient | null = null;

function initSupabase(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = optionalEnv('SUPABASE_URL');
  const supabaseKey = optionalEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    // Defer hard failure to first use
    throw new Error('Missing Supabase environment variables');
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return supabaseClient;
}

// Lazy proxy: will throw only when first used if envs are missing
const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = initSupabase();
    // @ts-ignore
    return client[prop];
  },
});

export function getSupabaseAdmin(): SupabaseClient {
  return initSupabase();
}

export default supabase;
