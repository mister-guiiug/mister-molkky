import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  ALPHABETS,
  generateCode,
  normalizeCode as normalizePairingCode,
  type PairingAlphabet,
} from '@mister-guiiug/dev-pwa-config/pairing';
import { LEGACY_SPECTATOR_PATH, ROUTES } from '../routes';
import { getSupabase } from '../supabase';
import type { CurrentMatchState, MatchConfig, Throw } from '../schemas';

/**
 * L'état d'une partie tel que `live_match_get` le rend : ni `id` ni secret
 * d'hôte (migration 0003). Le code est la seule clé qu'un spectateur détient.
 */
export interface LiveMatchRow {
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

/**
 * URL de partage d'une partie live, alignée sur la route RÉELLE du routeur
 * (`ROUTES.spectator`/:code). Historique : après le renommage des routes
 * (`/direct` → `/live`), LiveShareSheet a gardé un littéral `direct/` codé
 * en dur — le QR menait au catch-all, donc à l'accueil. Construire l'URL
 * depuis la constante de route rend cette divergence impossible.
 *
 * `base` est le BASE_URL Vite (slash final garanti) ; `origin` n'en a pas.
 */
export function buildLiveShareUrl(
  origin: string,
  base: string,
  code: string
): string {
  return `${origin}${base}`.replace(/\/$/, '') + `${ROUTES.spectator}/${code}`;
}

/**
 * Chemins acceptés au scan : la route spectateur actuelle, plus l'ancienne
 * (`/direct`) que portent les QR imprimés/partagés avant le correctif —
 * voir LEGACY_SPECTATOR_PATH. Dérivés des constantes de routes pour ne
 * plus pouvoir diverger du routeur. Le segment doit commencer après un `/`
 * (ou en début de chaîne) : « molkky-live/X » n'est pas un chemin live.
 */
const SCANNED_PATH_RE = new RegExp(
  `(?:^|/)(?:${[ROUTES.spectator, LEGACY_SPECTATOR_PATH]
    .map(path => path.slice(1))
    .join('|')})/([A-Za-z0-9]+)`,
  'i'
);

/**
 * Extrait le code d'un contenu scanné — URL de partage (chemin actuel ou
 * hérité) ou code brut — et le normalise (saisie). Renvoie null quand le
 * contenu ne porte pas un code de la bonne longueur.
 */
export function extractScannedCode(data: string): string | null {
  const candidate = SCANNED_PATH_RE.exec(data)?.[1] ?? data;
  const normalized = normalizeCode(candidate);
  return normalized.length === CODE_LENGTH ? normalized : null;
}

class LiveBackendUnavailableError extends Error {
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

/*
 * LE CODE EST UNE CLÉ (migration 0003). La table `live_matches` n'est plus
 * lisible ni modifiable directement par la clé anonyme : quatre fonctions
 * `security definer` sont la seule porte. Lire exige le code exact ; écrire
 * exige le code ET le secret d'hôte, que la base rend une fois, à la création,
 * et ne garde que haché. Avant, une seule requête listait toutes les parties
 * en cours, noms de joueurs compris, et quiconque en tenait l'`id` — rendu à
 * chaque spectateur — pouvait en réécrire les lancers.
 *
 * LE TEMPS RÉEL PASSE PAR BROADCAST. `postgres_changes` rejoue la policy
 * `select` sous le rôle de l'abonné avant de livrer : sans lecture ouverte, il
 * ne livre plus rien. L'hôte émet donc, après chaque écriture, un SIGNAL sur le
 * canal de la partie, et le spectateur relit l'état par son code. Le signal
 * ne porte aucune donnée : un porteur du code qui en forgerait un ne
 * provoquerait qu'une relecture de la base, jamais un faux score à l'écran.
 */
const LIVE_EVENT = 'update';

/** Le canal d'une partie : le code, et rien que le code, le désigne. */
export function liveTopic(code: string): string {
  return `molkky-live:${code}`;
}

/**
 * Crée la partie en base et rend le secret d'hôte — la base ne le rendra plus
 * jamais : il ne vit que dans le store de l'hôte, le temps de la diffusion.
 */
export async function createLiveMatch(
  state: CurrentMatchState
): Promise<{ code: string; hostToken: string }> {
  const client = await requireClient();
  // Tirage socle : `crypto.getRandomValues` + rejet (équiprobable, sans le
  // biais `% taille`). Avec 32^6 ≈ 10⁹ combinaisons, la boucle de retry sur
  // contrainte d'unicité ci-dessous ne rejoue presque jamais.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode(CODE_LENGTH, { alphabet: CODE_ALPHABET });
    const { data, error } = await client.rpc('live_match_create', {
      p_code: code,
      p_config: state.config,
      p_throws: state.throws,
    });
    if (!error && typeof data === 'string') {
      return { code, hostToken: data };
    }
    if (error?.code !== '23505') {
      throw error ?? new Error('live_match_create returned no host token');
    }
  }
  throw new Error('Could not generate a unique code after 5 attempts');
}

/**
 * L'état d'une partie, relu par son code EXACT (aucune normalisation ici).
 * `null` quand aucune partie ne porte ce code — ou plus : une partie muette
 * depuis 24 h est introuvable, purgée ou non.
 */
export async function fetchLiveMatch(
  code: string
): Promise<LiveMatchRow | null> {
  const client = await requireClient();
  const { data, error } = await client.rpc('live_match_get', {
    p_code: code,
  });
  if (error) throw error;
  return (data as LiveMatchRow | null) ?? null;
}

export async function joinLiveMatch(rawCode: string): Promise<LiveMatchRow> {
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
    const row = await fetchLiveMatch(code);
    if (row) return row;
  }
  throw new Error('Match not found');
}

