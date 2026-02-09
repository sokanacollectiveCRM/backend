import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase as supabaseConfig } from './config/env';

let supabaseClient: SupabaseClient | null = null;

function initSupabase(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = supabaseConfig.url;
  const supabaseKey = supabaseConfig.serviceRoleKey;

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
