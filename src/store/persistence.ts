/**
 * Persistance locale VERSIONNÉE : le magasin du socle marié à `zustand/persist`.
 *
 * CE QUI EXISTAIT, ET CE QUI MANQUAIT. Les cinq magasins écrivaient déjà sous
 * `mm_*` par `zustand/persist`, et `mm_match` portait même une chaîne de
 * migrations (`version: 3`, trois champs rétro-remplis). Mais :
 *
 *  1. **Quatre magasins sur cinq portaient un numéro sans chaîne** — `version: 1`
 *     et pas de `migrate`. Or `zustand/persist` ne conserve RIEN quand les deux
 *     versions diffèrent sans fonction de migration : il écrit
 *     « State loaded from storage couldn't be migrated » dans la console et
 *     hydrate l'état INITIAL. Le premier `set` qui suit réécrit la clé. Le jour
 *     où le modèle des joueurs, des modèles de partie ou des réglages bouge, le
 *     roster part avec — sans un message à l'utilisateur.
 *  2. **Rien n'était validé à la lecture.** Une clé tronquée par un onglet tué,
 *     un enregistrement écrit par une version d'après, et l'app rendait un état
 *     dont le schéma zod jurait qu'il ne pouvait pas exister.
 *  3. **Rien n'était mis de côté.** Ce que le magasin ne comprenait pas était
 *     écrasé à la sauvegarde suivante.
 *
 * LE MARIAGE, ET POURQUOI IL TIENT. `zustand/persist` accepte un
 * `PersistStorage` — `getItem` rend `{ state }`, `setItem` le reçoit — pas
 * seulement un `Storage` de chaînes. C'est par là que passe le magasin
 * versionné du socle (`createVersionedStore`), qui apporte les trois pièces
 * manquantes : enveloppe `{ v, data }`, chaîne de migrations montant d'un cran,
 * validation injectée — et, avant TOUTE perte possible, une copie de côté
 * déterministe (`mm_match.backup-v0`), jamais l'inverse.
 *
 * UNE SEULE VERSION, ET C'EST VOULU. Les magasins ne passent plus `version` ni
 * `migrate` à `persist` : deux compteurs pour la même donnée finissent toujours
 * par diverger. Le seul numéro est celui de l'enveloppe du socle. Ce qu'écrit
 * l'app d'aujourd'hui — `{ "state": …, "version": 3 }`, l'enveloppe de zustand —
 * n'a pas d'enveloppe du socle : il vaut donc v0, et la migration `0 → 1`
 * ci-dessous est exactement « lire les clés `mm_*` d'aujourd'hui ». Les
 * anciennes migrations de zustand ne sont pas perdues pour autant : chaque
 * magasin passe la sienne en `legacy`, rejouée sur l'état déballé avec le
 * numéro que zustand avait écrit.
 *
 * CE QUI RESTE HORS DE CE FICHIER. Les avatars et les photos de situation
 * vivent dans IndexedDB (`src/idb.ts`, base `mister-molkky`, magasins
 * `kv`/`blobs`) : du binaire n'a rien à faire dans `localStorage`, et cette
 * partie-là était déjà juste.
 */
import { createVersionedStore } from '@mister-guiiug/dev-pwa-config/versioned-store';
import type { Store } from '@mister-guiiug/dev-pwa-config/storage';
import type { PersistStorage } from 'zustand/middleware';
import type { ZodType } from 'zod';
import { safeLocalStorage } from '../storage';

/** Le préfixe historique de l'app. Ne bouge pas : les clés sont déjà posées. */
const PREFIX = 'mm_';

/**
 * Les clés `localStorage` de l'app, en un seul endroit — `name` de
 * `zustand/persist` et clé du magasin versionné doivent désigner le même
 * octet, et rien ne le vérifierait à l'exécution.
 */
export const STORE_KEYS = {
  match: `${PREFIX}match`,
  players: `${PREFIX}players`,
  templates: `${PREFIX}templates`,
  settings: `${PREFIX}settings`,
  sync: `${PREFIX}sync`,
} as const;

/**
 * Version de l'enveloppe du socle. `0` = ce qu'écrivait `zustand/persist`
 * (`{ state, version }`, ou n'importe quoi d'avant) ; `1` = `{ v: 1, data }`.
 */
const ENVELOPE_VERSION = 1;

/** Suffixe de la mise à l'écart des enregistrements refusés par le schéma. */
const REJECTED_SUFFIX = '.rejete';

/**
 * Un `Store` du socle posé sur `safeLocalStorage()` PLUTÔT QUE sur
 * `createStore()`.
 *
 * `createStore` lit `globalThis.localStorage` directement ; l'app, elle, a un
 * repli mémoire pour les environnements qui n'en ont pas (Safari privé
 * historique, tests). Passer par `createStore` aurait rendu la persistance
 * MUETTE là où elle marchait : le socle ne lève pas, mais n'écrit pas non
 * plus. L'adaptateur ne recopie rien du socle — il lui donne juste le bon
 * support.
 */
