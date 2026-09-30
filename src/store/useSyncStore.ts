import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import { STORE_KEYS, versionedPersistStorage } from './persistence';
import {
  deleteSync,
  generateSyncKey,
  parseSyncKey,
  pullSync,
  pushSync,
  SYNC_KEY_LENGTH,
  SyncConflictError,
  type SyncPayload,
} from '../cloudSync';
import {
  EMPTY_SNAPSHOT,
  mergeSnapshots,
  readRemoteSnapshot,
  type MergeReport,
  type SyncSnapshot,
} from '../sync/merge';
import { usePlayersStore } from './usePlayersStore';
import { useMatchStore } from './useMatchStore';
import { useTemplatesStore } from './useTemplatesStore';
import { useSettingsStore } from './useSettingsStore';

type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

/** Le sens du geste. Il ne change pas la fusion, seulement ce qu'on écrit. */
export type SyncDirection = 'push' | 'pull';

/** Ce que la dernière synchro a réuni — pour le DIRE, pas pour le deviner. */
export interface LastSyncOutcome {
  direction: SyncDirection;
  report: MergeReport;
  /** Une partie était en cours : elle n'est pas partie dans la charge utile. */
  currentMatchKept: boolean;
}

/**
 * Ce qui survit à un rechargement : le choix de l'utilisateur, pas l'état d'un
 * appel. Une clé abîmée retombe à `null` (`catch`) sans emporter le reste : il
 * suffira de la rescanner.
 */
const PersistedSyncSchema = z.object({
  enabled: z.boolean().default(false),
  key: z.string().length(SYNC_KEY_LENGTH).nullable().catch(null),
  lastSyncAt: z.string().nullable().default(null),
});

/**
 * Un envoi refusé pour conflit est relu, refusionné et renvoyé. Trois
 * tentatives suffisent : il faudrait qu'un autre appareil écrive entre chaque
 * lecture et chaque envoi de celui-ci.
 */
const MAX_PUSH_ATTEMPTS = 3;

interface SyncStoreState {
  /** When true, the next push/pull will run; toggle via toggleEnabled. */
  enabled: boolean;
  /**
   * La clé de synchro de cet appareil — la même sur tous ceux qu'on réunit.
   * Elle ouvre le blob à qui la détient : elle ne quitte l'appareil que par
   * le QR ou la copie que l'utilisateur choisit d'afficher.
   */
  key: string | null;
  status: SyncStatus;
  lastSyncAt: string | null;
  error: string | null;
  /** Ce que la dernière synchro a réuni. Transitoire : jamais persisté. */
  lastOutcome: LastSyncOutcome | null;

  toggleEnabled: () => void;
  /** Tire une clé neuve : le premier appareil d'un groupe. */
  createKey: () => void;
  /** Reprend une clé scannée ou saisie ; `false` si ce n'en est pas une. */
  adoptKey: (input: string) => boolean;
  /** Oublie la clé ICI ; le blob, lui, reste dans le cloud. */
  forgetKey: () => void;
  /** Efface le blob du cloud, puis oublie la clé ici. */
  deleteCloud: () => Promise<void>;
  pushNow: () => Promise<void>;
  pullNow: () => Promise<void>;
}

/** L'état d'une clé qui arrive (ou s'en va) : aucun échange ne la concerne encore. */
const FRESH_KEY_STATE = {
  status: 'idle',
  lastSyncAt: null,
  error: null,
  lastOutcome: null,
} as const;

/** L'état local des trois collections fusionnables, à l'instant de l'appel. */
function localSnapshot(): SyncSnapshot {
  return {
    players: usePlayersStore.getState().players,
    history: useMatchStore.getState().history,
    templates: useTemplatesStore.getState().templates,
  };
}

