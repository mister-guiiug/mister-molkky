import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import { STORE_KEYS, versionedPersistStorage } from './persistence';
import { pullSync, pushSync, type SyncPayload } from '../cloudSync';
import { usePlayersStore } from './usePlayersStore';
import { useMatchStore } from './useMatchStore';
import { useTemplatesStore } from './useTemplatesStore';
import { useSettingsStore } from './useSettingsStore';

type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

/** Ce qui survit à un rechargement : le choix de l'utilisateur, pas l'état d'un appel. */
const PersistedSyncSchema = z.object({
  enabled: z.boolean().default(false),
  lastSyncAt: z.string().nullable().default(null),
});

interface SyncStoreState {
  /** When true, the next push/pull will run; toggle via toggleEnabled. */
  enabled: boolean;
  status: SyncStatus;
  lastSyncAt: string | null;
  error: string | null;

  toggleEnabled: () => void;
  pushNow: () => Promise<void>;
  pullNow: () => Promise<void>;
}

/**
 * Build the JSON blob we ship to the cloud. Reads the four persisted
 * stores directly so the call is synchronous + we always upload the
 * latest in-memory state (not a snapshot from N seconds ago).
 */
function buildPayload(): SyncPayload {
  const players = usePlayersStore.getState().players;
  const match = useMatchStore.getState();
  const templates = useTemplatesStore.getState().templates;
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
    players,
    history: match.history,
    templates,
    settings: settingsData,
    pushedAt: Date.now(),
  };
}

/**
 * Hydrate the four stores from a remote payload. Last-write-wins per
 * top-level field — no per-record merging in this v1.
 */
function applyPayload(payload: SyncPayload): void {
  if (Array.isArray(payload.players)) {
    usePlayersStore.setState({ players: payload.players as never });
  }
  if (Array.isArray(payload.history)) {
    useMatchStore.setState({ history: payload.history as never });
  }
  if (Array.isArray(payload.templates)) {
    useTemplatesStore.setState({ templates: payload.templates as never });
  }
  if (payload.settings && typeof payload.settings === 'object') {
    const s = payload.settings as Record<string, unknown>;
    // Only update known keys (typed individually) to avoid wiping the
    // action functions Zustand stores alongside the data.
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
}

export const useSyncStore = create<SyncStoreState>()(
  persist(
    (set, get) => ({
      enabled: false,
      status: 'idle',
      lastSyncAt: null,
      error: null,

      toggleEnabled: () => set(s => ({ enabled: !s.enabled })),

      pushNow: async () => {
        if (!get().enabled) return;
        set({ status: 'syncing', error: null });
        try {
          const result = await pushSync(buildPayload());
          set({
            status: 'ok',
            lastSyncAt: result.updatedAt,
            error: null,
          });
        } catch (err) {
          set({
            status: 'error',
            error: (err as Error).message,
          });
        }
      },

      pullNow: async () => {
        if (!get().enabled) return;
        set({ status: 'syncing', error: null });
        try {
          const result = await pullSync();
          if (result) {
            applyPayload(result.payload);
            set({
              status: 'ok',
              lastSyncAt: result.updatedAt,
              error: null,
            });
          } else {
            set({ status: 'ok', lastSyncAt: null, error: null });
          }
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
          return { enabled: false, lastSyncAt: null };
        },
      }),
      // Only persist user choice — status/error are transient.
      partialize: state => ({
        enabled: state.enabled,
        lastSyncAt: state.lastSyncAt,
      }),
    }
  )
);
