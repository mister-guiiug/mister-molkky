import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORE_KEYS, versionedPersistStorage } from './persistence';
import { SettingsSchema, type Locale, type Settings } from '../schemas';

interface SettingsState extends Settings {
  setLocale: (l: Locale) => void;
  toggleSounds: () => void;
  toggleVibrations: () => void;
  toggleWakeLock: () => void;
  toggleOutdoor: () => void;
  toggleColorblind: () => void;
  toggleCoach: () => void;
  toggleVoiceAnnouncer: () => void;
  markWelcomeSeen: () => void;
  markMatchOnboardingSeen: () => void;
  reset: () => void;
}

const DEFAULTS: Settings = SettingsSchema.parse({});

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      ...DEFAULTS,
      setLocale: l => set({ locale: l }),
      toggleSounds: () => set(s => ({ sounds: !s.sounds })),
      toggleVibrations: () => set(s => ({ vibrations: !s.vibrations })),
      toggleWakeLock: () => set(s => ({ wakeLock: !s.wakeLock })),
      toggleOutdoor: () => set(s => ({ outdoor: !s.outdoor })),
      toggleColorblind: () => set(s => ({ colorblind: !s.colorblind })),
      toggleCoach: () => set(s => ({ coach: !s.coach })),
      toggleVoiceAnnouncer: () =>
        set(s => ({ voiceAnnouncer: !s.voiceAnnouncer })),
      markWelcomeSeen: () => set({ hasSeenWelcome: true }),
      markMatchOnboardingSeen: () => set({ hasSeenMatchOnboarding: true }),
      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: STORE_KEYS.settings,
      storage: versionedPersistStorage<Settings>({
        name: STORE_KEYS.settings,
        validate: (data, reject) => {
          if (data === null || typeof data !== 'object') {
            throw new Error('mm_settings: forme inattendue');
          }
          // Le schéma porte un défaut par champ : un objet partiel — celui
          // d'une version antérieure — traverse donc sans migration, et c'est
          // ce qui rend cette clé sûre à faire évoluer. Un objet dont UNE
          // valeur est aberrante (`locale: 'de'`) est mis de côté en entier :
          // dix préférences valent moins que la certitude de les retrouver.
          const parsed = SettingsSchema.safeParse(data);
          if (parsed.success) return parsed.data;
          reject(data);
          return DEFAULTS;
        },
      }),
    }
  )
);