/**
 * La charge utile envoyée au nuage.
 *
 * LA PARTIE EN COURS N'Y EST PAS, et ce n'est pas un oubli : un
 * `CurrentMatchState` ne se fusionne pas — deux appareils qui notent des
 * lancers dans la même partie produisent deux suites de lancers dont aucune
 * règle ne sait faire une seule. L'envoyer reviendrait à réintroduire
 * exactement l'écrasement que ce chantier retire, sur la donnée la plus vivante
 * de l'app. Elle reste donc sur son appareil — et l'écran le DIT
 * (`lastOutcome.currentMatchKept`), au lieu de le taire.
 *
 * LES RÉGLAGES NON PLUS NE SE FUSIONNENT PAS : ce sont des préférences
 * d'appareil (sons, vibrations, plein écran), pas des enregistrements. Ils
 * suivent le SENS du geste — « Envoyer » impose les réglages locaux au nuage,
 * « Récupérer » applique ceux du nuage — c'est le dernier écrivain qui gagne,
 * et c'est écrit dans l'aide de l'écran Réglages.
 */
function buildPayload(snapshot: SyncSnapshot): SyncPayload {
  const settings = useSettingsStore.getState();
  // Strip the action functions before serialising — we only persist
  // data fields.
  const settingsData = {
    locale: settings.locale,
    sounds: settings.sounds,
    vibrations: settings.vibrations,
    wakeLock: settings.wakeLock,
    outdoor: settings.outdoor,
    colorblind: settings.colorblind,
    coach: settings.coach,
    voiceAnnouncer: settings.voiceAnnouncer,
    hasSeenWelcome: settings.hasSeenWelcome,
    hasSeenMatchOnboarding: settings.hasSeenMatchOnboarding,
  };
  return {
    v: 1,
    players: snapshot.players,
    history: snapshot.history,
    templates: snapshot.templates,
    settings: settingsData,
    pushedAt: Date.now(),
  };
}

/** Écrit les trois collections fusionnées dans leurs magasins. */
function applySnapshot(snapshot: SyncSnapshot): void {
  usePlayersStore.setState({ players: snapshot.players });
  useMatchStore.setState({ history: snapshot.history });
  useTemplatesStore.setState({ templates: snapshot.templates });
}

/**
 * Applique les réglages venus du nuage — champ connu par champ connu, pour ne
 * pas écraser les fonctions que Zustand range à côté des données. N'est appelé
 * QUE par « Récupérer » : c'est le seul geste où l'utilisateur demande que le
 * nuage prime.
 */
function applyRemoteSettings(settings: unknown): void {
  if (!settings || typeof settings !== 'object') return;
  const s = settings as Record<string, unknown>;
  const update: Partial<Record<string, unknown>> = {};
  if (s.locale === 'fr' || s.locale === 'en') update.locale = s.locale;
  if (typeof s.sounds === 'boolean') update.sounds = s.sounds;
  if (typeof s.vibrations === 'boolean') update.vibrations = s.vibrations;
  if (typeof s.wakeLock === 'boolean') update.wakeLock = s.wakeLock;
  if (typeof s.outdoor === 'boolean') update.outdoor = s.outdoor;
  if (typeof s.colorblind === 'boolean') update.colorblind = s.colorblind;
  if (typeof s.coach === 'boolean') update.coach = s.coach;
  if (typeof s.voiceAnnouncer === 'boolean')
    update.voiceAnnouncer = s.voiceAnnouncer;
  useSettingsStore.setState(update as never);
}

