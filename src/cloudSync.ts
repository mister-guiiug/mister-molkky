/**
 * Synchronisation multi-appareils par Supabase — LE TRANSPORT, ET RIEN D'AUTRE.
 *
 * Ce module lit et écrit UNE ligne (`user_data`) portant un blob JSON, sous
 * l'identité anonyme de l'utilisateur. Il ne décide plus de rien : la règle qui
 * dit quoi garder vit dans `src/sync/merge.ts`, et `useSyncStore` l'applique
 * ENTRE le `pullSync` et le `pushSync`.
 *
 * CE QUI A CHANGÉ, ET POURQUOI. Ce fichier annonçait « last-write-wins per
 * device » et posait un `upsert` du blob entier : le dernier appareil à envoyer
 * écrasait ce que l'autre avait écrit. Une partie notée sur le téléphone du
 * jardin et une autre sur celui de la maison, et l'une des deux disparaissait.
 * L'`upsert` est resté — c'est la bonne opération pour écrire une ligne dont on
 * est le propriétaire — mais ce qu'il écrit est désormais l'UNION, calculée
 * juste avant l'appel.
 *
 * LE FORMAT DE LA LIGNE NE CHANGE PAS (`v: 1`). Les enregistrements peuvent
 * porter un `updatedAt` de plus, que les versions antérieures de l'app
 * ignorent : un appareil resté sur l'ancienne version continue de lire ce blob.
 * Il continue aussi de l'ÉCRASER en entier quand il envoie — la fusion ne
 * protège une donnée que si les deux appareils ont la version qui fusionne.
 *
 * **Demande une migration SQL unique dans Supabase** — voir
 * `docs/cloud-sync.md`. Sans la table `user_data`, ce module ne fait rien
 * (l'erreur remonte à l'écran).
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
async function ensureSyncSession(): Promise<string | null> {
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
