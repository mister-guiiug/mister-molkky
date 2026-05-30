import type { SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null | undefined;

/**
 * Lazily resolve the Supabase client. The `@supabase/supabase-js` bundle
 * (~120 KB) is only pulled in the first time live/sync actually needs it
 * — a dynamic import keeps it out of the initial app chunk for the vast
 * majority of users who never touch the multi-device feature. The client
 * is cached after the first construction; subsequent calls resolve
 * synchronously-fast (no re-import, the module is already in memory).
 */
export async function getSupabase(): Promise<SupabaseClient | null> {
  if (cached !== undefined) return cached;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    cached = null;
    return cached;
  }
  const { createClient } = await import('@supabase/supabase-js');
  cached = createClient(url, key, {
    auth: { persistSession: false },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );
}
