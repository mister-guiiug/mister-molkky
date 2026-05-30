/**
 * Cross-device cloud sync via Supabase. Last-write-wins per device.
 *
 * Strategy: bundle the four persisted Zustand slices (players, history,
 * templates, settings) into one JSON blob keyed by the anonymous
 * Supabase user. Push on demand, pull on demand. Conflict resolution
 * is intentionally simple — the next iteration can add per-array
 * timestamps + merging.
 *
 * **Requires a one-time SQL migration in Supabase** — see
 * `docs/cloud-sync.md`. Without the `user_data` table this module
 * gracefully no-ops (errors surfaced to the UI).
 */

import { getSupabase, isSupabaseConfigured } from './supabase';

export type SyncPayload = {
  v: 1;
  players: unknown;
  history: unknown;
  templates: unknown;
  settings: unknown;
  /** Client-side timestamp at push-time, used as a "version" hint. */
  pushedAt: number;
};

export interface SyncResult {
  payload: SyncPayload;
  updatedAt: string;
}

const TABLE = 'user_data';

/**
 * Sign in anonymously so the user gets a stable `auth.uid()` without
 * having to create an account. Idempotent: returns immediately if a
 * session already exists. Falls back to the existing session if anon
 * sign-up is disabled at the project level (the call throws there).
 */
export async function ensureSyncSession(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const client = await getSupabase();
  if (!client) return null;
  const {
    data: { session: existing },
  } = await client.auth.getSession();
  if (existing) return existing.user.id;
  try {
    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

export async function pushSync(payload: SyncPayload): Promise<SyncResult> {
  const userId = await ensureSyncSession();
  if (!userId) throw new Error('Sync session unavailable');
  const client = await getSupabase();
  if (!client) throw new Error('Supabase client unavailable');
  const updatedAt = new Date().toISOString();
  const { error } = await client.from(TABLE).upsert(
    {
      user_id: userId,
      payload,
      updated_at: updatedAt,
    },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(error.message);
  return { payload, updatedAt };
}

export async function pullSync(): Promise<SyncResult | null> {
  const userId = await ensureSyncSession();
  if (!userId) return null;
  const client = await getSupabase();
  if (!client) return null;
  const { data, error } = await client
    .from(TABLE)
    .select('payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    payload: data.payload as SyncPayload,
    updatedAt: data.updated_at as string,
  };
}
