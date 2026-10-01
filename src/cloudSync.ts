/**
 * Synchronisation multi-appareils par Supabase — LE TRANSPORT, ET RIEN D'AUTRE.
 *
 * Ce module lit, écrit et efface UN blob JSON (`user_data`), désigné par une
 * CLÉ DE SYNCHRO. Il ne décide de rien : la règle qui dit quoi garder vit dans
 * `src/sync/merge.ts`, et `useSyncStore` l'applique ENTRE le `pullSync` et le
 * `pushSync`.
 *
 * LA CLÉ EST L'IDENTITÉ (migration 0004). La version précédente s'adossait à
 * la connexion anonyme de Supabase, et ne pouvait rien réunir : une identité
 * anonyme vit dans UN navigateur, chaque appareil avait donc la sienne — et le
 * client ne gardait même pas sa session (`persistSession: false`, voir
 * `supabase.ts`), si bien que chaque lancement en tirait une neuve. La table
 * n'existait pas non plus, et la connexion anonyme était coupée sur le projet :
 * la fonction n'a jamais marché.
 *
 * Désormais un appareil tire une clé, l'affiche en QR, et les autres la
 * scannent. Qui détient la clé lit et remplace le blob, personne d'autre : la
 * table n'est accessible que par trois fonctions qui l'exigent, et la base
 * n'en garde que le haché.
 *
 * L'ÉCRITURE EST CONDITIONNELLE. `pushSync` envoie la version lue avant la
 * fusion ; si un autre appareil a écrit entre-temps, la base refuse
 * (`SyncConflictError`) et rien n'est écrasé. Le store relit alors, refusionne
 * et renvoie.
 *
 * LE FORMAT DU BLOB NE CHANGE PAS (`v: 1`).
 */

import {
  buildDeepLink,
  generateCode,
  normalizeCode,
  parseDeepLink,
} from '@mister-guiiug/dev-pwa-config/pairing';
import { getSupabase } from './supabase';

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
  /** Le compteur d'écritures du blob : à renvoyer avec l'envoi suivant. */
  version: number;
}

/**
 * 28 caractères crockford32 : 140 bits, ce qui rend la clé impossible à
 * deviner — elle ouvre le blob à qui la détient. La base refuse toute autre
 * forme, une clé courte ou choisie à la main comprise.
 */
export const SYNC_KEY_LENGTH = 28;

/** Le lien que porte le QR : scanné ailleurs que dans l'app, il se nomme. */
const SYNC_LINK = { scheme: 'molkky', action: 'sync' } as const;

/** Une clé neuve, tirée par le socle (`crypto.getRandomValues`, sans biais). */
export function generateSyncKey(): string {
  return generateCode(SYNC_KEY_LENGTH, { alphabet: 'crockford32' });
}

/**
 * Reconnaît une clé dans ce que l'utilisateur colle, tape ou scanne : le lien
 * du QR, la clé groupée par quatre (`ABCD-EFGH-…`), avec ou sans espaces, en
 * minuscules, avec les confusions I/L → 1 et O → 0. `null` si ce n'est pas une
 * clé complète — jamais une clé tronquée qu'on enverrait quand même.
 */
export function parseSyncKey(input: string): string | null {
  const text = input.trim();
  const link = parseDeepLink(text, SYNC_LINK);
  const raw = link ? (link.params.key ?? '') : text;
  // Des lettres, des chiffres et des séparateurs, rien d'autre. La
  // normalisation écarte tout caractère hors alphabet : une URL ou une phrase
  // qui retomberait par hasard sur 28 caractères donnerait une clé PRÉVISIBLE,
  // sous laquelle on enverrait ses données.
  if (!/^[0-9A-Za-z\s-]+$/.test(raw)) return null;
  const key = normalizeCode(raw, { alphabet: 'crockford32' });
  return key.length === SYNC_KEY_LENGTH ? key : null;
}

/** La clé par groupes de quatre, pour la lire ou la recopier sans se perdre. */
export function formatSyncKey(key: string): string {
  return key.match(/.{1,4}/g)?.join('-') ?? key;
}

/** Le contenu du QR : `molkky:sync?key=…`. */
export function syncKeyLink(key: string): string {
  return buildDeepLink(SYNC_LINK.scheme, SYNC_LINK.action, { key });
}

/**
 * Un autre appareil a écrit entre la lecture et l'envoi : la base a refusé,
 * rien n'est écrasé. C'est au store de relire et de refusionner.
 */
export class SyncConflictError extends Error {
  constructor() {
    super('Sync conflict: the cloud changed since it was read');
    this.name = 'SyncConflictError';
  }
}

async function requireClient() {
  const client = await getSupabase();
  if (!client) throw new Error('Supabase client unavailable');
  return client;
}

interface PushedRow {
  version: number;
  updated_at: string;
}

interface PulledRow extends PushedRow {
  payload: SyncPayload;
}

/** Le blob de la clé, ou `null` si elle n'a encore rien envoyé. */
export async function pullSync(key: string): Promise<SyncResult | null> {
  const client = await requireClient();
  const { data, error } = await client.rpc('sync_pull', { p_key: key });
  if (error) throw new Error(error.message);
  const row = data as PulledRow | null;
  if (!row) return null;
  return {
    payload: row.payload,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

/**
 * Remplace le blob, À CONDITION qu'il en soit encore à `version` (0 : rien
 * n'était écrit). Sinon `SyncConflictError`, et rien n'a été écrit.
 */
export async function pushSync(
  key: string,
  payload: SyncPayload,
  version: number
): Promise<SyncResult> {
  const client = await requireClient();
  const { data, error } = await client.rpc('sync_push', {
    p_key: key,
    p_payload: payload,
    p_version: version,
  });
  // `PT409` (HTTP 409), et non `40001` : PostgREST rejouait ce dernier sans
  // fin, et la requête ne répondait jamais (migration 0005).
  if (error?.code === 'PT409') throw new SyncConflictError();
  if (error) throw new Error(error.message);
  const row = data as PushedRow;
  return { payload, updatedAt: row.updated_at, version: row.version };
}

/** Efface le blob de la clé ; `true` s'il y en avait un. */
export async function deleteSync(key: string): Promise<boolean> {
  const client = await requireClient();
  const { data, error } = await client.rpc('sync_delete', { p_key: key });
  if (error) throw new Error(error.message);
  return data === true;
}