/**
 * Le signal aux spectateurs, par l'API REST de Realtime : l'hôte n'a aucune
 * websocket à tenir ouverte pendant la partie, il n'écoute rien. Un spectateur
 * qui n'était pas encore abonné rattrape l'état à son abonnement (voir
 * `subscribeLiveMatch`). Un échec REMONTE : l'état est en base, mais personne
 * ne le sait — c'est à l'hôte de le voir (puce d'erreur du store), pas au
 * spectateur de se figer en silence.
 */
async function signalLiveUpdate(
  client: SupabaseClient,
  code: string
): Promise<void> {
  const channel = client.channel(liveTopic(code));
  try {
    await channel.httpSend(LIVE_EVENT, {});
  } finally {
    void client.removeChannel(channel);
  }
}

/** L'hôte recopie ses lancers, puis prévient les spectateurs. */
export async function pushLiveThrows(
  code: string,
  hostToken: string,
  throws: Throw[]
): Promise<void> {
  const client = await requireClient();
  const { error } = await client.rpc('live_match_push', {
    p_code: code,
    p_host_token: hostToken,
    p_throws: throws,
  });
  if (error) throw error;
  await signalLiveUpdate(client, code);
}

/**
 * L'hôte clôt la partie : derniers lancers, vainqueur et heure de fin (posée
 * par la base) d'un seul geste. Les lancers voyagent ici parce que le lancer
 * gagnant fait passer la partie de `current` à l'historique dans le même
 * rendu : le miroir de `pushLiveThrows` ne le voit jamais.
 */
export async function finishLiveMatch(
  code: string,
  hostToken: string,
  throws: Throw[],
  winnerId: string
): Promise<void> {
  const client = await requireClient();
  const { error } = await client.rpc('live_match_finish', {
    p_code: code,
    p_host_token: hostToken,
    p_throws: throws,
    p_winner_id: winnerId,
  });
  if (error) throw error;
  await signalLiveUpdate(client, code);
}

export interface LiveSubscription {
  channel: RealtimeChannel;
  /**
   * Résolue une fois le canal RETIRÉ du client. Le client Realtime rend le
   * canal existant pour un même sujet : se réabonner avant la fin du retrait
   * rendrait le canal en train de fermer, et le spectateur n'entendrait plus
   * rien.
   */
  unsubscribe: () => Promise<void>;
}

/**
 * Le spectateur écoute le canal de la partie et relit l'état à chaque signal
 * — ainsi qu'à chaque (ré)abonnement réussi : c'est ce qui rattrape un signal
 * émis entre la première lecture et l'abonnement, ou pendant une coupure.
 *
 * UNE SEULE RELECTURE EN VOL. Des signaux rapprochés ne lancent pas autant de
 * requêtes concurrentes, dont la plus ancienne pourrait répondre la dernière
 * et remettre un état périmé à l'écran : un signal reçu pendant une relecture
 * en commande une seule autre, après elle.
 */
export async function subscribeLiveMatch(
  code: string,
  onChange: (row: LiveMatchRow) => void,
  onError?: (err: Error) => void
): Promise<LiveSubscription> {
  const client = await requireClient();
  let closed = false;
  let inFlight = false;
  let again = false;

  const refresh = async (): Promise<void> => {
    if (closed) return;
    if (inFlight) {
      again = true;
      return;
    }
    inFlight = true;
    try {
      do {
        again = false;
        const row = await fetchLiveMatch(code);
        if (row && !closed) onChange(row);
      } while (again && !closed);
    } catch (err) {
      if (!closed) onError?.(err as Error);
    } finally {
      inFlight = false;
    }
  };

  const channel = client
    .channel(liveTopic(code))
    .on('broadcast', { event: LIVE_EVENT }, () => {
      void refresh();
    })
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        void refresh();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.(err ?? new Error(`Realtime channel status: ${status}`));
      }
    });

  return {
    channel,
    unsubscribe: async () => {
      closed = true;
      await client.removeChannel(channel);
    },
  };
}