function molkkyStore(): Store {
  const full = (key: string) => `${PREFIX}${key}`;
  return {
    prefix: PREFIX,
    kind: 'local',
    available() {
      try {
        const probe = `${PREFIX}__probe__`;
        safeLocalStorage().setItem(probe, '1');
        safeLocalStorage().removeItem(probe);
        return true;
      } catch {
        return false;
      }
    },
    get<T>(key: string, fallback: T): T {
      const raw = this.getRaw(key);
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      let serialized: string | undefined;
      try {
        serialized = JSON.stringify(value);
      } catch {
        return false;
      }
      if (serialized === undefined) return false;
      return this.setRaw(key, serialized);
    },
    getRaw(key) {
      try {
        return safeLocalStorage().getItem(full(key));
      } catch {
        return null;
      }
    },
    setRaw(key, value) {
      try {
        safeLocalStorage().setItem(full(key), value);
        return true;
      } catch {
        // Quota dépassé, données de site bloquées : l'app continue, en mémoire.
        return false;
      }
    },
    remove(key) {
      try {
        safeLocalStorage().removeItem(full(key));
      } catch {
        /* il n'y avait rien à retirer */
      }
    },
    keys() {
      const out: string[] = [];
      try {
        const storage = safeLocalStorage();
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i);
          if (key?.startsWith(PREFIX)) out.push(key.slice(PREFIX.length));
        }
      } catch {
        /* stockage indisponible : aucune clé */
      }
      return out;
    },
    clear() {
      for (const key of this.keys()) this.remove(key);
    },
  };
}

/**
 * Garde les enregistrements que le schéma accepte, met les autres de côté.
 *
 * Une partie mal formée sur deux cents ne doit pas coûter les cent
 * quatre-vingt-dix-neuf autres : la validation est donc élément par élément, et
 * ce qui tombe est REMIS À L'APPELANT, pas jeté.
 */
export function keepValid<T>(
  schema: ZodType<T>,
  value: unknown,
  reject: (record: unknown) => void
): T[] {
  if (!Array.isArray(value)) return [];
  const kept: T[] = [];
  for (const item of value) {
    const parsed = schema.safeParse(item);
    if (parsed.success) kept.push(parsed.data);
    else reject(item);
  }
  return kept;
}

/**
 * Déballe l'enveloppe de `zustand/persist` et rejoue, si le magasin en a une,
 * l'ancienne chaîne de migrations avec le numéro que zustand avait écrit.
 *
 * Une valeur SANS `state` traverse telle quelle : rien ne garantit que ce qui
 * traîne sous une clé `mm_*` vienne de zustand, et la validation dira le reste.
 */
function unwrapZustandEnvelope(
  legacy?: (state: unknown, version: number) => unknown
) {
  return (data: unknown): unknown => {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return data;
    }
    const envelope = data as { state?: unknown; version?: unknown };
    if (!('state' in envelope)) return data;
    const from = typeof envelope.version === 'number' ? envelope.version : 0;
    return legacy ? legacy(envelope.state, from) : envelope.state;
  };
}

export interface VersionedPersistOptions<S> {
  /** La clé complète, telle qu'elle est déjà posée (`STORE_KEYS.match`). */
  name: string;
  /** L'ancienne fonction `migrate` de `zustand/persist`, si le magasin en avait une. */
  legacy?: (state: unknown, version: number) => unknown;
  /**
   * Valide et répare. LÈVE quand la forme d'ensemble est inutilisable — le
   * socle met alors la valeur brute de côté avant de repartir de zéro. Les
   * enregistrements individuels refusés passent par `reject` : ils sortent de
   * l'état vivant sans quitter le stockage.
   */
  validate: (data: unknown, reject: (record: unknown) => void) => S;
}

/**
 * Le `PersistStorage` que les magasins passent à `persist`.
 *
 * `getItem` rend `{ state }` SANS numéro : le seul compteur est celui de
 * l'enveloppe du socle, et `zustand/persist` ne doit pas en tenir un second.
 * `typeof undefined === 'number'` étant faux, sa branche de migration ne
 * s'arme jamais — c'est le contrat, pas une coïncidence.
 */
export function versionedPersistStorage<S>(
  options: VersionedPersistOptions<S>
): PersistStorage<S> {
  const key = options.name.startsWith(PREFIX)
    ? options.name.slice(PREFIX.length)
    : options.name;
  const rejected: unknown[] = [];
  const store = createVersionedStore<S>({
    store: molkkyStore(),
    key,
    version: ENVELOPE_VERSION,
    migrations: { 0: unwrapZustandEnvelope(options.legacy) },
    validate: data => options.validate(data, record => rejected.push(record)),
  });

  return {
    getItem: () => {
      rejected.length = 0;
      const state = store.load();
      if (rejected.length > 0) {
        // Clé DÉTERMINISTE : relire cent fois la même donnée malade n'écrit
        // pas cent copies. L'utilisateur perd la ligne dans l'app, pas sur
        // le disque — et un correctif futur saura où la retrouver.
        store.store.set(`${key}${REJECTED_SUFFIX}`, {
          at: new Date().toISOString(),
          records: rejected.slice(),
        });
      }
      return state === null ? null : { state };
    },
    setItem: (_name, value) => {
      store.save(value.state);
    },
    removeItem: () => {
      // Vider ses données doit vider ses données : l'instantané, ses copies de
      // côté (`clear()` du socle) et la mise à l'écart.
      store.clear();
      store.store.remove(`${key}${REJECTED_SUFFIX}`);
    },
  };
}
