import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  ALPHABETS,
  generateCode,
  normalizeCode as normalizePairingCode,
  type PairingAlphabet,
} from '@mister-guiiug/dev-wpa-config/pairing';
import { getSupabase } from '../supabase';
import type { CurrentMatchState, MatchConfig, Throw } from '../schemas';

export interface LiveMatchRow {
  id: string;
  code: string;
  config: MatchConfig;
  throws: Throw[];
  winner_id: string | null;
  started_at: string;
  updated_at: string;
  finished_at: string | null;
}

/**
 * Codes de partage — module socle `/pairing`, alphabet `crockford32`.
 *
 * HISTORIQUE. Jusqu'ici ce fichier tirait ses codes d'un alphabet local de
 * 32 caractères sans 0/O ni 1/I (l'`antiConfusion` du socle) et sa
 * normalisation « corrigeait » I → 1 et O → 0 — deux caractères HORS de cet
 * alphabet : le code corrompu gardait la bonne longueur et la recherche en
 * base échouait en silence. Le socle tranche pour le vrai base32 de
 * Crockford (0-9 + lettres sans I/L/O/U), dont les corrections I/L → 1 et
 * O → 0 restent DANS l'alphabet.
 *
 * COMPATIBILITÉ FILAIRE. Les deux alphabets ne coïncident pas :
 *   - ancien − nouveau = { L, U } : un ancien code (stocké côté Supabase,
 *     partagé par lien) peut contenir L ou U, que la normalisation Crockford
 *     détruirait (L → 1, U écarté) ;
 *   - nouveau − ancien = { 0, 1 } : un nouveau code peut contenir 0 ou 1.
 *
 * RUSTINE DE COMPAT, en deux moitiés (à retirer quand plus aucun code
 * d'avant la migration ne circule — les parties live sont éphémères) :
 *   1. la SAISIE (`normalizeCode`) accepte l'union des deux alphabets, pour
 *      que L et U restent saisissables ;
 *   2. la RÉSOLUTION (`joinLiveMatch`) cherche d'abord le code normalisé
 *      Crockford, puis retombe sur la normalisation héritée.
 * Limite assumée : une app pas encore mise à jour ne peut pas saisir les
 * nouveaux codes contenant 0 ou 1 (son premier filtre les écartait) — la
 * fenêtre se referme à la mise à jour du service worker.
 */
export const CODE_LENGTH = 6;

/** Alphabet de génération et de résolution : le Crockford du socle. */
const CODE_ALPHABET = 'crockford32';

/**
 * Alphabet de SAISIE (rustine n° 1) : l'union nouveau + ancien. Seules les
 * corrections dont la source n'appartient à AUCUN des deux alphabets sont
 * conservées (I → 1, O → 0) — appliquer L → 1 détruirait les anciens codes,
 * où L est légitime.
 */
const INPUT_CHARS = [
  ...new Set(ALPHABETS.crockford32.chars + ALPHABETS.antiConfusion.chars),
].join('');
const INPUT_ALPHABET: PairingAlphabet = {
  chars: INPUT_CHARS,
  aliases: Object.fromEntries(
    Object.entries(ALPHABETS.crockford32.aliases ?? {}).filter(
      ([confused]) => !INPUT_CHARS.includes(confused)
    )
  ),
};

/**
 * Normalisation de saisie (champ contrôlé, contenu scanné) : majuscules,
 * I → 1 et O → 0, tout caractère hors union écarté, borné à `CODE_LENGTH`.
 * La résolution stricte vers un alphabet donné vit dans `joinLiveMatch`.
 */
export function normalizeCode(input: string): string {
  return normalizePairingCode(input, {
    alphabet: INPUT_ALPHABET,
    maxLength: CODE_LENGTH,
  });
}

export class LiveBackendUnavailableError extends Error {
  constructor() {
    super(
      'Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing)'
    );
    this.name = 'LiveBackendUnavailableError';
  }
}

async function requireClient() {
  const client = await getSupabase();
  if (!client) throw new LiveBackendUnavailableError();
  return client;
}

export async function createLiveMatch(
  state: CurrentMatchState
): Promise<{ id: string; code: string }> {
  const client = await requireClient();
  // Tirage socle : `crypto.getRandomValues` + rejet (équiprobable, sans le
  // biais `% taille`). Avec 32^6 ≈ 10⁹ combinaisons, la boucle de retry sur
  // contrainte d'unicité ci-dessous ne rejoue presque jamais.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode(CODE_LENGTH, { alphabet: CODE_ALPHABET });
    const { data, error } = await client
      .from('live_matches')
      .insert({
        code,
        config: state.config,
        throws: state.throws,
      })
      .select('id, code')
      .single();
    if (!error && data) {
      return { id: data.id, code: data.code };
    }
    if (error?.code !== '23505') throw error;
  }
  throw new Error('Could not generate a unique code after 5 attempts');
}

export async function joinLiveMatch(rawCode: string): Promise<LiveMatchRow> {
  const client = await requireClient();
  // Rustine n° 2 : normalisation Crockford d'abord (les codes engendrés
  // ici), repli hérité ensuite (les codes d'avant la migration, où L et U
  // sont légitimes). Sur l'immense majorité des saisies les deux candidats
  // coïncident — une seule requête part.
  const modern = normalizePairingCode(rawCode, {
    alphabet: CODE_ALPHABET,
    maxLength: CODE_LENGTH,
  });
  const legacy = normalizePairingCode(rawCode, {
    alphabet: ALPHABETS.antiConfusion,
    maxLength: CODE_LENGTH,
  });
  const candidates = (modern === legacy ? [modern] : [modern, legacy]).filter(
    code => code.length === CODE_LENGTH
  );
  if (candidates.length === 0) {
    throw new Error('Invalid code');
  }
  for (const code of candidates) {
    const { data, error } = await client
      .from('live_matches')
      .select('*')
      .eq('code', code)
      .single<LiveMatchRow>();
    if (!error && data) return data;
  }
  throw new Error('Match not found');
}

export async function pushLiveState(
  matchId: string,
  patch: Partial<
    Pick<LiveMatchRow, 'throws' | 'winner_id' | 'finished_at' | 'config'>
  >
): Promise<void> {
  const client = await requireClient();
  const { error } = await client
    .from('live_matches')
    .update(patch)
    .eq('id', matchId);
  if (error) throw error;
}

export interface LiveSubscription {
  channel: RealtimeChannel;
  unsubscribe: () => void;
}

export async function subscribeLiveMatch(
  matchId: string,
  onChange: (row: LiveMatchRow) => void,
  onError?: (err: Error) => void
): Promise<LiveSubscription> {
  const client = await requireClient();
  const channel = client
    .channel(`live_match:${matchId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_matches',
        filter: `id=eq.${matchId}`,
      },
      payload => {
        onChange(payload.new as LiveMatchRow);
      }
    )
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.(new Error(`Realtime channel status: ${status}`));
      }
    });

  return {
    channel,
    unsubscribe: () => {
      void client.removeChannel(channel);
    },
  };
}
