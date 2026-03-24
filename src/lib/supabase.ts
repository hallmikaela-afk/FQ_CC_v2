import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

let _supabase: SupabaseClient | null = null;

// Lazy-initialized Supabase browser client with cookie-based auth (SSR-compatible)
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    _supabase = createBrowserClient(url, key);
  }
  return _supabase;
}

// Backwards-compat proxy so existing `supabase.from(...)` calls still work
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop];
  },
});

// Server-side Supabase with service role key (bypasses RLS)
export function getServiceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!serviceKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY — the anon key cannot bypass RLS for server-side writes. ' +
      'Add SUPABASE_SERVICE_ROLE_KEY to your .env.local file.',
    );
  }
  return createClient(url, serviceKey);
}