export const useSyncStore = create<SyncStoreState>()(
  persist(
    (set, get) => ({
      enabled: false,
      key: null,
      status: 'idle',
      lastSyncAt: null,
      error: null,
      lastOutcome: null,

      toggleEnabled: () => set(s => ({ enabled: !s.enabled })),

      createKey: () => set({ key: generateSyncKey(), ...FRESH_KEY_STATE }),

      adoptKey: input => {
        const key = parseSyncKey(input);
        if (!key) return false;
        set({ key, ...FRESH_KEY_STATE });
        return true;
      },

      forgetKey: () => set({ key: null, ...FRESH_KEY_STATE }),

      /**
       * « Effacer du cloud ». La clé n'est oubliée qu'APRÈS l'effacement
       * réussi : un échec la laisse en place, sans quoi le blob deviendrait
       * inaccessible — et donc ineffaçable — depuis cet appareil.
       */
      deleteCloud: async () => {
        const { key } = get();
        if (!key) return;
        set({ status: 'syncing', error: null });
        try {
          await deleteSync(key);
          set({ key: null, ...FRESH_KEY_STATE });
        } catch (err) {
          set({ status: 'error', error: (err as Error).message });
        }
      },

      /**
       * « Envoyer » — qui commence par LIRE.
       *
       * Le geste s'appelle toujours envoyer, mais il ne remplace plus : on tire
       * d'abord ce que le nuage contient, on en fait l'union avec le local, on
       * écrit cette union des deux côtés. Ce que l'autre appareil avait posé y
       * survit ; ce qui est ici y arrive.
       *
       * Si la LECTURE échoue, on n'écrit PAS. Envoyer à l'aveugle après un
       * échec de lecture, c'est exactement l'écrasement d'avant : mieux vaut
       * une erreur à l'écran qu'un blob qui a perdu la moitié de son contenu.
       *
       * ET L'ÉCRITURE EST CONDITIONNELLE : elle porte la version lue. Si un
       * autre appareil a écrit entre la lecture et l'envoi, la base refuse
       * sans rien écraser, et on recommence — lecture, fusion, envoi. Sans ce
       * contrôle, deux envois simultanés perdaient l'union de l'un des deux.
       */
      pushNow: async () => {
        const { enabled, key } = get();
        if (!enabled || !key) return;
        set({ status: 'syncing', error: null });
        try {
          for (let attempt = 1; ; attempt += 1) {
            const remote = await pullSync(key);
            const { merged, report } = mergeSnapshots(
              localSnapshot(),
              remote ? readRemoteSnapshot(remote.payload) : EMPTY_SNAPSHOT
            );
            applySnapshot(merged);
            try {
              const result = await pushSync(
                key,
                buildPayload(merged),
                remote?.version ?? 0
              );
              set({
                status: 'ok',
                lastSyncAt: result.updatedAt,
                error: null,
                lastOutcome: {
                  direction: 'push',
                  report,
                  currentMatchKept: useMatchStore.getState().current !== null,
                },
              });
              return;
            } catch (err) {
              if (
                !(err instanceof SyncConflictError) ||
                attempt >= MAX_PUSH_ATTEMPTS
              ) {
                throw err;
              }
            }
          }
        } catch (err) {
          set({
            status: 'error',
            error: (err as Error).message,
          });
        }
      },

      /**
       * « Récupérer » — qui n'écrase plus rien localement.
       *
       * L'union est appliquée ici seulement ; le nuage n'est pas réécrit, donc
       * ce qui n'existe que sur cet appareil n'y monte pas encore. Les
       * réglages, eux, suivent le sens du geste et viennent du nuage.
       */
      pullNow: async () => {
        const { enabled, key } = get();
        if (!enabled || !key) return;
        set({ status: 'syncing', error: null });
        try {
          const result = await pullSync(key);
          if (!result) {
            // Rien dans le nuage : `lastOutcome` est REMIS À ZÉRO, pas laissé
            // en place. L'écran affiche le rapport dès que `status` vaut
            // « ok » — le garder afficherait le compte d'une synchro
            // précédente comme s'il venait de celle-ci.
            set({
              status: 'ok',
              lastSyncAt: null,
              error: null,
              lastOutcome: null,
            });
            return;
          }
          const { merged, report } = mergeSnapshots(
            localSnapshot(),
            readRemoteSnapshot(result.payload)
          );
          applySnapshot(merged);
          applyRemoteSettings(result.payload.settings);
          set({
            status: 'ok',
            lastSyncAt: result.updatedAt,
            error: null,
            lastOutcome: {
              direction: 'pull',
              report,
              currentMatchKept: useMatchStore.getState().current !== null,
            },
          });
        } catch (err) {
          set({
            status: 'error',
            error: (err as Error).message,
          });
        }
      },
    }),
    {
      name: STORE_KEYS.sync,
      storage: versionedPersistStorage<z.infer<typeof PersistedSyncSchema>>({
        name: STORE_KEYS.sync,
        validate: (data, reject) => {
          if (data === null || typeof data !== 'object') {
            throw new Error('mm_sync: forme inattendue');
          }
          const parsed = PersistedSyncSchema.safeParse(data);
          if (parsed.success) return parsed.data;
          reject(data);
          return { enabled: false, key: null, lastSyncAt: null };
        },
      }),
      // Only persist user choice — status/error are transient.
      partialize: state => ({
        enabled: state.enabled,
        key: state.key,
        lastSyncAt: state.lastSyncAt,
      }),
    }
  )
);
